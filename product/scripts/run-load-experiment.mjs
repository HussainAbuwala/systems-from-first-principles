import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const defaults = {
  baseUrl: process.env.LOAD_BASE_URL ?? "http://localhost:5173",
  stock: 100,
  buyers: 200,
  concurrency: 25,
  products: 1,
  maxQuantity: 1,
  runs: 3,
  output: process.env.LOAD_OUTPUT ?? null,
  version: "transactional_hold",
};

function parseArgs(argv) {
  const config = { ...defaults };
  const names = new Map([
    ["--base-url", "baseUrl"],
    ["--stock", "stock"],
    ["--buyers", "buyers"],
    ["--concurrency", "concurrency"],
    ["--products", "products"],
    ["--max-quantity", "maxQuantity"],
    ["--runs", "runs"],
    ["--output", "output"],
    ["--version", "version"],
  ]);

  for (let index = 0; index < argv.length; index += 2) {
    const key = names.get(argv[index]);
    const value = argv[index + 1];
    if (!key || value === undefined) {
      throw new Error(`Unknown or incomplete argument: ${argv[index] ?? "<empty>"}`);
    }
    config[key] = key === "baseUrl" ? value.replace(/\/$/, "") : key === "output" || key === "version" ? value : Number(value);
  }

  for (const key of ["stock", "buyers", "concurrency", "products", "maxQuantity", "runs"]) {
    if (!Number.isInteger(config[key]) || config[key] < 1) throw new Error(`${key} must be a positive integer.`);
  }
  if (config.stock > 10_000) throw new Error("stock cannot exceed 10,000.");
  if (config.buyers > 2_000) throw new Error("buyers cannot exceed 2,000 per run.");
  if (config.concurrency > 200) throw new Error("concurrency cannot exceed 200.");
  if (config.products > 100) throw new Error("products cannot exceed 100.");
  if (config.products > config.stock) throw new Error("products cannot exceed stock; every product needs at least one unit.");
  if (config.maxQuantity > 1_000) throw new Error("maxQuantity cannot exceed 1,000.");
  if (config.runs > 10) throw new Error("runs cannot exceed 10.");
  if (config.version !== "atomic" && config.version !== "transactional_hold") {
    throw new Error("version must be atomic or transactional_hold.");
  }
  return config;
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function executeRun(config, runNumber) {
  const baseStock = Math.floor(config.stock / config.products);
  const extraUnits = config.stock % config.products;
  const productStocks = Array.from(
    { length: config.products },
    (_, index) => baseStock + (index < extraUnits ? 1 : 0),
  );
  const experiments = [];
  for (const initialStock of productStocks) {
    const started = await postJson(`${config.baseUrl}/api/experiments/start`, {
      version: config.version,
      initialStock,
    });
    assert.equal(started.response.ok, true, `start returned ${started.response.status}`);
    experiments.push({ id: started.payload.id, initialStock });
  }
  const results = new Array(config.buyers);
  let cursor = 0;

  const runStartedAt = performance.now();
  async function worker() {
    while (true) {
      const buyerIndex = cursor;
      cursor += 1;
      if (buyerIndex >= config.buyers) return;

      const quantity = 1 + (buyerIndex % config.maxQuantity);
      const productIndex = buyerIndex % experiments.length;
      const experimentId = experiments[productIndex].id;
      const requestStartedAt = performance.now();
      try {
        const { response, payload } = await postJson(
          `${config.baseUrl}/api/experiments/${experimentId}/purchase`,
          {
            buyer: `Buyer-${String(buyerIndex + 1).padStart(4, "0")}`,
            quantity,
            simulateResponseLoss: false,
          },
        );
        results[buyerIndex] = {
          latencyMs: performance.now() - requestStartedAt,
          status: response.status,
          accepted: response.ok && payload.accepted === true,
          quantity,
          productIndex,
          serverDurationMs: typeof payload.serverDurationMs === "number" ? payload.serverDurationMs : null,
          error: response.ok ? null : payload.error ?? `HTTP ${response.status}`,
        };
      } catch (error) {
        results[buyerIndex] = {
          latencyMs: performance.now() - requestStartedAt,
          status: 0,
          accepted: false,
          quantity,
          productIndex,
          serverDurationMs: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(config.concurrency, config.buyers) }, () => worker()));
  const durationMs = performance.now() - runStartedAt;

  const productSummaries = await Promise.all(experiments.map(async (experiment) => {
    const summaryResponse = await fetch(`${config.baseUrl}/api/experiments/${experiment.id}/summary`);
    assert.equal(summaryResponse.ok, true, `summary returned ${summaryResponse.status}`);
    return summaryResponse.json();
  }));
  const database = {
    products: productSummaries,
    totalInitialStock: productSummaries.reduce((total, summary) => total + Number(summary.experiment.initialStock), 0),
    totalAvailable: productSummaries.reduce((total, summary) => total + Number(summary.experiment.available), 0),
    committedRequests: productSummaries.reduce((total, summary) => total + Number(summary.committedRequests), 0),
    committedUnits: productSummaries.reduce((total, summary) => total + Number(summary.committedUnits), 0),
    accountedUnits: productSummaries.reduce((total, summary) => total + Number(summary.accountedUnits), 0),
    invariant: productSummaries.every((summary) => summary.invariant === true),
  };

  const latencies = results.map((result) => result.latencyMs).sort((left, right) => left - right);
  const serverLatencies = results
    .map((result) => result.serverDurationMs)
    .filter((duration) => duration !== null)
    .sort((left, right) => left - right);
  const accepted = results.filter((result) => result.accepted);
  const rejected = results.filter((result) => !result.accepted && result.error === null);
  const errors = results.filter((result) => result.error !== null);
  const acceptedServerLatencies = accepted
    .map((result) => result.serverDurationMs)
    .filter((duration) => duration !== null)
    .sort((left, right) => left - right);
  const rejectedServerLatencies = rejected
    .map((result) => result.serverDurationMs)
    .filter((duration) => duration !== null)
    .sort((left, right) => left - right);
  const acceptedUnitsFromResponses = accepted.reduce((total, result) => total + result.quantity, 0);

  return {
    run: runNumber,
    experimentIds: experiments.map((experiment) => experiment.id),
    workload: {
      version: config.version,
      stock: config.stock,
      buyers: config.buyers,
      concurrency: config.concurrency,
      products: config.products,
      productStocks,
      maxQuantity: config.maxQuantity,
      requestedUnits: results.reduce((total, result) => total + result.quantity, 0),
    },
    performance: {
      durationMs: Number(durationMs.toFixed(1)),
      throughputRequestsPerSecond: Number((config.buyers / (durationMs / 1_000)).toFixed(1)),
      p50Ms: Number(percentile(latencies, 0.5).toFixed(1)),
      p95Ms: Number(percentile(latencies, 0.95).toFixed(1)),
      p99Ms: Number(percentile(latencies, 0.99).toFixed(1)),
      minimumMs: Number(latencies[0].toFixed(1)),
      maximumMs: Number(latencies.at(-1).toFixed(1)),
      serverP50Ms: Number(percentile(serverLatencies, 0.5).toFixed(1)),
      serverP95Ms: Number(percentile(serverLatencies, 0.95).toFixed(1)),
      acceptedServerP95Ms: Number(percentile(acceptedServerLatencies, 0.95).toFixed(1)),
      rejectedServerP95Ms: Number(percentile(rejectedServerLatencies, 0.95).toFixed(1)),
      serverTimingSamples: serverLatencies.length,
    },
    responses: {
      accepted: accepted.length,
      rejected: rejected.length,
      errors: errors.length,
      acceptedUnits: acceptedUnitsFromResponses,
      statuses: Object.fromEntries(
        [...new Set(results.map((result) => result.status))]
          .sort((left, right) => left - right)
          .map((status) => [status, results.filter((result) => result.status === status).length]),
      ),
    },
    database,
    checks: {
      inventoryConserved: database.invariant === true,
      responsesMatchDatabase: acceptedUnitsFromResponses === database.committedUnits,
      noNegativeStock: database.products.every((summary) => Number(summary.experiment.available) >= 0),
      serverTimingsComplete: serverLatencies.length === results.length - errors.length,
    },
  };
}

const config = parseArgs(process.argv.slice(2));
const runs = [];
for (let runNumber = 1; runNumber <= config.runs; runNumber += 1) {
  const result = await executeRun(config, runNumber);
  runs.push(result);
  console.error(
    `Run ${runNumber}: ${result.performance.throughputRequestsPerSecond} req/s, p95 ${result.performance.p95Ms} ms, errors ${result.responses.errors}, invariant ${result.checks.inventoryConserved ? "held" : "failed"}`,
  );
}

const output = {
  measuredAt: new Date().toISOString(),
  target: config.baseUrl,
  note: "Client-observed end-to-end timings from one load-generator process.",
  runs,
};

console.log(JSON.stringify(output, null, 2));

if (config.output) {
  await mkdir(dirname(config.output), { recursive: true });
  await writeFile(config.output, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.error(`Saved ${config.output}`);
}

if (runs.some((run) => !run.checks.inventoryConserved || !run.checks.responsesMatchDatabase || !run.checks.noNegativeStock || !run.checks.serverTimingsComplete)) {
  process.exitCode = 1;
}

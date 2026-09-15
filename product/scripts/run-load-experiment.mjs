import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const defaults = {
  baseUrl: process.env.LOAD_BASE_URL ?? "http://localhost:5173",
  stock: 100,
  buyers: 200,
  concurrency: 25,
  products: 1,
  compareProducts: null,
  maxQuantity: 1,
  runs: 3,
  output: process.env.LOAD_OUTPUT ?? null,
  version: "transactional_hold",
  expected: "any",
};

function parseArgs(argv) {
  const config = { ...defaults };
  const names = new Map([
    ["--base-url", "baseUrl"],
    ["--stock", "stock"],
    ["--buyers", "buyers"],
    ["--concurrency", "concurrency"],
    ["--products", "products"],
    ["--compare-products", "compareProducts"],
    ["--max-quantity", "maxQuantity"],
    ["--runs", "runs"],
    ["--output", "output"],
    ["--version", "version"],
    ["--expected", "expected"],
  ]);

  for (let index = 0; index < argv.length; index += 2) {
    const key = names.get(argv[index]);
    const value = argv[index + 1];
    if (!key || value === undefined) {
      throw new Error(`Unknown or incomplete argument: ${argv[index] ?? "<empty>"}`);
    }
    config[key] = key === "baseUrl"
      ? value.replace(/\/$/, "")
      : key === "output" || key === "version" || key === "expected"
        ? value
        : Number(value);
  }

  for (const key of ["stock", "buyers", "concurrency", "products", "maxQuantity", "runs"]) {
    if (!Number.isInteger(config[key]) || config[key] < 1) throw new Error(`${key} must be a positive integer.`);
  }
  if (config.stock > 10_000) throw new Error("stock cannot exceed 10,000.");
  if (config.buyers > 2_000) throw new Error("buyers cannot exceed 2,000 per run.");
  if (config.concurrency > 200) throw new Error("concurrency cannot exceed 200.");
  if (config.products > 100) throw new Error("products cannot exceed 100.");
  if (config.products > config.stock) throw new Error("products cannot exceed stock; every product needs at least one unit.");
  if (config.compareProducts !== null) {
    if (!Number.isInteger(config.compareProducts) || config.compareProducts < 1 || config.compareProducts > 100) {
      throw new Error("compareProducts must be an integer from 1 to 100.");
    }
    if (config.compareProducts > config.stock) {
      throw new Error("compareProducts cannot exceed stock; every product needs at least one unit.");
    }
    if (config.compareProducts === config.products) throw new Error("compareProducts must differ from products.");
  }
  if (config.maxQuantity > 1_000) throw new Error("maxQuantity cannot exceed 1,000.");
  if (config.runs > 10) throw new Error("runs cannot exceed 10.");
  if (config.version !== "atomic" && config.version !== "transactional_hold") {
    throw new Error("version must be atomic or transactional_hold.");
  }
  if (!new Set(["any", "accepted", "mixed", "rejected"]).has(config.expected)) {
    throw new Error("expected must be any, accepted, mixed, or rejected.");
  }
  return config;
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function bootstrapMeanConfidenceInterval(values, samples = 10_000) {
  let state = 0x5f3759df;
  function random() {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  }

  const means = new Array(samples);
  for (let sample = 0; sample < samples; sample += 1) {
    let total = 0;
    for (let index = 0; index < values.length; index += 1) {
      total += values[Math.floor(random() * values.length)];
    }
    means[sample] = total / values.length;
  }
  means.sort((left, right) => left - right);
  return {
    low: Number(percentile(means, 0.025).toFixed(1)),
    high: Number(percentile(means, 0.975).toFixed(1)),
  };
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
            captureTrace: false,
          },
        );
        results[buyerIndex] = {
          latencyMs: performance.now() - requestStartedAt,
          status: response.status,
          accepted: response.ok && payload.accepted === true,
          quantity,
          productIndex,
          serverDurationMs: typeof payload.serverDurationMs === "number" ? payload.serverDurationMs : null,
          serverTimings: payload.serverTimings && typeof payload.serverTimings === "object" ? payload.serverTimings : null,
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
          serverTimings: null,
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
  const operationDurations = (name, selectedResults = results) => selectedResults
    .map((result) => result.serverTimings?.[name])
    .filter((duration) => typeof duration === "number")
    .sort((left, right) => left - right);
  const lookupDurations = operationDurations("lookupMs");
  const transactionDurations = operationDurations("transactionMs");
  const acceptedTransactionDurations = operationDurations("transactionMs", accepted);
  const rejectedTransactionDurations = operationDurations("transactionMs", rejected);
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
      lookupP50Ms: Number(percentile(lookupDurations, 0.5).toFixed(1)),
      lookupP95Ms: Number(percentile(lookupDurations, 0.95).toFixed(1)),
      transactionP50Ms: Number(percentile(transactionDurations, 0.5).toFixed(1)),
      transactionP95Ms: Number(percentile(transactionDurations, 0.95).toFixed(1)),
      acceptedTransactionP95Ms: Number(percentile(acceptedTransactionDurations, 0.95).toFixed(1)),
      rejectedTransactionP95Ms: Number(percentile(rejectedTransactionDurations, 0.95).toFixed(1)),
      operationTimingSamples: transactionDurations.length,
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
      operationTimingsComplete: config.version !== "transactional_hold"
        || transactionDurations.length === results.length - errors.length,
      expectedOutcomeMatched: config.expected === "any"
        || (config.expected === "accepted" && accepted.length === results.length)
        || (config.expected === "rejected" && rejected.length === results.length)
        || (config.expected === "mixed" && accepted.length > 0 && rejected.length > 0),
    },
  };
}

const config = parseArgs(process.argv.slice(2));
const allRuns = [];
let output;

if (config.compareProducts === null) {
  const runs = [];
  for (let runNumber = 1; runNumber <= config.runs; runNumber += 1) {
    const result = await executeRun(config, runNumber);
    runs.push(result);
    allRuns.push(result);
    console.error(
      `Run ${runNumber}: ${result.performance.throughputRequestsPerSecond} req/s, p95 ${result.performance.p95Ms} ms, errors ${result.responses.errors}, invariant ${result.checks.inventoryConserved ? "held" : "failed"}`,
    );
  }
  output = {
    measuredAt: new Date().toISOString(),
    target: config.baseUrl,
    note: "Client-observed end-to-end timings from one load-generator process. Educational trace writes were disabled.",
    runs,
  };
} else {
  const pairs = [];
  for (let pair = 1; pair <= config.runs; pair += 1) {
    const order = pair % 2 === 1
      ? [config.products, config.compareProducts]
      : [config.compareProducts, config.products];
    const scenarios = {};
    for (const products of order) {
      const result = await executeRun({ ...config, products }, pair);
      scenarios[String(products)] = result;
      allRuns.push(result);
      console.error(
        `Pair ${pair}, ${products} product(s): ${result.performance.throughputRequestsPerSecond} req/s, client p95 ${result.performance.p95Ms} ms, transaction p95 ${result.performance.transactionP95Ms} ms`,
      );
    }
    const baseline = scenarios[String(config.products)];
    const comparison = scenarios[String(config.compareProducts)];
    pairs.push({
      pair,
      order,
      scenarios,
      changePercent: {
        throughput: Number((((comparison.performance.throughputRequestsPerSecond / baseline.performance.throughputRequestsPerSecond) - 1) * 100).toFixed(1)),
        clientP95: Number((((comparison.performance.p95Ms / baseline.performance.p95Ms) - 1) * 100).toFixed(1)),
        serverP95: Number((((comparison.performance.serverP95Ms / baseline.performance.serverP95Ms) - 1) * 100).toFixed(1)),
        transactionP95: Number((((comparison.performance.transactionP95Ms / baseline.performance.transactionP95Ms) - 1) * 100).toFixed(1)),
      },
    });
  }

  const metrics = ["throughput", "clientP95", "serverP95", "transactionP95"];
  const pairedSummary = Object.fromEntries(metrics.map((metric) => {
    const changes = pairs.map((pair) => pair.changePercent[metric]);
    return [metric, {
      medianChangePercent: Number(median(changes).toFixed(1)),
      meanChangePercent: Number(mean(changes).toFixed(1)),
      confidenceInterval95ForMean: bootstrapMeanConfidenceInterval(changes),
      comparisonWins: changes.filter((change) => metric === "throughput" ? change > 0 : change < 0).length,
      pairs: changes.length,
    }];
  }));

  output = {
    measuredAt: new Date().toISOString(),
    target: config.baseUrl,
    note: "Paired, alternating-order comparison from one load-generator process. Educational trace writes were disabled.",
    comparison: { baselineProducts: config.products, comparisonProducts: config.compareProducts },
    pairs,
    pairedSummary,
  };
}

console.log(JSON.stringify(output, null, 2));

if (config.output) {
  await mkdir(dirname(config.output), { recursive: true });
  await writeFile(config.output, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.error(`Saved ${config.output}`);
}

if (allRuns.some((run) => !run.checks.inventoryConserved
  || !run.checks.responsesMatchDatabase
  || !run.checks.noNegativeStock
  || !run.checks.serverTimingsComplete
  || !run.checks.operationTimingsComplete
  || !run.checks.expectedOutcomeMatched)) {
  process.exitCode = 1;
}

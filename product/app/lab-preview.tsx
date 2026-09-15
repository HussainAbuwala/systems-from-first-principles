"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CircleAlert, Clock3, Database, Gauge, Play, RotateCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import concurrency5 from "@/benchmarks/hot-product-c5.json";
import concurrency20 from "@/benchmarks/hot-product-c20.json";
import concurrency50 from "@/benchmarks/hot-product-c50.json";
import mixedQuantity from "@/benchmarks/mixed-quantity-c20.json";
import tenProducts from "@/benchmarks/ten-products-c50.json";

type Version = "naive" | "atomic" | "permanent_hold" | "expiring_hold" | "crash_gap" | "transactional_hold";
type Event = { id: number; buyer: string; action: string; detail: string; createdAt: number };
type Reservation = {
  id: string;
  buyer: string;
  quantity: number;
  status: "held" | "expired" | "confirmed";
  expiresAt: number | null;
  abandonedAt: number | null;
  createdAt: number;
  resolvedAt: number | null;
};
type Run = {
  experiment: { id: string; version: Version; initialStock: number; available: number; createdAt: number };
  allocations: Array<{ id: string; buyer: string; quantity: number; createdAt: number }>;
  reservations: Reservation[];
  events: Event[];
  invariant: boolean;
  accountedUnits: number;
  requirementMet: boolean;
};

type BenchmarkRun = {
  performance: {
    throughputRequestsPerSecond: number;
    p50Ms: number;
    p95Ms: number;
    serverP50Ms: number;
    serverP95Ms: number;
    acceptedServerP95Ms?: number;
    rejectedServerP95Ms?: number;
    serverTimingSamples?: number;
  };
  responses: { accepted: number; rejected: number; errors: number; acceptedUnits: number };
  checks: { inventoryConserved: boolean };
};

function middle(values: number[]) {
  return [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
}

function summarizeBenchmark(concurrency: number, runs: BenchmarkRun[]) {
  return {
    concurrency,
    throughput: middle(runs.map((run) => run.performance.throughputRequestsPerSecond)),
    p50: middle(runs.map((run) => run.performance.p50Ms)),
    p95: middle(runs.map((run) => run.performance.p95Ms)),
    serverP50: middle(runs.map((run) => run.performance.serverP50Ms)),
    serverP95: middle(runs.map((run) => run.performance.serverP95Ms)),
    acceptedServerP95: middle(runs.map((run) => run.performance.acceptedServerP95Ms ?? run.performance.serverP95Ms)),
    rejectedServerP95: middle(runs.map((run) => run.performance.rejectedServerP95Ms ?? run.performance.serverP95Ms)),
    serverTimingSamples: middle(runs.map((run) => run.performance.serverTimingSamples ?? run.responses.accepted)),
    accepted: middle(runs.map((run) => run.responses.accepted)),
    rejected: middle(runs.map((run) => run.responses.rejected)),
    errors: runs.reduce((total, run) => total + run.responses.errors, 0),
    invariantHeld: runs.every((run) => run.checks.inventoryConserved),
  };
}

const benchmarkScenarios = [
  summarizeBenchmark(5, concurrency5.runs),
  summarizeBenchmark(20, concurrency20.runs),
  summarizeBenchmark(50, concurrency50.runs),
];
const mixedQuantitySummary = summarizeBenchmark(20, mixedQuantity.runs);
const hotProductComparison = summarizeBenchmark(50, concurrency50.runs);
const tenProductComparison = summarizeBenchmark(50, tenProducts.runs);
const distributedThroughputGain = Math.round((tenProductComparison.throughput / hotProductComparison.throughput - 1) * 100);
const distributedP95Reduction = Math.round((1 - tenProductComparison.p95 / hotProductComparison.p95) * 100);

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: {
        name: string;
        title?: string;
        description: string;
        inputSchema: object;
        annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
        execute: (input: unknown) => unknown | Promise<unknown>;
      }, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

const versions = {
  naive: {
    label: "01 · Read, check, write",
    requirement: "Requirement 01",
    requirementTitle: "Never promise one unit to two buyers.",
    requirementDescription: "Both versions receive the same stock and the same two concurrent purchase requests.",
    eyebrow: "Starting implementation",
    question: "Can two requests both act on the same old value?",
    explanation: "The application reads stock, decides locally, then writes later. The pause makes that unsafe gap easy to reproduce.",
    finding: "The final stock says 0, but the database contains two promises.",
    code: [
      ["const stock = await db.readStock(itemId);", "read"],
      ["if (stock > 0) {", "decision"],
      ["  await pause(180);", "gap"],
      ["  await db.writeStock(itemId, stock - 1);", "write"],
      ["  return \"accepted\";", "promise"],
      ["}", ""],
    ],
  },
  atomic: {
    label: "02 · Atomic decision",
    requirement: "Requirement 01",
    requirementTitle: "Never promise one unit to two buyers.",
    requirementDescription: "Both versions receive the same stock and the same two concurrent purchase requests.",
    eyebrow: "Requirement satisfied",
    question: "Can the database check and subtract as one decision?",
    explanation: "The condition and subtraction execute in one database statement. Only the request that changes one row may promise the unit.",
    finding: "The winner still needs time to pay. We need to remember whose unit this is.",
    code: [
      ["const result = await db.execute(`", ""],
      ["  UPDATE experiments", ""],
      ["  SET available = available - 1", "write"],
      ["  WHERE id = ? AND available > 0", "decision"],
      ["`);", ""],
      ["return result.changes === 1;", "promise"],
    ],
  },
  permanent_hold: {
    label: "03 · Hold during payment",
    requirement: "Requirement 02",
    requirementTitle: "Protect the unit while payment is open.",
    requirementDescription: "Alice starts checkout, then leaves without paying. Bob tries to buy the same unit.",
    eyebrow: "New lifecycle",
    question: "What should represent ownership while payment is unfinished?",
    explanation: "After the atomic subtraction, we store a durable hold for Alice and return immediately. No database lock stays open while she pays.",
    finding: "Alice leaves, but her permanent hold strands the only unit. Bob can never buy it.",
    code: [
      ["if (await subtractIfAvailable(itemId)) {", "decision"],
      ["  await db.insertHold({", "write"],
      ["    buyer: \"Alice\",", ""],
      ["    status: \"held\"", "promise"],
      ["  });", ""],
      ["}", ""],
    ],
  },
  expiring_hold: {
    label: "04 · Expiring hold",
    requirement: "Requirement 03",
    requirementTitle: "Return abandoned stock automatically.",
    requirementDescription: "Alice abandons checkout. Bob retries after the hold deadline has passed.",
    eyebrow: "Failure repaired",
    question: "Can a stale hold release the unit before the next decision?",
    explanation: "Each hold gets an expiry timestamp. Before Bob tries again, the service expires stale holds and returns their units to available stock.",
    finding: "Alice's hold expires and Bob claims the recovered unit. Next we must make every lifecycle transition crash-safe.",
    code: [
      ["await releaseExpiredHolds(now);", "write"],
      ["if (await subtractIfAvailable(itemId)) {", "decision"],
      ["  await db.insertHold({", "write"],
      ["    buyer,", ""],
      ["    expiresAt: now + 1200", "gap"],
      ["  });", "promise"],
      ["}", ""],
    ],
  },
  crash_gap: {
    label: "05 · Crash between writes",
    requirement: "Requirement 04",
    requirementTitle: "Every unavailable unit must have an owner.",
    requirementDescription: "Alice's request subtracts the unit. We then inject a process crash before the hold is stored.",
    eyebrow: "Failure injection",
    question: "What happens if the process dies between two durable writes?",
    explanation: "The stock update commits first. The controlled crash stops execution before the reservation insert, leaving no durable owner for the unavailable unit.",
    finding: "Stock is 0, but no allocation or active hold accounts for the unit.",
    code: [
      ["await subtractIfAvailable(itemId);", "write"],
      ["// process crashes here", "gap"],
      ["await db.insertHold({ buyer });", "promise"],
    ],
  },
  transactional_hold: {
    label: "06 · Atomic hold creation",
    requirement: "Requirement 04",
    requirementTitle: "Every unavailable unit must have an owner.",
    requirementDescription: "Alice's response is lost immediately after the database transaction commits.",
    eyebrow: "Crash-safe commit",
    question: "Can stock and its owner become durable together?",
    explanation: "D1 executes the batched statements as one SQL transaction. The hold and subtraction both commit, or the whole batch rolls back.",
    finding: "The response was lost, but Alice's durable hold still accounts for the unavailable unit. Next: make her retry idempotent.",
    code: [
      ["const [hold] = await db.batch([", "decision"],
      ["  insertHoldIfAvailable(buyer),", "write"],
      ["  subtractForHold(buyer),", "write"],
      ["]);", ""],
      ["// both commit, or neither does", "promise"],
      ["return hold.changes === 1;", "decision"],
    ],
  },
} as const;

async function postStep(url: string, buyer: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ buyer }),
  });
  if (!response.ok) {
    const payload = await response.json() as { error?: string };
    throw new Error(payload.error ?? `${buyer}'s request failed.`);
  }
}

async function postExpectedFailure(url: string, buyer: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ buyer }),
  });
  const payload = await response.json() as { simulatedCrash?: boolean; error?: string };
  if (response.status !== 503 || !payload.simulatedCrash) {
    throw new Error(payload.error ?? "The controlled crash did not occur at the expected boundary.");
  }
}

async function runOnServer(version: Version, report: (message: string) => void): Promise<Run> {
  const startResponse = await fetch("/api/experiments/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ version }),
  });
  if (!startResponse.ok) {
    const payload = await startResponse.json() as { error?: string };
    throw new Error(payload.error ?? "Could not start the experiment.");
  }
  const started = await startResponse.json() as { id: string };

  if (version === "naive" || version === "atomic") {
    report("Alice and Bob are sending requests at the same time…");
    await Promise.all(["Alice", "Bob"].map((buyer) => postStep(`/api/experiments/${started.id}/purchase`, buyer)));
  } else if (version === "crash_gap" || version === "transactional_hold") {
    report(version === "crash_gap"
      ? "Alice's request is crashing after stock is subtracted…"
      : "Alice's response is being lost after the transaction commits…");
    await postExpectedFailure(`/api/experiments/${started.id}/purchase`, "Alice");
  } else {
    report("Alice is starting payment and receiving a hold…");
    await postStep(`/api/experiments/${started.id}/purchase`, "Alice");
    report("Alice has left checkout without paying…");
    await postStep(`/api/experiments/${started.id}/abandon`, "Alice");
    report("Bob is trying while Alice's hold is active…");
    await postStep(`/api/experiments/${started.id}/purchase`, "Bob");

    if (version === "expiring_hold") {
      report("Waiting 1.2 seconds for Alice's hold to expire…");
      await new Promise((resolve) => setTimeout(resolve, 1_300));
      report("Bob is retrying after the deadline…");
      await postStep(`/api/experiments/${started.id}/purchase`, "Bob");
    }
  }

  const result = await fetch(`/api/experiments/${started.id}`);
  if (!result.ok) {
    const payload = await result.json() as { error?: string };
    throw new Error(payload.error ?? "Could not inspect the experiment.");
  }
  return result.json() as Promise<Run>;
}

export function LabPreview() {
  const [version, setVersion] = useState<Version>("naive");
  const [run, setRun] = useState<Run | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const execute = useCallback(async (selected: Version = version) => {
    setVersion(selected);
    setRun(null);
    setError("");
    setProgress("");
    setStatus("running");
    try {
      const result = await runOnServer(selected, setProgress);
      setRun(result);
      setStatus("idle");
      return {
        version: result.experiment.version,
        available: result.experiment.available,
        commitments: result.allocations.reduce((total, allocation) => total + allocation.quantity, 0)
          + result.reservations.filter((reservation) => reservation.status === "held").reduce((total, reservation) => total + reservation.quantity, 0),
        accountedUnits: result.accountedUnits,
        invariantHeld: result.invariant,
        requirementMet: result.requirementMet,
      };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The experiment failed unexpectedly.";
      setError(message);
      setStatus("error");
      throw cause;
    }
  }, [version]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "run_inventory_progression",
      title: "Run inventory progression",
      description: "Run one stage of the inventory system—from the concurrency race through crash-safe payment holds—and display its database evidence.",
      inputSchema: {
        type: "object",
        properties: { version: { type: "string", enum: ["naive", "atomic", "permanent_hold", "expiring_hold", "crash_gap", "transactional_hold"] } },
        required: ["version"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const candidate = (input as { version?: unknown } | null)?.version;
        if (candidate !== "naive" && candidate !== "atomic" && candidate !== "permanent_hold" && candidate !== "expiring_hold" && candidate !== "crash_gap" && candidate !== "transactional_hold") {
          throw new Error("Unknown experiment version.");
        }
        return execute(candidate);
      },
    }, { signal: lifecycle.signal })).catch(() => {});
    return () => lifecycle.abort();
  }, [execute]);

  const current = versions[version];
  const elapsed = run?.events.length
    ? Math.max(...run.events.map((event) => event.createdAt)) - Math.min(...run.events.map((event) => event.createdAt))
    : 0;
  const isHoldVersion = version === "permanent_hold" || version === "expiring_hold" || version === "crash_gap" || version === "transactional_hold";
  const isCrashVersion = version === "crash_gap" || version === "transactional_hold";
  const activeHolds = run?.reservations.filter((reservation) => reservation.status === "held") ?? [];

  return (
    <main className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-white/10 px-5 py-4 lg:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center border border-cyan-300/40 bg-cyan-300/10 font-mono text-sm text-cyan-200">S/</span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">Systems from first principles</p>
              <p className="text-sm text-slate-300">Inventory reservation lab</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 font-mono text-xs text-slate-500 sm:flex"><Database className="size-3.5" /> LIVE DATABASE · SYSTEM 01</div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1500px] gap-5 px-5 py-5 lg:grid-cols-[260px_minmax(0,1fr)_350px] lg:px-8">
        <aside className="border border-white/10 bg-white/[0.025] p-5">
          <p className="eyebrow">{current.requirement}</p>
          <h1 className="mt-3 text-2xl font-semibold leading-tight">{current.requirementTitle}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">{current.requirementDescription}</p>

          <Tabs value={version} onValueChange={(value) => { setVersion(value as Version); setRun(null); setError(""); setProgress(""); setStatus("idle"); }} className="mt-7">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">Concurrency</p>
            <TabsList className="h-auto w-full flex-col items-stretch gap-0 rounded-none border-l border-cyan-300/30 bg-transparent p-0">
              <TabsTrigger value="naive" className="justify-start rounded-none border-l-2 border-transparent px-4 py-3 font-mono text-xs text-slate-500 data-[state=active]:border-cyan-300 data-[state=active]:bg-cyan-300/[0.06] data-[state=active]:text-cyan-200">01 · Read, check, write</TabsTrigger>
              <TabsTrigger value="atomic" className="justify-start rounded-none border-l-2 border-transparent px-4 py-3 font-mono text-xs text-slate-500 data-[state=active]:border-cyan-300 data-[state=active]:bg-cyan-300/[0.06] data-[state=active]:text-cyan-200">02 · Atomic decision</TabsTrigger>
            </TabsList>
            <p className="mb-2 mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">Payment lifecycle</p>
            <TabsList className="h-auto w-full flex-col items-stretch gap-0 rounded-none border-l border-cyan-300/30 bg-transparent p-0">
              <TabsTrigger value="permanent_hold" className="justify-start rounded-none border-l-2 border-transparent px-4 py-3 font-mono text-xs text-slate-500 data-[state=active]:border-cyan-300 data-[state=active]:bg-cyan-300/[0.06] data-[state=active]:text-cyan-200">03 · Hold during payment</TabsTrigger>
              <TabsTrigger value="expiring_hold" className="justify-start rounded-none border-l-2 border-transparent px-4 py-3 font-mono text-xs text-slate-500 data-[state=active]:border-cyan-300 data-[state=active]:bg-cyan-300/[0.06] data-[state=active]:text-cyan-200">04 · Expiring hold</TabsTrigger>
            </TabsList>
            <p className="mb-2 mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-600">Crash safety</p>
            <TabsList className="h-auto w-full flex-col items-stretch gap-0 rounded-none border-l border-cyan-300/30 bg-transparent p-0">
              <TabsTrigger value="crash_gap" className="justify-start rounded-none border-l-2 border-transparent px-4 py-3 font-mono text-xs text-slate-500 data-[state=active]:border-cyan-300 data-[state=active]:bg-cyan-300/[0.06] data-[state=active]:text-cyan-200">05 · Crash between writes</TabsTrigger>
              <TabsTrigger value="transactional_hold" className="justify-start rounded-none border-l-2 border-transparent px-4 py-3 font-mono text-xs text-slate-500 data-[state=active]:border-cyan-300 data-[state=active]:bg-cyan-300/[0.06] data-[state=active]:text-cyan-200">06 · Atomic hold creation</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="mt-7 border-t border-white/10 pt-5">
            <p className="eyebrow">What this reveals</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{current.finding}</p>
          </div>
        </aside>

        <section className="border border-white/10 bg-[#0b1118]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
            <div>
              <p className="eyebrow">Real experiment · {current.eyebrow}</p>
              <h2 className="mt-1 text-lg font-medium">{isCrashVersion ? "One request, one injected crash" : isHoldVersion ? "One abandoned checkout, one waiting buyer" : "Two buyers, one last pair"}</h2>
            </div>
            <Button disabled={status === "running"} onClick={() => void execute()} className="rounded-none bg-cyan-300 text-slate-950 hover:bg-cyan-200">
              <Play className="size-4" /> {status === "running" ? "Running…" : isCrashVersion ? "Inject failure" : isHoldVersion ? "Run checkout lifecycle" : "Run two buyers"}
            </Button>
          </div>

          <div className="min-h-[505px] p-5 sm:p-7">
            {!run && status !== "error" ? (
              <div className="grid min-h-[440px] place-items-center">
                <div className="max-w-md text-center">
                  <div className="mx-auto grid size-28 place-items-center rounded-full border border-dashed border-cyan-300/30 bg-cyan-300/[0.03] font-mono text-3xl text-cyan-200">1</div>
                  <p className="mt-5 text-lg">One unit is available.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{status === "running" ? progress : current.question}</p>
                </div>
              </div>
            ) : null}

            {status === "error" ? (
              <div className="grid min-h-[440px] place-items-center text-center"><div><CircleAlert className="mx-auto size-9 text-rose-300" /><p className="mt-4 text-rose-200">Experiment unavailable</p><p className="mt-2 max-w-md text-sm text-slate-500">{error}</p></div></div>
            ) : null}

            {run ? (
              <div>
                <div className="grid grid-cols-3 gap-px border border-white/10 bg-white/10">
                  <Metric label="Stock left" value={String(run.experiment.available)} />
                  <Metric label={isHoldVersion ? "Active holds" : "Promises"} value={String(isHoldVersion ? activeHolds.length : run.allocations.length)} tone={run.requirementMet ? "good" : "bad"} />
                  <Metric label={isCrashVersion ? "Accounted units" : "Trace span"} value={isCrashVersion ? `${run.accountedUnits}/${run.experiment.initialStock}` : `${elapsed}ms`} tone={isCrashVersion ? (run.invariant ? "good" : "bad") : undefined} />
                </div>

                <div className={`mt-5 flex items-start gap-3 border px-4 py-3 ${run.requirementMet ? "border-emerald-300/20 bg-emerald-300/[0.05] text-emerald-200" : "border-rose-300/20 bg-rose-300/[0.05] text-rose-200"}`}>
                  {run.requirementMet ? <Check className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}
                  <div>
                    <p className="text-sm font-medium">{run.requirementMet ? "Requirement satisfied" : "Requirement failed"}</p>
                    <p className="mt-1 text-xs opacity-70">
                      {version === "permanent_hold"
                        ? "Alice abandoned payment, but her hold still owns the only unit."
                        : version === "expiring_hold"
                          ? "Alice's stale hold expired; Bob acquired the released unit."
                          : version === "crash_gap"
                            ? "Stock is 0, but no allocation or hold owns the unit."
                            : version === "transactional_hold"
                              ? "The response was lost after commit; Alice's durable hold still owns the unit."
                          : `Promises (${run.allocations.length}) must never exceed initial stock (${run.experiment.initialStock}).`}
                    </p>
                  </div>
                </div>

                {isHoldVersion ? (
                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between"><p className="eyebrow">Reservation records</p><span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600"><Clock3 className="size-3" /> stored in DB</span></div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {run.reservations.length === 0 ? (
                        <div className="border border-rose-300/20 bg-rose-300/[0.04] px-4 py-3 text-sm text-rose-200">No reservation was stored.</div>
                      ) : null}
                      {run.reservations.map((reservation) => (
                        <div key={reservation.id} className="border border-white/10 bg-white/[0.025] px-4 py-3">
                          <div className="flex items-center justify-between gap-3"><span className={reservation.buyer === "Alice" ? "font-mono text-sm text-cyan-200" : "font-mono text-sm text-amber-200"}>{reservation.buyer}</span><span className={reservation.status === "expired" ? "text-xs uppercase text-slate-500" : "text-xs uppercase text-emerald-300"}>{reservation.status}</span></div>
                          <p className="mt-2 text-xs text-slate-500">{reservation.expiresAt === null ? "No expiry recorded" : reservation.status === "expired" ? "Deadline passed; unit returned" : "Active until its deadline"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between"><p className="eyebrow">Database trace</p><span className="font-mono text-[11px] text-slate-600">run {run.experiment.id.slice(0, 8)}</span></div>
                  <div className="space-y-2 font-mono text-xs sm:text-sm">
                    {run.events.map((event, index) => (
                      <div key={event.id} className="grid grid-cols-[34px_62px_1fr] border border-white/10 bg-white/[0.025] px-3 py-3 sm:grid-cols-[44px_72px_1fr] sm:px-4">
                        <span className="text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                        <span className={event.buyer === "Alice" ? "text-cyan-200" : "text-amber-200"}>{event.buyer}</span>
                        <span className="text-slate-300">{event.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-4">
                  <p className="text-sm text-slate-400">{current.finding}</p>
                  <Button variant="ghost" size="sm" onClick={() => setRun(null)} className="rounded-none text-slate-300 hover:bg-white/5 hover:text-white"><RotateCcw className="size-4" /> Reset</Button>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center justify-between"><p className="eyebrow">Implementation</p><span className="font-mono text-[11px] text-slate-600">purchase.ts</span></div>
            <pre className="mt-5 overflow-x-auto font-mono text-[13px] leading-7 text-slate-300"><code>{current.code.map(([line, role], index) => <span className="block" key={index}><span className="mr-4 inline-block w-4 select-none text-right text-slate-700">{index + 1}</span><span className={role === "gap" ? "text-rose-300" : role === "decision" ? "text-amber-200" : role === "write" ? "text-violet-300" : role === "promise" ? "text-cyan-200" : ""}>{line}</span></span>)}</code></pre>
          </section>
          <section className="border border-white/10 bg-white/[0.025] p-5">
            <p className="eyebrow">What changed</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">{current.explanation}</p>
          </section>
          <section className="border border-white/10 bg-white/[0.025] p-5">
            <p className="eyebrow">What is real here</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">The requests, writes, allocations, holds, expiry timestamps and event trace come from the running service and its persistent database. Stage 05 injects a controlled failure at a precise boundary so its effect is repeatable. Stage 06 uses a real D1 database transaction.</p>
          </section>
        </aside>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 pb-8 lg:px-8" id="performance">
        <div className="border border-white/10 bg-[#0b1118]">
          <div className="grid gap-6 border-b border-white/10 p-5 md:grid-cols-[1fr_auto] md:items-end md:p-7">
            <div className="max-w-3xl">
              <p className="eyebrow">07 · Hosted load test · observed baseline</p>
              <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">More concurrency moves more requests—and makes each buyer wait longer.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">One hot product, 50 units, 100 buyers, one unit per request, using the crash-safe transaction from Stage 06. Each concurrency level ran three times against an isolated Cloudflare Worker and D1 database. Every metric below is the median of its three measurements.</p>
            </div>
            <div className="flex items-center gap-2 border border-cyan-300/20 bg-cyan-300/[0.04] px-3 py-2 font-mono text-[11px] text-cyan-200"><Gauge className="size-3.5" /> CLIENT + SERVER TIMING</div>
          </div>

          <div className="grid gap-px bg-white/10 lg:grid-cols-3">
            {benchmarkScenarios.map((scenario) => (
              <article className="bg-[#0b1118] p-5 sm:p-6" key={scenario.concurrency}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-mono text-sm text-cyan-200"><Users className="size-4" /> {scenario.concurrency} concurrent</span>
                  <span className="font-mono text-[11px] text-emerald-300">{scenario.errors} errors</span>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-5">
                  <div><p className="eyebrow">Throughput</p><p className="mt-2 font-mono text-2xl text-slate-100">{scenario.throughput}<span className="ml-1 text-xs text-slate-500">req/s</span></p></div>
                  <div><p className="eyebrow">Client p95</p><p className="mt-2 font-mono text-2xl text-slate-100">{scenario.p95}<span className="ml-1 text-xs text-slate-500">ms</span></p></div>
                </div>
                <div className="mt-5 h-1.5 bg-white/5"><div className="h-full bg-cyan-300/70" style={{ width: `${Math.min(100, scenario.throughput / 1.2)}%` }} /></div>
                <p className="mt-3 font-mono text-[11px] text-slate-500">server p95 {scenario.serverP95} ms · client p50 {scenario.p50} ms</p>
                <p className="mt-1 font-mono text-[10px] text-slate-600">accepted p95 {scenario.acceptedServerP95} · rejected p95 {scenario.rejectedServerP95} · {scenario.serverTimingSamples}/100 timed</p>
                <p className="mt-2 text-xs text-emerald-300">{scenario.invariantHeld ? "Inventory conserved in all three runs" : "Inventory invariant failed"}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-px border-t border-white/10 bg-white/10 lg:grid-cols-2">
            <article className="bg-[#0b1118] p-5 sm:p-7">
              <p className="eyebrow">Multiple units</p>
              <h3 className="mt-2 text-xl font-medium">300 units requested. Only 150 existed.</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">One hundred buyers requested quantities cycling from 1 to 5. Across all three runs, the conditional update allocated exactly 150 units, returned zero errors, and never made stock negative.</p>
              <pre className="mt-5 overflow-x-auto border border-white/10 bg-black/20 p-4 font-mono text-xs leading-6 text-slate-300"><code>UPDATE experiments{"\n"}SET available = available - ?{"\n"}WHERE id = ? AND available &gt;= ?</code></pre>
              <p className="mt-3 font-mono text-[11px] text-emerald-300">{mixedQuantitySummary.invariantHeld ? "✓ UNIT-LEVEL INVARIANT HELD" : "× INVARIANT FAILED"} · {mixedQuantitySummary.errors} ERRORS</p>
            </article>
            <article className="bg-[#0b1118] p-5 sm:p-7">
              <p className="eyebrow">What the test motivates</p>
              <h3 className="mt-2 text-xl font-medium">From 20 to 50 concurrent: throughput rose 23%; client p95 rose 76%.</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">Concurrency 50 finished more requests each second, but individual buyers waited much longer. The server p95 also rose from 282 ms to 523 ms, so much of the extra wait occurred inside the request path. Higher throughput did not mean a uniformly faster experience.</p>
              <div className="mt-5 border-l-2 border-amber-200/70 bg-amber-200/[0.04] px-4 py-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber-200">Next controlled experiment</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">Keep 100 buyers, 50 units and concurrency 50. Change only the key distribution: one product with 50 units versus ten products with 5 units each.</p>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-600">Exploratory measurements from one Toronto client on September 15, 2026. We will repeat larger runs before publishing a final performance claim.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 pb-8 lg:px-8" id="key-distribution">
        <div className="border border-white/10 bg-[#0b1118]">
          <div className="border-b border-white/10 p-5 sm:p-7">
            <p className="eyebrow">08 · Key distribution · controlled comparison</p>
            <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Is the traffic volume expensive—or is one hot product expensive?</h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">Both workloads send 100 one-unit requests at concurrency 50, contain 50 total units, and use the same Worker and D1 database. Only the destination changes. The first workload targets one inventory record; the second distributes requests evenly across ten records.</p>
          </div>

          <div className="grid gap-px bg-white/10 md:grid-cols-2">
            <ComparisonCard label="One hot product" detail="100 requests → 1 product · 50 units" summary={hotProductComparison} />
            <ComparisonCard label="Ten products" detail="10 requests each → 10 products · 5 units each" summary={tenProductComparison} accent />
          </div>

          <div className="grid gap-px border-t border-white/10 bg-white/10 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="bg-[#0b1118] p-5 sm:p-7">
              <p className="eyebrow">What we observed</p>
              <h3 className="mt-2 text-xl font-medium">The ten-product median handled {distributedThroughputGain}% more requests per second and lowered client p95 by {distributedP95Reduction}%.</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">That points toward hot-key contention contributing to the wait. It is still a clue: one ten-product run was dramatically slower than the other two, and both workloads share one database. Three short runs are too noisy for a capacity claim.</p>
              <div className="mt-5 grid grid-cols-2 gap-px bg-white/10">
                <Metric label="Hot server p95" value={`${hotProductComparison.serverP95}ms`} />
                <Metric label="Distributed server p95" value={`${tenProductComparison.serverP95}ms`} tone="good" />
              </div>
            </article>
            <article className="bg-[#0b1118] p-5 sm:p-7">
              <p className="eyebrow">What the measurement taught us</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">A database row is not the only possible queue. The shared database, its indexes, request routing and network can still affect every product. Before choosing Redis, sharding or another coordinator, we need longer alternating runs and operation-level timing.</p>
              <div className="mt-5 border-l-2 border-amber-200/70 bg-amber-200/[0.04] px-4 py-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber-200">Current conclusion</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">Distribution helped the median, but the experiment has not isolated the exact queue. The next design change must be earned by stronger evidence.</p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}

function ComparisonCard({ label, detail, summary, accent = false }: { label: string; detail: string; summary: ReturnType<typeof summarizeBenchmark>; accent?: boolean }) {
  return (
    <article className={`bg-[#0b1118] p-5 sm:p-7 ${accent ? "shadow-[inset_0_2px_0_rgba(103,232,249,0.55)]" : ""}`}>
      <p className="font-mono text-sm text-cyan-200">{label}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div><p className="eyebrow">Throughput</p><p className="mt-2 font-mono text-xl">{summary.throughput}<span className="ml-1 text-[10px] text-slate-500">req/s</span></p></div>
        <div><p className="eyebrow">Client p95</p><p className="mt-2 font-mono text-xl">{summary.p95}<span className="ml-1 text-[10px] text-slate-500">ms</span></p></div>
        <div><p className="eyebrow">Server p95</p><p className="mt-2 font-mono text-xl">{summary.serverP95}<span className="ml-1 text-[10px] text-slate-500">ms</span></p></div>
      </div>
      <p className="mt-5 font-mono text-[10px] text-slate-600">{summary.accepted} accepted · {summary.rejected} rejected · {summary.serverTimingSamples}/100 server timings</p>
      <p className="mt-2 text-xs text-emerald-300">{summary.invariantHeld ? "Inventory conserved in every run" : "Inventory invariant failed"}</p>
    </article>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return <div className="bg-[#0b1118] p-4"><p className="eyebrow">{label}</p><p className={`mt-2 font-mono text-2xl sm:text-3xl ${tone === "bad" ? "text-rose-300" : tone === "good" ? "text-emerald-300" : "text-slate-100"}`}>{value}</p></div>;
}

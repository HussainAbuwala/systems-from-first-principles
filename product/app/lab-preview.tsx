"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CircleAlert, Clock3, Database, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Version = "naive" | "atomic" | "permanent_hold" | "expiring_hold";
type Event = { id: number; buyer: string; action: string; detail: string; createdAt: number };
type Reservation = {
  id: string;
  buyer: string;
  status: "held" | "expired" | "confirmed";
  expiresAt: number | null;
  abandonedAt: number | null;
  createdAt: number;
  resolvedAt: number | null;
};
type Run = {
  experiment: { id: string; version: Version; initialStock: number; available: number; createdAt: number };
  allocations: Array<{ id: string; buyer: string; createdAt: number }>;
  reservations: Reservation[];
  events: Event[];
  invariant: boolean;
  requirementMet: boolean;
};

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
        commitments: result.allocations.length + result.reservations.filter((reservation) => reservation.status === "held").length,
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
      description: "Run one stage of the inventory system—from the concurrency race through expiring payment holds—and display its database evidence.",
      inputSchema: {
        type: "object",
        properties: { version: { type: "string", enum: ["naive", "atomic", "permanent_hold", "expiring_hold"] } },
        required: ["version"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const candidate = (input as { version?: unknown } | null)?.version;
        if (candidate !== "naive" && candidate !== "atomic" && candidate !== "permanent_hold" && candidate !== "expiring_hold") {
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
  const isHoldVersion = version === "permanent_hold" || version === "expiring_hold";
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
              <h2 className="mt-1 text-lg font-medium">{isHoldVersion ? "One abandoned checkout, one waiting buyer" : "Two buyers, one last pair"}</h2>
            </div>
            <Button disabled={status === "running"} onClick={() => void execute()} className="rounded-none bg-cyan-300 text-slate-950 hover:bg-cyan-200">
              <Play className="size-4" /> {status === "running" ? "Running…" : isHoldVersion ? "Run checkout lifecycle" : "Run two buyers"}
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
                  <Metric label="Trace span" value={`${elapsed}ms`} />
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
                          : `Promises (${run.allocations.length}) must never exceed initial stock (${run.experiment.initialStock}).`}
                    </p>
                  </div>
                </div>

                {isHoldVersion ? (
                  <div className="mt-6">
                    <div className="mb-3 flex items-center justify-between"><p className="eyebrow">Reservation records</p><span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600"><Clock3 className="size-3" /> stored in DB</span></div>
                    <div className="grid gap-2 sm:grid-cols-2">
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
            <p className="mt-3 text-sm leading-6 text-slate-400">The requests, writes, allocations, holds, expiry timestamps and event trace come from the running service and its persistent database. Timers only drive the experiment; the database decides who owns the unit.</p>
          </section>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return <div className="bg-[#0b1118] p-4"><p className="eyebrow">{label}</p><p className={`mt-2 font-mono text-2xl sm:text-3xl ${tone === "bad" ? "text-rose-300" : tone === "good" ? "text-emerald-300" : "text-slate-100"}`}>{value}</p></div>;
}

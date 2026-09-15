import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export const runtime = "edge";

type Experiment = {
  id: string;
  version: string;
  initialStock: number;
  available: number;
  createdAt: number;
};

type AllocationSummary = { acceptedRequests: number; allocatedUnits: number };
type HoldSummary = { activeHolds: number; heldUnits: number };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!env.DB) return NextResponse.json({ error: "The experiment database is unavailable." }, { status: 503 });

  const experiment = await env.DB.prepare(
    "SELECT id, version, initial_stock AS initialStock, available, created_at AS createdAt FROM experiments WHERE id = ?",
  ).bind(id).first<Experiment>();
  if (!experiment) return NextResponse.json({ error: "Experiment not found." }, { status: 404 });

  const [allocations, holds] = await Promise.all([
    env.DB.prepare(
      "SELECT COUNT(*) AS acceptedRequests, COALESCE(SUM(quantity), 0) AS allocatedUnits FROM allocations WHERE experiment_id = ?",
    ).bind(id).first<AllocationSummary>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS activeHolds, COALESCE(SUM(quantity), 0) AS heldUnits FROM reservations WHERE experiment_id = ? AND status = 'held'",
    ).bind(id).first<HoldSummary>(),
  ]);

  const allocatedUnits = Number(allocations?.allocatedUnits ?? 0);
  const heldUnits = Number(holds?.heldUnits ?? 0);
  const committedUnits = allocatedUnits + heldUnits;
  const accountedUnits = Number(experiment.available) + committedUnits;

  return NextResponse.json({
    experiment,
    committedRequests: Number(allocations?.acceptedRequests ?? 0) + Number(holds?.activeHolds ?? 0),
    allocatedUnits,
    activeHolds: Number(holds?.activeHolds ?? 0),
    heldUnits,
    committedUnits,
    accountedUnits,
    invariant: accountedUnits === Number(experiment.initialStock),
  });
}

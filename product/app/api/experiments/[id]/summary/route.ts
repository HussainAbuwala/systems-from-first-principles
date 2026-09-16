import { NextResponse } from "next/server";
import { databaseForExperiment } from "@/lib/experiment-database";

export const runtime = "edge";

type Experiment = {
  id: string;
  version: string;
  initialStock: number;
  available: number;
  createdAt: number;
};

type AllocationSummary = { acceptedRequests: number; allocatedUnits: number };
type HoldSummary = { activeHolds: number; heldUnits: number; confirmedReservations: number; confirmedUnits: number };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const database = databaseForExperiment(id);
  if (!database) return NextResponse.json({ error: "The experiment database is unavailable." }, { status: 503 });

  const experiment = await database.prepare(
    "SELECT id, version, initial_stock AS initialStock, available, created_at AS createdAt FROM experiments WHERE id = ?",
  ).bind(id).first<Experiment>();
  if (!experiment) return NextResponse.json({ error: "Experiment not found." }, { status: 404 });

  const [allocations, holds] = await Promise.all([
    database.prepare(
      "SELECT COUNT(*) AS acceptedRequests, COALESCE(SUM(quantity), 0) AS allocatedUnits FROM allocations WHERE experiment_id = ?",
    ).bind(id).first<AllocationSummary>(),
    database.prepare(
      `SELECT
        SUM(CASE WHEN status = 'held' THEN 1 ELSE 0 END) AS activeHolds,
        COALESCE(SUM(CASE WHEN status = 'held' THEN quantity ELSE 0 END), 0) AS heldUnits,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmedReservations,
        COALESCE(SUM(CASE WHEN status = 'confirmed' THEN quantity ELSE 0 END), 0) AS confirmedUnits
       FROM reservations WHERE experiment_id = ? AND status IN ('held', 'confirmed')`,
    ).bind(id).first<HoldSummary>(),
  ]);

  const allocatedUnits = Number(allocations?.allocatedUnits ?? 0);
  const heldUnits = Number(holds?.heldUnits ?? 0);
  const confirmedUnits = Number(holds?.confirmedUnits ?? 0);
  const committedUnits = allocatedUnits + heldUnits + confirmedUnits;
  const accountedUnits = Number(experiment.available) + committedUnits;

  return NextResponse.json({
    experiment,
    committedRequests: Number(allocations?.acceptedRequests ?? 0) + Number(holds?.activeHolds ?? 0) + Number(holds?.confirmedReservations ?? 0),
    allocatedUnits,
    activeHolds: Number(holds?.activeHolds ?? 0),
    heldUnits,
    confirmedReservations: Number(holds?.confirmedReservations ?? 0),
    confirmedUnits,
    committedUnits,
    accountedUnits,
    invariant: accountedUnits === Number(experiment.initialStock),
  });
}

import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!env.DB) return NextResponse.json({ error: "The experiment database is unavailable." }, { status: 503 });

  const experiment = await env.DB.prepare(
    "SELECT id, version, initial_stock AS initialStock, available, created_at AS createdAt FROM experiments WHERE id = ?",
  ).bind(id).first();
  if (!experiment) return NextResponse.json({ error: "Experiment not found." }, { status: 404 });

  const [allocations, reservations, events] = await Promise.all([
    env.DB.prepare("SELECT id, buyer, quantity, created_at AS createdAt FROM allocations WHERE experiment_id = ? ORDER BY created_at, buyer").bind(id).all(),
    env.DB.prepare(
      "SELECT id, buyer, quantity, status, expires_at AS expiresAt, abandoned_at AS abandonedAt, created_at AS createdAt, resolved_at AS resolvedAt FROM reservations WHERE experiment_id = ? ORDER BY created_at, buyer",
    ).bind(id).all(),
    env.DB.prepare("SELECT id, buyer, action, detail, created_at AS createdAt FROM experiment_events WHERE experiment_id = ? ORDER BY id").bind(id).all(),
  ]);

  const activeHolds = reservations.results.filter((reservation) => reservation.status === "held");
  const commitments = allocations.results.reduce((total, allocation) => total + Number(allocation.quantity), 0)
    + activeHolds.reduce((total, reservation) => total + Number(reservation.quantity), 0);
  const accountedUnits = Number(experiment.available) + commitments;
  const invariant = accountedUnits === Number(experiment.initialStock);
  const requirementMet = experiment.version === "permanent_hold"
    ? !activeHolds.some((reservation) => reservation.abandonedAt !== null)
    : experiment.version === "expiring_hold"
      ? reservations.results.some((reservation) => reservation.buyer === "Alice" && reservation.status === "expired")
        && activeHolds.some((reservation) => reservation.buyer === "Bob")
      : experiment.version === "crash_gap"
        ? invariant
        : experiment.version === "transactional_hold"
          ? invariant && activeHolds.some((reservation) => reservation.buyer === "Alice")
      : invariant;

  return NextResponse.json({
    experiment,
    allocations: allocations.results,
    reservations: reservations.results,
    events: events.results,
    invariant,
    accountedUnits,
    requirementMet,
  });
}

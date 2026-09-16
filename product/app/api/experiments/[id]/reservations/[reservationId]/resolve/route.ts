import { NextResponse } from "next/server";
import { experimentWritesEnabled, readOnlyExperimentResponse } from "@/lib/experiment-access";
import { databaseForExperiment } from "@/lib/experiment-database";
import { resolveReservation, type ResolutionAction } from "@/lib/reservation-lifecycle";

export const runtime = "edge";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; reservationId: string }> },
) {
  if (!experimentWritesEnabled()) return readOnlyExperimentResponse();

  const { id, reservationId } = await params;
  const body = (await request.json().catch(() => null)) as { action?: unknown; eventKey?: unknown } | null;
  const action = body?.action;
  const eventKey = typeof body?.eventKey === "string" ? body.eventKey.trim() : "";
  if (action !== "confirm" && action !== "cancel") {
    return NextResponse.json({ error: "Action must be confirm or cancel." }, { status: 400 });
  }
  if (eventKey.length < 1 || eventKey.length > 128) {
    return NextResponse.json({ error: "Payment event key must contain 1 to 128 characters." }, { status: 400 });
  }

  const database = databaseForExperiment(id);
  if (!database) return NextResponse.json({ error: "The experiment database is unavailable." }, { status: 503 });
  const result = await resolveReservation(database, {
    experimentId: id,
    reservationId,
    action: action as ResolutionAction,
    eventKey,
  });

  if (result.outcome === "not_found") return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  if (result.outcome === "conflict" || result.outcome === "not_due") {
    return NextResponse.json({ error: "The payment event conflicts with the reservation's current state." }, { status: 409 });
  }
  if (!result.reservation) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  return NextResponse.json({
    reservationId,
    status: result.reservation.status,
    applied: result.outcome === "applied",
    replayed: result.outcome === "replayed",
  });
}

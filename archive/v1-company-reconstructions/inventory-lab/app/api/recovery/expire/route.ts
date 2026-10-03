import { NextResponse } from "next/server";
import { experimentWritesEnabled, readOnlyExperimentResponse } from "@/lib/experiment-access";
import { databaseForExperiment } from "@/lib/experiment-database";
import { sweepExpiredReservations } from "@/lib/reservation-lifecycle";

export const runtime = "edge";

export async function POST(request: Request) {
  if (!experimentWritesEnabled()) return readOnlyExperimentResponse();

  const body = (await request.json().catch(() => null)) as { experimentId?: unknown } | null;
  const experimentId = typeof body?.experimentId === "string" ? body.experimentId : "";
  if (!experimentId) return NextResponse.json({ error: "Experiment ID is required." }, { status: 400 });
  const database = databaseForExperiment(experimentId);
  if (!database) return NextResponse.json({ error: "The experiment database is unavailable." }, { status: 503 });

  return NextResponse.json(await sweepExpiredReservations(database, { experimentId }));
}

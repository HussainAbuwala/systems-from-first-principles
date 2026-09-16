import { NextResponse } from "next/server";
import { BENCHMARK_DATABASE_SHARDS, createExperimentId, databaseForShard } from "@/lib/experiment-database";
import { experimentWritesEnabled, readOnlyExperimentResponse } from "@/lib/experiment-access";

export const runtime = "edge";

const versions = ["naive", "atomic", "permanent_hold", "expiring_hold", "crash_gap", "transactional_hold", "idempotent_hold"] as const;
type Version = (typeof versions)[number];

function isVersion(value: unknown): value is Version {
  return typeof value === "string" && versions.includes(value as Version);
}

export async function POST(request: Request) {
  if (!experimentWritesEnabled()) return readOnlyExperimentResponse();

  const body = (await request.json().catch(() => null)) as {
    version?: unknown;
    initialStock?: unknown;
    databaseShard?: unknown;
  } | null;
  const version = body?.version;
  if (!isVersion(version)) {
    return NextResponse.json({ error: "Unknown experiment version." }, { status: 400 });
  }
  const requestedStock = body?.initialStock === undefined ? 1 : Number(body.initialStock);
  if (!Number.isInteger(requestedStock) || requestedStock < 1 || requestedStock > 10_000) {
    return NextResponse.json({ error: "Initial stock must be an integer from 1 to 10,000." }, { status: 400 });
  }

  const requestedShard = body?.databaseShard === undefined ? null : Number(body.databaseShard);
  if (requestedShard !== null && (!Number.isInteger(requestedShard) || requestedShard < 0 || requestedShard >= BENCHMARK_DATABASE_SHARDS)) {
    return NextResponse.json({ error: `Database shard must be an integer from 0 to ${BENCHMARK_DATABASE_SHARDS - 1}.` }, { status: 400 });
  }
  const database = databaseForShard(requestedShard ?? 0);
  if (!database) return NextResponse.json({ error: "The requested experiment database is unavailable." }, { status: 503 });

  const id = createExperimentId(requestedShard);
  await database.prepare(
    "INSERT INTO experiments (id, version, initial_stock, available, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, version, requestedStock, requestedStock, Date.now()).run();

  return NextResponse.json({ id, version, initialStock: requestedStock, available: requestedStock, databaseShard: requestedShard ?? 0 });
}

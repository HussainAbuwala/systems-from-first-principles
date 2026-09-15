import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export const runtime = "edge";

const versions = ["naive", "atomic", "permanent_hold", "expiring_hold", "crash_gap", "transactional_hold"] as const;
type Version = (typeof versions)[number];

function isVersion(value: unknown): value is Version {
  return typeof value === "string" && versions.includes(value as Version);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { version?: unknown; initialStock?: unknown } | null;
  const version = body?.version;
  if (!isVersion(version)) {
    return NextResponse.json({ error: "Unknown experiment version." }, { status: 400 });
  }
  if (!env.DB) return NextResponse.json({ error: "The experiment database is unavailable." }, { status: 503 });

  const requestedStock = body?.initialStock === undefined ? 1 : Number(body.initialStock);
  if (!Number.isInteger(requestedStock) || requestedStock < 1 || requestedStock > 10_000) {
    return NextResponse.json({ error: "Initial stock must be an integer from 1 to 10,000." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO experiments (id, version, initial_stock, available, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(id, version, requestedStock, requestedStock, Date.now()).run();

  return NextResponse.json({ id, version, initialStock: requestedStock, available: requestedStock });
}

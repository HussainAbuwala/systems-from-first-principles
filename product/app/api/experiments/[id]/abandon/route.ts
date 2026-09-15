import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { buyer?: unknown } | null;
  const buyer = typeof body?.buyer === "string" ? body.buyer.trim().slice(0, 24) : "";
  if (!buyer) return NextResponse.json({ error: "Buyer is required." }, { status: 400 });
  if (!env.DB) return NextResponse.json({ error: "The experiment database is unavailable." }, { status: 503 });

  const now = Date.now();
  const abandoned = await env.DB.prepare(
    "UPDATE reservations SET abandoned_at = ? WHERE experiment_id = ? AND buyer = ? AND status = 'held' AND abandoned_at IS NULL",
  ).bind(now, id, buyer).run();

  if (Number(abandoned.meta.changes ?? 0) !== 1) {
    return NextResponse.json({ error: "Active hold not found." }, { status: 404 });
  }

  await env.DB.prepare(
    "INSERT INTO experiment_events (experiment_id, buyer, action, detail, created_at) VALUES (?, ?, 'abandon', ?, ?)",
  ).bind(id, buyer, "leaves checkout without completing payment", now).run();

  return NextResponse.json({ buyer, abandoned: true });
}

import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export const runtime = "edge";
type Version = "naive" | "atomic" | "permanent_hold" | "expiring_hold";
type Experiment = { id: string; version: Version; available: number };
type ExpiredReservation = { id: string; buyer: string };

const HOLD_DURATION_MS = 1_200;

async function record(experimentId: string, buyer: string, action: string, detail: string) {
  await env.DB!.prepare(
    "INSERT INTO experiment_events (experiment_id, buyer, action, detail, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(experimentId, buyer, action, detail, Date.now()).run();
}

async function releaseExpiredHolds(experimentId: string, now: number) {
  const candidates = await env.DB!.prepare(
    "SELECT id, buyer FROM reservations WHERE experiment_id = ? AND status = 'held' AND expires_at IS NOT NULL AND expires_at <= ?",
  ).bind(experimentId, now).all<ExpiredReservation>();

  for (const reservation of candidates.results) {
    const expired = await env.DB!.prepare(
      "UPDATE reservations SET status = 'expired', resolved_at = ? WHERE id = ? AND status = 'held' AND expires_at <= ?",
    ).bind(now, reservation.id, now).run();

    if (Number(expired.meta.changes ?? 0) !== 1) continue;

    await env.DB!.batch([
      env.DB!.prepare("UPDATE experiments SET available = available + 1 WHERE id = ?").bind(experimentId),
      env.DB!.prepare(
        "INSERT INTO experiment_events (experiment_id, buyer, action, detail, created_at) VALUES (?, ?, 'expire', ?, ?)",
      ).bind(experimentId, "System", `${reservation.buyer}'s hold expires; returns 1 unit to stock`, now),
    ]);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { buyer?: unknown } | null;
  const buyer = typeof body?.buyer === "string" ? body.buyer.trim().slice(0, 24) : "";
  if (!buyer) return NextResponse.json({ error: "Buyer is required." }, { status: 400 });
  if (!env.DB) return NextResponse.json({ error: "The experiment database is unavailable." }, { status: 503 });

  const experiment = await env.DB.prepare(
    "SELECT id, version, available FROM experiments WHERE id = ?",
  ).bind(id).first<Experiment>();
  if (!experiment) return NextResponse.json({ error: "Experiment not found." }, { status: 404 });

  if (experiment.version === "naive") {
    await record(id, buyer, "read", `reads available = ${experiment.available}`);
    if (experiment.available <= 0) {
      await record(id, buyer, "reject", "sees no stock and rejects the request");
      return NextResponse.json({ buyer, accepted: false });
    }

    // The delay makes the unsafe gap repeatable. The reads and writes around it
    // still execute against the real database, as ordinary request code would.
    await new Promise((resolve) => setTimeout(resolve, 180));
    await env.DB.batch([
      env.DB.prepare("UPDATE experiments SET available = ? WHERE id = ?").bind(experiment.available - 1, id),
      env.DB.prepare(
        "INSERT INTO allocations (id, experiment_id, buyer, created_at) VALUES (?, ?, ?, ?)",
      ).bind(crypto.randomUUID(), id, buyer, Date.now()),
      env.DB.prepare(
        "INSERT INTO experiment_events (experiment_id, buyer, action, detail, created_at) VALUES (?, ?, 'write', ?, ?)",
      ).bind(id, buyer, `writes available = ${experiment.available - 1}; promises the unit`, Date.now()),
    ]);
    return NextResponse.json({ buyer, accepted: true });
  }

  if (experiment.version === "expiring_hold") {
    await releaseExpiredHolds(id, Date.now());
  }

  const update = await env.DB.prepare(
    "UPDATE experiments SET available = available - 1 WHERE id = ? AND available > 0",
  ).bind(id).run();
  const accepted = Number(update.meta.changes ?? 0) === 1;

  if (experiment.version === "permanent_hold" || experiment.version === "expiring_hold") {
    if (accepted) {
      const now = Date.now();
      const expiresAt = experiment.version === "expiring_hold" ? now + HOLD_DURATION_MS : null;
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO reservations (id, experiment_id, buyer, status, expires_at, abandoned_at, created_at, resolved_at) VALUES (?, ?, ?, 'held', ?, NULL, ?, NULL)",
        ).bind(crypto.randomUUID(), id, buyer, expiresAt, now),
        env.DB.prepare(
          "INSERT INTO experiment_events (experiment_id, buyer, action, detail, created_at) VALUES (?, ?, 'hold', ?, ?)",
        ).bind(
          id,
          buyer,
          expiresAt === null
            ? "atomically subtracts 1; stores a hold with no expiry"
            : `atomically subtracts 1; stores a hold for ${HOLD_DURATION_MS}ms`,
          now,
        ),
      ]);
    } else {
      await record(id, buyer, "reject", "sees 0 available; cannot start payment");
    }
    return NextResponse.json({ buyer, accepted });
  }

  if (accepted) {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO allocations (id, experiment_id, buyer, created_at) VALUES (?, ?, ?, ?)",
      ).bind(crypto.randomUUID(), id, buyer, Date.now()),
      env.DB.prepare(
        "INSERT INTO experiment_events (experiment_id, buyer, action, detail, created_at) VALUES (?, ?, 'atomic', ?, ?)",
      ).bind(id, buyer, "checks and subtracts together; promises the unit", Date.now()),
    ]);
  } else {
    await record(id, buyer, "reject", "atomic update changes 0 rows; rejects the request");
  }
  return NextResponse.json({ buyer, accepted });
}

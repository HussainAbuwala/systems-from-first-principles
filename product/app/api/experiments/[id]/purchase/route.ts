import { NextResponse } from "next/server";
import { databaseForExperiment } from "@/lib/experiment-database";
import { experimentWritesEnabled, readOnlyExperimentResponse } from "@/lib/experiment-access";

export const runtime = "edge";
type Version = "naive" | "atomic" | "permanent_hold" | "expiring_hold" | "crash_gap" | "transactional_hold" | "idempotent_hold";
type Experiment = { id: string; version: Version; available: number };
type ExpiredReservation = { id: string; buyer: string; quantity: number };
type ExistingReservation = { id: string; buyer: string; quantity: number; status: string };

const HOLD_DURATION_MS = 1_200;

async function record(database: D1Database, experimentId: string, buyer: string, action: string, detail: string) {
  await database.prepare(
    "INSERT INTO experiment_events (experiment_id, buyer, action, detail, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(experimentId, buyer, action, detail, Date.now()).run();
}

async function releaseExpiredHolds(database: D1Database, experimentId: string, now: number) {
  const candidates = await database.prepare(
    "SELECT id, buyer, quantity FROM reservations WHERE experiment_id = ? AND status = 'held' AND expires_at IS NOT NULL AND expires_at <= ?",
  ).bind(experimentId, now).all<ExpiredReservation>();

  for (const reservation of candidates.results) {
    const expired = await database.prepare(
      "UPDATE reservations SET status = 'expired', resolved_at = ? WHERE id = ? AND status = 'held' AND expires_at <= ?",
    ).bind(now, reservation.id, now).run();

    if (Number(expired.meta.changes ?? 0) !== 1) continue;

    await database.batch([
      database.prepare("UPDATE experiments SET available = available + ? WHERE id = ?").bind(reservation.quantity, experimentId),
      database.prepare(
        "INSERT INTO experiment_events (experiment_id, buyer, action, detail, created_at) VALUES (?, ?, 'expire', ?, ?)",
      ).bind(experimentId, "System", `${reservation.buyer}'s hold expires; returns ${reservation.quantity} unit(s) to stock`, now),
    ]);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!experimentWritesEnabled()) return readOnlyExperimentResponse();

  const requestStartedAt = performance.now();
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    buyer?: unknown;
    quantity?: unknown;
    simulateResponseLoss?: unknown;
    captureTrace?: unknown;
    idempotencyKey?: unknown;
  } | null;
  const buyer = typeof body?.buyer === "string" ? body.buyer.trim().slice(0, 24) : "";
  if (!buyer) return NextResponse.json({ error: "Buyer is required." }, { status: 400 });
  const quantity = body?.quantity === undefined ? 1 : Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1_000) {
    return NextResponse.json({ error: "Quantity must be an integer from 1 to 1,000." }, { status: 400 });
  }
  const database = databaseForExperiment(id);
  if (!database) return NextResponse.json({ error: "The experiment database is unavailable." }, { status: 503 });

  const requestParsedAt = performance.now();
  const lookupStartedAt = performance.now();
  const experiment = await database.prepare(
    "SELECT id, version, available FROM experiments WHERE id = ?",
  ).bind(id).first<Experiment>();
  const lookupFinishedAt = performance.now();
  if (!experiment) return NextResponse.json({ error: "Experiment not found." }, { status: 404 });

  if (experiment.version === "naive") {
    await record(database, id, buyer, "read", `reads available = ${experiment.available}`);
    if (experiment.available < quantity) {
      await record(database, id, buyer, "reject", "sees no stock and rejects the request");
      return NextResponse.json({ buyer, quantity, accepted: false });
    }

    // The delay makes the unsafe gap repeatable. The reads and writes around it
    // still execute against the real database, as ordinary request code would.
    await new Promise((resolve) => setTimeout(resolve, 180));
    await database.batch([
      database.prepare("UPDATE experiments SET available = ? WHERE id = ?").bind(experiment.available - quantity, id),
      database.prepare(
        "INSERT INTO allocations (id, experiment_id, buyer, quantity, created_at) VALUES (?, ?, ?, ?, ?)",
      ).bind(crypto.randomUUID(), id, buyer, quantity, Date.now()),
      database.prepare(
        "INSERT INTO experiment_events (experiment_id, buyer, action, detail, created_at) VALUES (?, ?, 'write', ?, ?)",
      ).bind(id, buyer, `writes available = ${experiment.available - quantity}; promises ${quantity} unit(s)`, Date.now()),
    ]);
    return NextResponse.json({ buyer, quantity, accepted: true });
  }

  if (experiment.version === "expiring_hold") {
    await releaseExpiredHolds(database, id, Date.now());
  }

  if (experiment.version === "crash_gap") {
    const update = await database.prepare(
      "UPDATE experiments SET available = available - ? WHERE id = ? AND available >= ?",
    ).bind(quantity, id, quantity).run();
    const accepted = Number(update.meta.changes ?? 0) === 1;
    if (!accepted) {
      await record(database, id, buyer, "reject", "atomic subtraction changes 0 rows");
      return NextResponse.json({ buyer, quantity, accepted: false });
    }

    await record(database, id, buyer, "crash", "stock subtraction commits; simulated process crash occurs before hold insert");
    return NextResponse.json(
      { buyer, quantity, accepted: false, simulatedCrash: true, committed: "stock_only" },
      { status: 503 },
    );
  }

  if (experiment.version === "transactional_hold" || experiment.version === "idempotent_hold") {
    const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    if (experiment.version === "idempotent_hold" && (idempotencyKey.length < 1 || idempotencyKey.length > 64)) {
      return NextResponse.json({ error: "Idempotency key must contain 1 to 64 characters." }, { status: 400 });
    }
    const now = Date.now();
    const reservationId = crypto.randomUUID();
    const expiresAt = now + HOLD_DURATION_MS;
    const captureTrace = body?.captureTrace !== false;
    const insertSql = experiment.version === "idempotent_hold"
      ? "INSERT OR IGNORE INTO reservations (id, experiment_id, buyer, quantity, idempotency_key, status, expires_at, abandoned_at, created_at, resolved_at) SELECT ?, id, ?, ?, ?, 'held', ?, NULL, ?, NULL FROM experiments WHERE id = ? AND available >= ?"
      : "INSERT INTO reservations (id, experiment_id, buyer, quantity, idempotency_key, status, expires_at, abandoned_at, created_at, resolved_at) SELECT ?, id, ?, ?, NULL, 'held', ?, NULL, ?, NULL FROM experiments WHERE id = ? AND available >= ?";
    const statements = [
      experiment.version === "idempotent_hold"
        ? database.prepare(insertSql).bind(reservationId, buyer, quantity, idempotencyKey, expiresAt, now, id, quantity)
        : database.prepare(insertSql).bind(reservationId, buyer, quantity, expiresAt, now, id, quantity),
      database.prepare(
        "UPDATE experiments SET available = available - ? WHERE id = ? AND EXISTS (SELECT 1 FROM reservations WHERE id = ?)",
      ).bind(quantity, id, reservationId),
    ];
    if (captureTrace) {
      statements.push(database.prepare(
        "INSERT INTO experiment_events (experiment_id, buyer, action, detail, created_at) SELECT ?, ?, 'transaction', ?, ? WHERE EXISTS (SELECT 1 FROM reservations WHERE id = ?)",
      ).bind(
        id,
        buyer,
        experiment.version === "idempotent_hold"
          ? "stock subtraction and keyed hold commit in one transaction"
          : "stock subtraction and hold commit in one transaction; response is lost afterward",
        now,
        reservationId,
      ));
    }

    const transactionStartedAt = performance.now();
    const [hold] = await database.batch(statements);
    const transactionFinishedAt = performance.now();
    const inserted = Number(hold.meta.changes ?? 0) === 1;
    let replayed = false;
    let existingReservation: ExistingReservation | null = null;
    if (!inserted && experiment.version === "idempotent_hold") {
      existingReservation = await database.prepare(
        "SELECT id, buyer, quantity, status FROM reservations WHERE experiment_id = ? AND idempotency_key = ?",
      ).bind(id, idempotencyKey).first<ExistingReservation>();
      if (existingReservation && (existingReservation.buyer !== buyer || Number(existingReservation.quantity) !== quantity)) {
        return NextResponse.json(
          { error: "This idempotency key was already used for a different purchase." },
          { status: 409 },
        );
      }
      replayed = existingReservation !== null;
    }
    const accepted = inserted || replayed;
    let traceDurationMs = 0;
    if (!accepted) {
      if (captureTrace) {
        const traceStartedAt = performance.now();
        await record(database, id, buyer, "reject", "transaction creates no hold because stock is unavailable");
        traceDurationMs = performance.now() - traceStartedAt;
      }
      const responseStartedAt = performance.now();
      return NextResponse.json({
        buyer,
        quantity,
        accepted: false,
        serverDurationMs: Number((responseStartedAt - requestStartedAt).toFixed(2)),
        serverTimings: {
          parseMs: Number((requestParsedAt - requestStartedAt).toFixed(2)),
          lookupMs: Number((lookupFinishedAt - lookupStartedAt).toFixed(2)),
          transactionMs: Number((transactionFinishedAt - transactionStartedAt).toFixed(2)),
          traceMs: Number(traceDurationMs.toFixed(2)),
        },
      });
    }

    if (experiment.version === "idempotent_hold" && replayed) {
      if (captureTrace) await record(database, id, buyer, "replay", "retry returns the existing hold without subtracting stock again");
      return NextResponse.json({
        buyer,
        quantity,
        accepted: true,
        replayed: true,
        reservationId: existingReservation?.id,
      });
    }

    if (experiment.version === "idempotent_hold" && body?.simulateResponseLoss === true) {
      if (captureTrace) await record(database, id, buyer, "response_loss", "hold committed, but its response never reached the client");
      return NextResponse.json(
        { buyer, quantity, accepted: false, simulatedResponseLoss: true, committed: "stock_and_hold" },
        { status: 503 },
      );
    }

    if (experiment.version === "idempotent_hold" || body?.simulateResponseLoss === false) {
      const responseStartedAt = performance.now();
      return NextResponse.json({
        buyer,
        quantity,
        accepted: true,
        replayed: false,
        reservationId,
        serverDurationMs: Number((responseStartedAt - requestStartedAt).toFixed(2)),
        serverTimings: {
          parseMs: Number((requestParsedAt - requestStartedAt).toFixed(2)),
          lookupMs: Number((lookupFinishedAt - lookupStartedAt).toFixed(2)),
          transactionMs: Number((transactionFinishedAt - transactionStartedAt).toFixed(2)),
          traceMs: 0,
        },
      });
    }

    return NextResponse.json(
      { buyer, quantity, accepted: false, simulatedCrash: true, committed: "stock_and_hold" },
      { status: 503 },
    );
  }

  const update = await database.prepare(
    "UPDATE experiments SET available = available - ? WHERE id = ? AND available >= ?",
  ).bind(quantity, id, quantity).run();
  const accepted = Number(update.meta.changes ?? 0) === 1;

  if (experiment.version === "permanent_hold" || experiment.version === "expiring_hold") {
    if (accepted) {
      const now = Date.now();
      const expiresAt = experiment.version === "expiring_hold" ? now + HOLD_DURATION_MS : null;
      await database.batch([
        database.prepare(
          "INSERT INTO reservations (id, experiment_id, buyer, quantity, status, expires_at, abandoned_at, created_at, resolved_at) VALUES (?, ?, ?, ?, 'held', ?, NULL, ?, NULL)",
        ).bind(crypto.randomUUID(), id, buyer, quantity, expiresAt, now),
        database.prepare(
          "INSERT INTO experiment_events (experiment_id, buyer, action, detail, created_at) VALUES (?, ?, 'hold', ?, ?)",
        ).bind(
          id,
          buyer,
          expiresAt === null
            ? `atomically subtracts ${quantity}; stores a hold with no expiry`
            : `atomically subtracts ${quantity}; stores a hold for ${HOLD_DURATION_MS}ms`,
          now,
        ),
      ]);
    } else {
      await record(database, id, buyer, "reject", "sees 0 available; cannot start payment");
    }
    return NextResponse.json({ buyer, quantity, accepted });
  }

  if (accepted) {
    await database.batch([
      database.prepare(
        "INSERT INTO allocations (id, experiment_id, buyer, quantity, created_at) VALUES (?, ?, ?, ?, ?)",
      ).bind(crypto.randomUUID(), id, buyer, quantity, Date.now()),
      database.prepare(
        "INSERT INTO experiment_events (experiment_id, buyer, action, detail, created_at) VALUES (?, ?, 'atomic', ?, ?)",
      ).bind(id, buyer, `checks and subtracts together; promises ${quantity} unit(s)`, Date.now()),
    ]);
  } else {
    await record(database, id, buyer, "reject", "atomic update changes 0 rows; rejects the request");
  }
  return NextResponse.json({
    buyer,
    quantity,
    accepted,
    serverDurationMs: Number((performance.now() - requestStartedAt).toFixed(2)),
  });
}

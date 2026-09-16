export type ResolutionAction = "confirm" | "cancel" | "expire";

type ReservationState = {
  id: string;
  experimentId: string;
  buyer: string;
  quantity: number;
  status: "held" | "confirmed" | "cancelled" | "expired";
  expiresAt: number | null;
};

type StoredCommand = {
  eventKey: string;
  attemptId: string;
  experimentId: string;
  reservationId: string;
  action: ResolutionAction;
};

export type ResolutionResult =
  | { outcome: "applied" | "replayed"; reservation: ReservationState }
  | { outcome: "not_found" | "not_due" | "conflict"; reservation: ReservationState | null };

const statusForAction = (action: ResolutionAction) => action === "confirm" ? "confirmed" : action === "cancel" ? "cancelled" : "expired";

const detailForAction = (action: ResolutionAction) => {
  if (action === "confirm") return "payment succeeded; the held units are confirmed";
  if (action === "cancel") return "payment failed; the held units return to stock";
  return "the hold deadline passed; the held units return to stock";
};

async function readReservation(database: D1Database, experimentId: string, reservationId: string) {
  return database.prepare(
    "SELECT id, experiment_id AS experimentId, buyer, quantity, status, expires_at AS expiresAt FROM reservations WHERE id = ? AND experiment_id = ?",
  ).bind(reservationId, experimentId).first<ReservationState>();
}

export async function resolveReservation(
  database: D1Database,
  input: {
    experimentId: string;
    reservationId: string;
    action: ResolutionAction;
    eventKey: string;
    now?: number;
  },
): Promise<ResolutionResult> {
  const now = input.now ?? Date.now();
  const attemptId = crypto.randomUUID();
  const targetStatus = statusForAction(input.action);
  const eligibility = input.action === "expire"
    ? "id = ? AND experiment_id = ? AND status = 'held' AND expires_at IS NOT NULL AND expires_at <= ?"
    : "id = ? AND experiment_id = ? AND status = 'held'";
  const insert = input.action === "expire"
    ? database.prepare(
      `INSERT OR IGNORE INTO reservation_commands (event_key, attempt_id, experiment_id, reservation_id, action, created_at)
       SELECT ?, ?, ?, ?, ?, ? FROM reservations WHERE ${eligibility}`,
    ).bind(input.eventKey, attemptId, input.experimentId, input.reservationId, input.action, now, input.reservationId, input.experimentId, now)
    : database.prepare(
      `INSERT OR IGNORE INTO reservation_commands (event_key, attempt_id, experiment_id, reservation_id, action, created_at)
       SELECT ?, ?, ?, ?, ?, ? FROM reservations WHERE ${eligibility}`,
    ).bind(input.eventKey, attemptId, input.experimentId, input.reservationId, input.action, now, input.reservationId, input.experimentId);

  const statements = [
    insert,
    database.prepare(
      `UPDATE reservations SET status = ?, resolved_at = ?
       WHERE id = ? AND experiment_id = ? AND status = 'held'
       AND EXISTS (SELECT 1 FROM reservation_commands WHERE event_key = ? AND attempt_id = ?)`,
    ).bind(targetStatus, now, input.reservationId, input.experimentId, input.eventKey, attemptId),
  ];

  if (input.action !== "confirm") {
    statements.push(database.prepare(
      `UPDATE experiments
       SET available = available + (SELECT quantity FROM reservations WHERE id = ? AND experiment_id = ?)
       WHERE id = ? AND EXISTS (SELECT 1 FROM reservation_commands WHERE event_key = ? AND attempt_id = ?)`,
    ).bind(input.reservationId, input.experimentId, input.experimentId, input.eventKey, attemptId));
  }

  statements.push(database.prepare(
    `INSERT INTO experiment_events (experiment_id, buyer, action, detail, created_at)
     SELECT experiment_id, buyer, ?, ?, ? FROM reservations
     WHERE id = ? AND experiment_id = ?
     AND EXISTS (SELECT 1 FROM reservation_commands WHERE event_key = ? AND attempt_id = ?)`,
  ).bind(input.action, detailForAction(input.action), now, input.reservationId, input.experimentId, input.eventKey, attemptId));

  await database.batch(statements);
  const [command, reservation] = await Promise.all([
    database.prepare(
      "SELECT event_key AS eventKey, attempt_id AS attemptId, experiment_id AS experimentId, reservation_id AS reservationId, action FROM reservation_commands WHERE event_key = ?",
    ).bind(input.eventKey).first<StoredCommand>(),
    readReservation(database, input.experimentId, input.reservationId),
  ]);

  if (!reservation) return { outcome: "not_found", reservation: null };
  if (!command) {
    if (input.action === "expire" && reservation.status === "held" && (reservation.expiresAt === null || reservation.expiresAt > now)) {
      return { outcome: "not_due", reservation };
    }
    return { outcome: "conflict", reservation };
  }
  if (command.experimentId !== input.experimentId || command.reservationId !== input.reservationId || command.action !== input.action) {
    return { outcome: "conflict", reservation };
  }

  return { outcome: command.attemptId === attemptId ? "applied" : "replayed", reservation };
}

export async function sweepExpiredReservations(
  database: D1Database,
  options: { experimentId?: string; now?: number; limit?: number } = {},
) {
  const now = options.now ?? Date.now();
  const limit = Math.min(Math.max(Math.floor(options.limit ?? 100), 1), 500);
  const candidates = options.experimentId
    ? await database.prepare(
      "SELECT id, experiment_id AS experimentId FROM reservations WHERE experiment_id = ? AND status = 'held' AND expires_at IS NOT NULL AND expires_at <= ? ORDER BY expires_at LIMIT ?",
    ).bind(options.experimentId, now, limit).all<{ id: string; experimentId: string }>()
    : await database.prepare(
      "SELECT id, experiment_id AS experimentId FROM reservations WHERE status = 'held' AND expires_at IS NOT NULL AND expires_at <= ? ORDER BY expires_at LIMIT ?",
    ).bind(now, limit).all<{ id: string; experimentId: string }>();

  let expired = 0;
  for (const reservation of candidates.results) {
    const result = await resolveReservation(database, {
      experimentId: reservation.experimentId,
      reservationId: reservation.id,
      action: "expire",
      eventKey: `expiry:${reservation.id}`,
      now,
    });
    if (result.outcome === "applied") expired += 1;
  }
  return { scanned: candidates.results.length, expired };
}

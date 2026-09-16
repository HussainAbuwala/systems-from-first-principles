import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const experiments = sqliteTable("experiments", {
  id: text("id").primaryKey(),
  version: text("version", { enum: ["naive", "atomic", "permanent_hold", "expiring_hold", "crash_gap", "transactional_hold", "idempotent_hold"] }).notNull(),
  initialStock: integer("initial_stock").notNull(),
  available: integer("available").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const allocations = sqliteTable("allocations", {
  id: text("id").primaryKey(),
  experimentId: text("experiment_id").notNull(),
  buyer: text("buyer").notNull(),
  quantity: integer("quantity").notNull().default(1),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("idx_allocations_experiment_id").on(table.experimentId)]);

export const reservations = sqliteTable("reservations", {
  id: text("id").primaryKey(),
  experimentId: text("experiment_id").notNull(),
  buyer: text("buyer").notNull(),
  quantity: integer("quantity").notNull().default(1),
  idempotencyKey: text("idempotency_key"),
  status: text("status", { enum: ["held", "expired", "confirmed"] }).notNull(),
  expiresAt: integer("expires_at"),
  abandonedAt: integer("abandoned_at"),
  createdAt: integer("created_at").notNull(),
  resolvedAt: integer("resolved_at"),
}, (table) => [
  index("idx_reservations_experiment_status").on(table.experimentId, table.status),
  index("idx_reservations_expiry").on(table.status, table.expiresAt),
  uniqueIndex("idx_reservations_experiment_idempotency").on(table.experimentId, table.idempotencyKey),
]);

export const experimentEvents = sqliteTable("experiment_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  experimentId: text("experiment_id").notNull(),
  buyer: text("buyer").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => [index("idx_experiment_events_experiment_id_id").on(table.experimentId, table.id)]);

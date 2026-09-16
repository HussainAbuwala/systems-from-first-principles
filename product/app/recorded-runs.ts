export type Version = "naive" | "atomic" | "permanent_hold" | "expiring_hold" | "crash_gap" | "transactional_hold" | "idempotent_hold" | "payment_lifecycle";

export type RecordedRun = {
  experiment: { id: string; version: Version; initialStock: number; available: number; createdAt: number };
  allocations: Array<{ id: string; buyer: string; quantity: number; createdAt: number }>;
  reservations: Array<{
    id: string;
    buyer: string;
    quantity: number;
    idempotencyKey: string | null;
    status: "held" | "expired" | "confirmed" | "cancelled";
    expiresAt: number | null;
    abandonedAt: number | null;
    createdAt: number;
    resolvedAt: number | null;
  }>;
  events: Array<{ id: number; buyer: string; action: string; detail: string; createdAt: number }>;
  invariant: boolean;
  accountedUnits: number;
  requirementMet: boolean;
};

const baseExperiment = (id: string, version: Version, available: number, initialStock = 1) => ({
  id,
  version,
  initialStock,
  available,
  createdAt: 0,
});

export const recordedRuns: Record<Version, RecordedRun> = {
  naive: {
    experiment: baseExperiment("recorded-naive", "naive", 0),
    allocations: [
      { id: "naive-alice", buyer: "Alice", quantity: 1, createdAt: 200 },
      { id: "naive-bob", buyer: "Bob", quantity: 1, createdAt: 201 },
    ],
    reservations: [],
    events: [
      { id: 1, buyer: "Alice", action: "read", detail: "reads available = 1", createdAt: 0 },
      { id: 2, buyer: "Bob", action: "read", detail: "reads available = 1", createdAt: 1 },
      { id: 3, buyer: "Alice", action: "write", detail: "writes available = 0; promises 1 unit", createdAt: 200 },
      { id: 4, buyer: "Bob", action: "write", detail: "writes available = 0; promises 1 unit", createdAt: 201 },
    ],
    invariant: false,
    accountedUnits: 2,
    requirementMet: false,
  },
  atomic: {
    experiment: baseExperiment("recorded-atomic", "atomic", 0),
    allocations: [{ id: "atomic-alice", buyer: "Alice", quantity: 1, createdAt: 1 }],
    reservations: [],
    events: [
      { id: 1, buyer: "Alice", action: "atomic", detail: "checks and subtracts together; promises 1 unit", createdAt: 0 },
      { id: 2, buyer: "Bob", action: "reject", detail: "atomic update changes 0 rows; rejects the request", createdAt: 1 },
    ],
    invariant: true,
    accountedUnits: 1,
    requirementMet: true,
  },
  permanent_hold: {
    experiment: baseExperiment("recorded-permanent", "permanent_hold", 0),
    allocations: [],
    reservations: [{
      id: "permanent-alice",
      buyer: "Alice",
      quantity: 1,
      idempotencyKey: null,
      status: "held",
      expiresAt: null,
      abandonedAt: 20,
      createdAt: 0,
      resolvedAt: null,
    }],
    events: [
      { id: 1, buyer: "Alice", action: "hold", detail: "atomically subtracts 1; stores a hold with no expiry", createdAt: 0 },
      { id: 2, buyer: "Alice", action: "abandon", detail: "leaves checkout without completing payment", createdAt: 20 },
      { id: 3, buyer: "Bob", action: "reject", detail: "sees 0 available; cannot start payment", createdAt: 21 },
    ],
    invariant: true,
    accountedUnits: 1,
    requirementMet: false,
  },
  expiring_hold: {
    experiment: baseExperiment("recorded-expiring", "expiring_hold", 0),
    allocations: [],
    reservations: [
      {
        id: "expiring-alice",
        buyer: "Alice",
        quantity: 1,
        idempotencyKey: null,
        status: "expired",
        expiresAt: 1_200,
        abandonedAt: 20,
        createdAt: 0,
        resolvedAt: 1_300,
      },
      {
        id: "expiring-bob",
        buyer: "Bob",
        quantity: 1,
        idempotencyKey: null,
        status: "held",
        expiresAt: 2_500,
        abandonedAt: null,
        createdAt: 1_300,
        resolvedAt: null,
      },
    ],
    events: [
      { id: 1, buyer: "Alice", action: "hold", detail: "atomically subtracts 1; stores a hold for 1200ms", createdAt: 0 },
      { id: 2, buyer: "Alice", action: "abandon", detail: "leaves checkout without completing payment", createdAt: 20 },
      { id: 3, buyer: "Bob", action: "reject", detail: "sees 0 available; cannot start payment", createdAt: 21 },
      { id: 4, buyer: "System", action: "expire", detail: "Alice's hold expires; returns 1 unit to stock", createdAt: 1_300 },
      { id: 5, buyer: "Bob", action: "hold", detail: "atomically subtracts 1; stores a hold for 1200ms", createdAt: 1_301 },
    ],
    invariant: true,
    accountedUnits: 1,
    requirementMet: true,
  },
  crash_gap: {
    experiment: baseExperiment("recorded-crash", "crash_gap", 0),
    allocations: [],
    reservations: [],
    events: [{ id: 1, buyer: "Alice", action: "crash", detail: "stock subtraction commits; process crashes before the hold insert", createdAt: 0 }],
    invariant: false,
    accountedUnits: 0,
    requirementMet: false,
  },
  transactional_hold: {
    experiment: baseExperiment("recorded-transaction", "transactional_hold", 0),
    allocations: [],
    reservations: [{
      id: "transaction-alice",
      buyer: "Alice",
      quantity: 1,
      idempotencyKey: null,
      status: "held",
      expiresAt: 1_200,
      abandonedAt: null,
      createdAt: 0,
      resolvedAt: null,
    }],
    events: [{ id: 1, buyer: "Alice", action: "transaction", detail: "stock subtraction and hold commit in one transaction; response is lost afterward", createdAt: 0 }],
    invariant: true,
    accountedUnits: 1,
    requirementMet: true,
  },
  idempotent_hold: {
    experiment: baseExperiment("recorded-retry", "idempotent_hold", 0),
    allocations: [],
    reservations: [{
      id: "retry-alice",
      buyer: "Alice",
      quantity: 1,
      idempotencyKey: "checkout-alice-001",
      status: "held",
      expiresAt: 1_200,
      abandonedAt: null,
      createdAt: 0,
      resolvedAt: null,
    }],
    events: [
      { id: 1, buyer: "Alice", action: "transaction", detail: "stock subtraction and keyed hold commit in one transaction", createdAt: 0 },
      { id: 2, buyer: "Alice", action: "response_loss", detail: "hold committed, but its response never reached the client", createdAt: 1 },
      { id: 3, buyer: "Alice", action: "replay", detail: "retry returns the existing hold without subtracting stock again", createdAt: 20 },
    ],
    invariant: true,
    accountedUnits: 1,
    requirementMet: true,
  },
  payment_lifecycle: {
    experiment: baseExperiment("recorded-lifecycle", "payment_lifecycle", 2, 3),
    allocations: [],
    reservations: [
      {
        id: "lifecycle-alice",
        buyer: "Alice",
        quantity: 1,
        idempotencyKey: "checkout-alice-002",
        status: "confirmed",
        expiresAt: 1_200,
        abandonedAt: null,
        createdAt: 0,
        resolvedAt: 100,
      },
      {
        id: "lifecycle-bob",
        buyer: "Bob",
        quantity: 1,
        idempotencyKey: "checkout-bob-001",
        status: "cancelled",
        expiresAt: 1_201,
        abandonedAt: null,
        createdAt: 1,
        resolvedAt: 101,
      },
      {
        id: "lifecycle-carol",
        buyer: "Carol",
        quantity: 1,
        idempotencyKey: "checkout-carol-001",
        status: "expired",
        expiresAt: 1_202,
        abandonedAt: null,
        createdAt: 2,
        resolvedAt: 1_300,
      },
    ],
    events: [
      { id: 1, buyer: "Alice", action: "transaction", detail: "creates a keyed hold and subtracts one unit", createdAt: 0 },
      { id: 2, buyer: "Bob", action: "transaction", detail: "creates a keyed hold and subtracts one unit", createdAt: 1 },
      { id: 3, buyer: "Carol", action: "transaction", detail: "creates a keyed hold and subtracts one unit", createdAt: 2 },
      { id: 4, buyer: "Alice", action: "confirm", detail: "payment succeeded; the held unit is confirmed", createdAt: 100 },
      { id: 5, buyer: "Bob", action: "cancel", detail: "payment failed; the held unit returns to stock", createdAt: 101 },
      { id: 6, buyer: "System", action: "expire", detail: "the scheduled sweep releases Carol's overdue hold", createdAt: 1_300 },
    ],
    invariant: true,
    accountedUnits: 3,
    requirementMet: true,
  },
};

import assert from "node:assert/strict";

const baseUrl = process.env.EXPERIMENT_BASE_URL ?? "http://localhost:5173";

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(response.ok, true, `${path} returned ${response.status}`);
  return response.json();
}

async function postExpectedFailure(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  assert.equal(response.status, 503, `${path} should expose the injected failure`);
  assert.equal(payload.simulatedCrash, true, `${path} should identify the failure as deliberate`);
  return payload;
}

async function postExpectedResponseLoss(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  assert.equal(response.status, 503, `${path} should expose the lost response`);
  assert.equal(payload.simulatedResponseLoss, true, `${path} should identify the response loss as deliberate`);
  return payload;
}

async function run(version) {
  const started = await post("/api/experiments/start", { version });
  const purchase = (buyer) => post(`/api/experiments/${started.id}/purchase`, { buyer });

  if (version === "naive" || version === "atomic") {
    await Promise.all([purchase("Alice"), purchase("Bob")]);
  } else if (version === "crash_gap" || version === "transactional_hold") {
    await postExpectedFailure(`/api/experiments/${started.id}/purchase`, { buyer: "Alice" });
  } else {
    await purchase("Alice");
    await post(`/api/experiments/${started.id}/abandon`, { buyer: "Alice" });
    await purchase("Bob");
    if (version === "expiring_hold") {
      await new Promise((resolve) => setTimeout(resolve, 1_300));
      await purchase("Bob");
    }
  }

  const response = await fetch(`${baseUrl}/api/experiments/${started.id}`);
  assert.equal(response.ok, true, `inspection returned ${response.status}`);
  return response.json();
}

const naive = await run("naive");
assert.equal(naive.allocations.length, 2);
assert.equal(naive.invariant, false);

const atomic = await run("atomic");
assert.equal(atomic.allocations.length, 1);
assert.equal(atomic.invariant, true);

const permanent = await run("permanent_hold");
assert.equal(permanent.reservations.length, 1);
assert.equal(permanent.reservations[0].status, "held");
assert.equal(permanent.requirementMet, false);

const expiring = await run("expiring_hold");
assert.deepEqual(expiring.reservations.map(({ buyer, status }) => ({ buyer, status })), [
  { buyer: "Alice", status: "expired" },
  { buyer: "Bob", status: "held" },
]);
assert.equal(expiring.requirementMet, true);

const crashGap = await run("crash_gap");
assert.equal(crashGap.experiment.available, 0);
assert.equal(crashGap.reservations.length, 0);
assert.equal(crashGap.accountedUnits, 0);
assert.equal(crashGap.invariant, false);
assert.equal(crashGap.requirementMet, false);

const transactional = await run("transactional_hold");
assert.equal(transactional.experiment.available, 0);
assert.equal(transactional.reservations.length, 1);
assert.equal(transactional.reservations[0].buyer, "Alice");
assert.equal(transactional.reservations[0].status, "held");
assert.equal(transactional.accountedUnits, 1);
assert.equal(transactional.invariant, true);
assert.equal(transactional.requirementMet, true);

const retrySafe = await post("/api/experiments/start", { version: "idempotent_hold" });
const retryPath = `/api/experiments/${retrySafe.id}/purchase`;
await postExpectedResponseLoss(retryPath, {
  buyer: "Alice",
  quantity: 1,
  idempotencyKey: "alice-checkout-001",
  simulateResponseLoss: true,
});
const retries = await Promise.all([
  post(retryPath, { buyer: "Alice", quantity: 1, idempotencyKey: "alice-checkout-001" }),
  post(retryPath, { buyer: "Alice", quantity: 1, idempotencyKey: "alice-checkout-001" }),
]);
assert.equal(retries.every(({ accepted, replayed }) => accepted && replayed), true);
assert.equal(new Set(retries.map(({ reservationId }) => reservationId)).size, 1);
const retryInspectionResponse = await fetch(`${baseUrl}/api/experiments/${retrySafe.id}`);
assert.equal(retryInspectionResponse.ok, true);
const retryInspection = await retryInspectionResponse.json();
assert.equal(retryInspection.experiment.available, 0);
assert.equal(retryInspection.reservations.length, 1);
assert.equal(retryInspection.reservations[0].idempotencyKey, "alice-checkout-001");
assert.equal(retryInspection.accountedUnits, 1);
assert.equal(retryInspection.invariant, true);
assert.equal(retryInspection.requirementMet, true);

const lifecycle = await post("/api/experiments/start", { version: "payment_lifecycle", initialStock: 3 });
const lifecyclePurchases = await Promise.all([
  post(`/api/experiments/${lifecycle.id}/purchase`, { buyer: "Alice", idempotencyKey: "lifecycle-alice" }),
  post(`/api/experiments/${lifecycle.id}/purchase`, { buyer: "Bob", idempotencyKey: "lifecycle-bob" }),
  post(`/api/experiments/${lifecycle.id}/purchase`, { buyer: "Carol", idempotencyKey: "lifecycle-carol" }),
]);
assert.equal(lifecyclePurchases.every(({ accepted }) => accepted), true);
const [alice, bob] = lifecyclePurchases;
const alicePaymentEvent = `payment-alice-succeeded-${lifecycle.id}`;
const bobPaymentEvent = `payment-bob-failed-${lifecycle.id}`;

const confirmationResults = await Promise.all([
  post(`/api/experiments/${lifecycle.id}/reservations/${alice.reservationId}/resolve`, { action: "confirm", eventKey: alicePaymentEvent }),
  post(`/api/experiments/${lifecycle.id}/reservations/${alice.reservationId}/resolve`, { action: "confirm", eventKey: alicePaymentEvent }),
]);
assert.equal(confirmationResults.filter(({ applied }) => applied).length, 1);
assert.equal(confirmationResults.filter(({ replayed }) => replayed).length, 1);

const cancellationResults = await Promise.all([
  post(`/api/experiments/${lifecycle.id}/reservations/${bob.reservationId}/resolve`, { action: "cancel", eventKey: bobPaymentEvent }),
  post(`/api/experiments/${lifecycle.id}/reservations/${bob.reservationId}/resolve`, { action: "cancel", eventKey: bobPaymentEvent }),
]);
assert.equal(cancellationResults.filter(({ applied }) => applied).length, 1);
assert.equal(cancellationResults.filter(({ replayed }) => replayed).length, 1);

await new Promise((resolve) => setTimeout(resolve, 1_300));
const firstSweep = await post("/api/recovery/expire", { experimentId: lifecycle.id });
const repeatedSweep = await post("/api/recovery/expire", { experimentId: lifecycle.id });
assert.equal(firstSweep.expired, 1);
assert.equal(repeatedSweep.expired, 0);

const lifecycleInspectionResponse = await fetch(`${baseUrl}/api/experiments/${lifecycle.id}`);
assert.equal(lifecycleInspectionResponse.ok, true);
const lifecycleInspection = await lifecycleInspectionResponse.json();
assert.equal(lifecycleInspection.experiment.available, 2);
assert.deepEqual(lifecycleInspection.reservations.map(({ buyer, status }) => ({ buyer, status })).sort((left, right) => left.buyer.localeCompare(right.buyer)), [
  { buyer: "Alice", status: "confirmed" },
  { buyer: "Bob", status: "cancelled" },
  { buyer: "Carol", status: "expired" },
]);
assert.equal(lifecycleInspection.accountedUnits, 3);
assert.equal(lifecycleInspection.invariant, true);
assert.equal(lifecycleInspection.requirementMet, true);

const multiUnit = await post("/api/experiments/start", { version: "atomic", initialStock: 10 });
const multiUnitResults = await Promise.all([
  post(`/api/experiments/${multiUnit.id}/purchase`, { buyer: "Alice", quantity: 6 }),
  post(`/api/experiments/${multiUnit.id}/purchase`, { buyer: "Bob", quantity: 6 }),
]);
assert.equal(multiUnitResults.filter(({ accepted }) => accepted).length, 1);
const multiUnitSummaryResponse = await fetch(`${baseUrl}/api/experiments/${multiUnit.id}/summary`);
assert.equal(multiUnitSummaryResponse.ok, true);
const multiUnitSummary = await multiUnitSummaryResponse.json();
assert.equal(multiUnitSummary.experiment.available, 4);
assert.equal(multiUnitSummary.allocatedUnits, 6);
assert.equal(multiUnitSummary.invariant, true);

console.log("Verified all eight executable stages, retryable payment outcomes, scheduled recovery semantics, and concurrent multi-unit allocation.");

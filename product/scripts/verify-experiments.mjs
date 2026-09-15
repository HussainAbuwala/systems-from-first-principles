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

console.log("Verified all six stages: concurrency, payment lifecycle, and crash safety.");

import assert from "node:assert/strict";

const baseUrl = process.env.EXPERIMENT_BASE_URL ?? "http://localhost:5173";

async function fetchWithDevProxyRetry(url, init) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.status < 500) return response;
      lastError = new Error(`development proxy returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError;
}

const page = await fetch(baseUrl);
assert.equal(page.ok, true, `homepage returned ${page.status}`);
const html = await page.text();
assert.equal(html.includes("READ ONLY"), true, "homepage should identify the recorded evidence as read-only");

const writeAttempts = [
  {
    name: "experiment creation",
    path: "/api/experiments/start",
    body: { version: "atomic" },
  },
  {
    name: "purchase",
    path: "/api/experiments/read-only-check/purchase",
    body: { buyer: "Alice", quantity: 1 },
  },
  {
    name: "abandon",
    path: "/api/experiments/read-only-check/abandon",
    body: { buyer: "Alice" },
  },
  {
    name: "payment resolution",
    path: "/api/experiments/read-only-check/reservations/read-only-check/resolve",
    body: { action: "confirm", eventKey: "read-only-check" },
  },
  {
    name: "expiry recovery",
    path: "/api/recovery/expire",
    body: { experimentId: "read-only-check" },
  },
];

for (const attempt of writeAttempts) {
  const response = await fetchWithDevProxyRetry(`${baseUrl}${attempt.path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(attempt.body),
  });
  const payload = await response.json();
  assert.equal(response.status, 403, `public ${attempt.name} should be forbidden`);
  assert.equal(payload.readOnly, true, `${attempt.name} response should be explicitly read-only`);
}

console.log("Verified all published experiment write paths are read-only.");

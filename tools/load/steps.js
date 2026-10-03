// Step load: hold each request rate for HOLD seconds, ramping between them.
// Used for the tools check and for finding where a design stops keeping up.
//
//   k6 run -e TARGET=https://1.2.3.4/ -e STEPS=100,250,500 -e HOLD=60 steps.js
//
// Open model: requests start on schedule whether or not earlier ones have
// finished, so a slow server shows up as latency instead of quietly slowing
// the crowd down. Every request opens a fresh TLS connection, like a new
// visitor, and redirects are never followed.
import http from "k6/http";
import { Trend } from "k6/metrics";

// What a new visitor waits for: connect + TLS handshake + request + response.
// k6's own http_req_duration starts after the connection is ready, which
// would hide the handshake cost a fresh connection per click is meant to show.
const visit = new Trend("visit_duration", true);

const target = __ENV.TARGET;
const steps = (__ENV.STEPS || "100").split(",").map(Number);
const hold = Number(__ENV.HOLD || 60);
const ramp = Number(__ENV.RAMP || 10);

const stages = [];
for (const rate of steps) {
  stages.push({ target: rate, duration: `${ramp}s` });
  stages.push({ target: rate, duration: `${hold}s` });
}

export const options = {
  noConnectionReuse: true,
  insecureSkipTLSVerify: true, // self-made certificate; the handshake work is unchanged
  maxRedirects: 0,
  discardResponseBodies: true,
  summaryTrendStats: ["avg", "min", "med", "p(95)", "p(99)", "max"],
  scenarios: {
    steps: {
      executor: "ramping-arrival-rate",
      startRate: steps[0],
      timeUnit: "1s",
      preAllocatedVUs: Number(__ENV.PRE_VUS || 200),
      maxVUs: Number(__ENV.MAX_VUS || 5000),
      stages,
    },
  },
};

export default function () {
  const res = http.get(target, { timeout: "10s" });
  const t = res.timings;
  visit.add(t.blocked + t.connecting + t.tls_handshaking + t.duration);
}

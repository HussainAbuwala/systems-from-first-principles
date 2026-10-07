// Load for one URL shortener level: redirects and creates at fixed rates.
//
//   k6 run -e TARGET=https://1.2.3.4 -e SAMPLE=sample.csv -e RUN_ID=e01-01 \
//          -e REDIRECTS=1 -e CREATES=0.02 -e DURATION=6m level.js
//
// Follows the locked traffic model: clicks are skewed (Zipf, s = 1.0) so a
// few links get most of them; every click opens a fresh TLS connection;
// redirects are checked but never followed. SAMPLE is a CSV of code,url
// pairs already stored, written by the seeder.
import http from "k6/http";
import exec from "k6/execution";
import { SharedArray } from "k6/data";
import { Counter, Trend } from "k6/metrics";

const target = __ENV.TARGET;
const redirectRate = Number(__ENV.REDIRECTS || 1);
const createRate = Number(__ENV.CREATES || 0);
const duration = __ENV.DURATION || "6m";
const zipfS = Number(__ENV.ZIPF_S || 1.0);

const links = new SharedArray("links", () =>
  open(__ENV.SAMPLE)
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => {
      const comma = line.indexOf(",");
      return [line.slice(0, comma), line.slice(comma + 1)];
    }),
);

// Cumulative Zipf weights: rank k is clicked in proportion to 1 / k^s.
const cdf = new SharedArray("zipf", () => {
  const weights = [];
  let total = 0;
  for (let k = 1; k <= links.length; k++) {
    total += 1 / Math.pow(k, zipfS);
    weights.push(total);
  }
  return weights.map((w) => w / total);
});

// From E08 (STORED set): clicks follow the same Zipf curve over every stored
// link, not just the sample, so the working set is as large as the traffic
// model makes it. Which links are popular is scattered through the table by a
// fixed shuffle (rank r -> link ((r - 1) * P mod N) + 1), with no assumption
// that newer links are hotter. Seeded link i is encode(i) -> seedUrl(i), so no
// list is needed. The top ranks use exact Zipf weights; beyond them the
// harmonic numbers are approximated by ln k + gamma + 1 / 2k.
const stored = Number(__ENV.STORED || 0);
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GAMMA = 0.5772156649015329;
const EXACT_RANKS = 10000;
function encode(id) {
  let code = "";
  while (id > 0) {
    code = ALPHABET[id % 62] + code;
    id = Math.floor(id / 62);
  }
  return code;
}
// Must match seed.ts.
function seedUrl(i) {
  return `https://news.example.invalid/articles/2026/10/story-${i}?utm_source=share&utm_medium=link&ref=sfp-seed`;
}
function harmonic(k) {
  return Math.log(k) + GAMMA + 1 / (2 * k);
}
function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}
let shuffleStep = 79999999; // under 2^53 / 1e8, so (r - 1) * P stays exact for N up to 1e8
while (stored > 0 && gcd(shuffleStep, stored) !== 1) shuffleStep -= 2;
const exactCdf = [];
if (stored > 0) {
  let h = 0;
  for (let k = 1; k <= Math.min(EXACT_RANKS, stored); k++) {
    h += 1 / k;
    exactCdf.push(h);
  }
}
const hTotal = stored > EXACT_RANKS ? harmonic(stored) : exactCdf[exactCdf.length - 1];

export function zipfRank(u) {
  const target = u * hTotal;
  if (target <= exactCdf[exactCdf.length - 1]) {
    let lo = 0;
    let hi = exactCdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (exactCdf[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  }
  // Solve ln k + gamma = target for k beyond the exact range.
  return Math.min(stored, Math.max(EXACT_RANKS + 1, Math.ceil(Math.exp(target - GAMMA))));
}

export function linkForRank(rank) {
  const id = ((rank - 1) * shuffleStep) % stored + 1;
  return [encode(id), seedUrl(id)];
}

function pickLink() {
  if (stored > 0) return linkForRank(zipfRank(Math.random()));
  const u = Math.random();
  let lo = 0;
  let hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid] < u) lo = mid + 1;
    else hi = mid;
  }
  return links[lo];
}

// What a new visitor waits for: connect + TLS handshake + request + response.
const visit = new Trend("visit_duration", true);
const wrongRedirect = new Counter("wrong_redirect");
const createdLink = new Counter("created_link");

function record(res, kind) {
  const t = res.timings;
  visit.add(t.blocked + t.connecting + t.tls_handshaking + t.duration, { kind });
}

function scenario(execName, rate) {
  // Rates below one per second become "one every N seconds".
  const perSecond = rate >= 1;
  return {
    executor: "constant-arrival-rate",
    exec: execName,
    rate: perSecond ? rate : 1,
    timeUnit: perSecond ? "1s" : `${Math.round(1 / rate)}s`,
    duration,
    preAllocatedVUs: Math.max(5, Math.ceil(rate * 0.5)),
    maxVUs: Number(__ENV.MAX_VUS || 5000),
  };
}

const scenarios = { redirects: scenario("redirect", redirectRate) };
if (createRate > 0) scenarios.creates = scenario("create", createRate);

// E03: CONTENTION_ROUNDS rounds in which CONTENTION_SIZE clients ask for the
// same new name at the same moment, spread evenly over the measured period
// (after WARMUP), on top of the other traffic.
const rounds = Number(__ENV.CONTENTION_ROUNDS || 0);
const contenders = Number(__ENV.CONTENTION_SIZE || 50);
if (rounds > 0) {
  const warmup = Number(__ENV.WARMUP || 60);
  const measured = Number(__ENV.MEASURED || 300);
  scenarios.contention = {
    executor: "constant-arrival-rate",
    exec: "contention",
    rate: rounds,
    timeUnit: `${measured}s`,
    duration: `${measured}s`,
    startTime: `${warmup}s`,
    preAllocatedVUs: 20,
    maxVUs: 500,
  };
}
const nameRound = new Counter("name_round");

// E04: one stored link goes viral. After WARMUP it ramps from 0 to
// VIRAL_RATE clicks/s over VIRAL_RAMP seconds, holds for VIRAL_HOLD seconds,
// then falls back to 0 over VIRAL_RAMP seconds, on top of the other traffic.
// The viral link is the first link in the sample, so the checker verifies it.
const viralRate = Number(__ENV.VIRAL_RATE || 0);
if (viralRate > 0) {
  const ramp = Number(__ENV.VIRAL_RAMP || 60);
  scenarios.viral = {
    executor: "ramping-arrival-rate",
    exec: "viral",
    startRate: 0,
    timeUnit: "1s",
    startTime: `${Number(__ENV.WARMUP || 60)}s`,
    stages: [
      { target: viralRate, duration: `${ramp}s` },
      { target: viralRate, duration: `${Number(__ENV.VIRAL_HOLD || 600)}s` },
      { target: 0, duration: `${ramp}s` },
    ],
    preAllocatedVUs: 200,
    maxVUs: Number(__ENV.MAX_VUS || 5000),
  };
}

export const options = {
  noConnectionReuse: true,
  insecureSkipTLSVerify: true, // self-made certificate; the handshake work is unchanged
  maxRedirects: 0,
  summaryTrendStats: ["avg", "min", "med", "p(95)", "p(99)", "max"],
  // Let one contention round send all its requests at once.
  batch: contenders,
  batchPerHost: contenders,
  scenarios,
};

export function redirect() {
  const [code, url] = pickLink();
  const res = http.get(`${target}/${code}`, {
    tags: { kind: "redirect", name: "redirect", code },  // code: per-link truth for E05
    timeout: "10s",
    responseType: "none",
  });
  record(res, "redirect");
  // A redirect to the wrong address. Error answers (5xx) count as errors, not here.
  if (res.status === 301 && res.headers["Location"] !== url) {
    wrongRedirect.add(1, { code, status: String(res.status) });
  }
}

export function create() {
  const tag = Math.random().toString(36).slice(2, 10);
  const url = `https://made.example.invalid/${__ENV.RUN_ID}/${exec.vu.idInTest}-${exec.scenario.iterationInTest}?utm_source=share&ref=${tag}`;
  const res = http.post(`${target}/links`, JSON.stringify({ url }), {
    headers: { "content-type": "application/json" },
    tags: { kind: "create", name: "create" },
    timeout: "10s",
  });
  record(res, "create");
  if (res.status === 201) createdLink.add(1, { code: res.json("code"), url });
}

export function contention() {
  const name = `${__ENV.RUN_ID}-name-${exec.scenario.iterationInTest}`;
  const requests = [];
  for (let k = 0; k < contenders; k++) {
    requests.push({
      method: "POST",
      url: `${target}/links`,
      body: JSON.stringify({ url: `https://made.example.invalid/names/${name}/contender-${k}`, name }),
      params: {
        headers: { "content-type": "application/json" },
        tags: { kind: "name_create", name: "name_create" },
        timeout: "10s",
        responseCallback: http.expectedStatuses(201, 409),
      },
    });
  }
  const responses = http.batch(requests);
  let winners = 0;
  let taken = 0;
  let winnerUrl = "";
  responses.forEach((res, k) => {
    record(res, "name_create");
    if (res.status === 201) {
      winners++;
      winnerUrl = JSON.parse(requests[k].body).url;
    } else if (res.status === 409) {
      taken++;
    }
  });
  nameRound.add(1, { round_name: name, winners: String(winners), taken: String(taken), winner_url: winnerUrl });
}

export function viral() {
  const [code, url] = links[0];
  const res = http.get(`${target}/${code}`, {
    tags: { kind: "redirect", name: "viral", code },
    timeout: "10s",
    responseType: "none",
  });
  const t = res.timings;
  visit.add(t.blocked + t.connecting + t.tls_handshaking + t.duration, { kind: "redirect", link: "viral" });
  if (res.status === 301 && res.headers["Location"] !== url) {
    wrongRedirect.add(1, { code, status: String(res.status) });
  }
}

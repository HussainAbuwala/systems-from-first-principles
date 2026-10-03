// Fill the stage 0 database with N fake links before a run, then write a
// sample of them (code and URL) for the load generator and checker.
//
//   node seed.ts DB_PATH N SAMPLE_OUT [SAMPLE_SIZE]
//
// Every URL points at *.example.invalid, a name reserved so it can never
// resolve: no real website ever receives test traffic. URLs average about
// 100 characters, matching the traffic model.
import { DatabaseSync } from "node:sqlite";
import { writeFileSync } from "node:fs";
import { encode } from "./codes.ts";

const [dbPath, nArg, sampleOut, sampleArg] = process.argv.slice(2);
const n = Number(nArg);
const sampleSize = Math.min(n, Number(sampleArg ?? 100_000));

function seedUrl(i: number): string {
  // ~100 characters for typical i
  return `https://news.example.invalid/articles/2026/10/story-${i}?utm_source=share&utm_medium=link&ref=sfp-seed`;
}

const db = new DatabaseSync(dbPath);
db.exec(`CREATE TABLE IF NOT EXISTS links (
  id         INTEGER PRIMARY KEY,
  url        TEXT    NOT NULL,
  created_at INTEGER NOT NULL
)`);
const existing = Number((db.prepare("SELECT count(*) AS c FROM links").get() as { c: number }).c);
if (existing > 0) {
  console.error(`database already has ${existing} links; seed into an empty database`);
  process.exit(1);
}

const insert = db.prepare("INSERT INTO links (id, url, created_at) VALUES (?, ?, ?)");
const started = Date.now();
const BATCH = 50_000;
for (let start = 1; start <= n; start += BATCH) {
  db.exec("BEGIN");
  for (let i = start; i < Math.min(start + BATCH, n + 1); i++) insert.run(i, seedUrl(i), started);
  db.exec("COMMIT");
}
console.log(`inserted ${n} links in ${((Date.now() - started) / 1000).toFixed(1)} s`);

// A uniform random sample, so clicks reach links across the whole table.
const picked = new Set<number>();
while (picked.size < sampleSize) picked.add(1 + Math.floor(Math.random() * n));
const lines = ["code,url", ...[...picked].map((i) => `${encode(i)},${seedUrl(i)}`)];
writeFileSync(sampleOut, lines.join("\n") + "\n");
console.log(`wrote a sample of ${sampleSize} links to ${sampleOut}`);

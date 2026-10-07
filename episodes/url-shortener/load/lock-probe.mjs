// Investigation tool (E08, stage 7): runs ON the system server and records,
// every 250 ms, whether the database's write lock is free, which step
// Litestream reports it is in, per-disk I/O and Litestream's CPU. While the
// lock has been held for over 500 ms it also saves Litestream's goroutine dump
// (at most one a second), which shows what each part of Litestream is waiting
// on. Answers: who holds the write lock for seconds, in which step, and why.
//
//   node lock-probe.mjs DB_PATH SECONDS OUT_DIR
//
// The lock test takes the write lock with no waiting (BEGIN IMMEDIATE, busy
// timeout 0) and releases it at once; it never writes anything.
import { DatabaseSync } from "node:sqlite";
import { request } from "node:http";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, readdirSync } from "node:fs";

const [dbPath, secondsArg, outDir] = process.argv.slice(2);
const seconds = Number(secondsArg);
mkdirSync(`${outDir}/goroutines`, { recursive: true });
const SOCKET = "/var/run/litestream.sock";

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout = 0");

function lockFree() {
  try {
    db.exec("BEGIN IMMEDIATE");
    db.exec("ROLLBACK");
    return true;
  } catch {
    return false;
  }
}

function get(path, timeoutMs) {
  return new Promise((resolve) => {
    const req = request({ socketPath: SOCKET, path, method: "GET", timeout: timeoutMs }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve(body));
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
    req.end();
  });
}

function diskSectors() {
  const out = {};
  for (const line of readFileSync("/proc/diskstats", "utf8").split("\n")) {
    const f = line.trim().split(/\s+/);
    if (f[2] === "sda" || f[2] === "sdb") {
      // reads completed, sectors read, writes completed, sectors written, ms doing I/O, weighted ms
      out[f[2]] = { r: +f[3], rs: +f[5], w: +f[7], ws: +f[9], busy: +f[12], wq: +f[13] };
    }
  }
  return out;
}

function litestreamTicks() {
  const pid = readdirSync("/proc").find((p) => {
    if (!/^\d+$/.test(p)) return false;
    try {
      return readFileSync(`/proc/${p}/comm`, "utf8").trim() === "litestream";
    } catch {
      return false;
    }
  });
  if (!pid) return null;
  const f = readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].split(" ");
  return +f[11] + +f[12]; // utime + stime, in clock ticks
}

const out = `${outDir}/probe.jsonl`;
const end = Date.now() + seconds * 1000;
let heldSince = null;
let lastDump = 0;
while (Date.now() < end) {
  const t = Date.now();
  const free = lockFree();
  if (free) heldSince = null;
  else if (heldSince === null) heldSince = t;
  const status = await get(`/debug/sync-status?path=${encodeURIComponent(dbPath)}`, 200);
  let phase = null;
  try {
    const d = JSON.parse(status).databases[0];
    phase = d;
  } catch {}
  appendFileSync(out, JSON.stringify({ t, lockFree: free, heldMs: heldSince ? t - heldSince : 0, disk: diskSectors(), lsTicks: litestreamTicks(), litestream: phase }) + "\n");
  if (heldSince !== null && t - heldSince > 500 && t - lastDump > 1000) {
    const dump = await get("/debug/pprof/goroutine?debug=2", 2000);
    if (dump) writeFileSync(`${outDir}/goroutines/${t}.txt`, dump);
    lastDump = t;
  }
  const wait = 250 - (Date.now() - t);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
db.close();
console.log(`probe done: ${out}`);

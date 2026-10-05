// Stage 6: stage 5 in WAL mode, copied off the machine by Litestream (E07),
// plus GET /health for an outside monitor. A new link or name is confirmed only
// once Litestream has copied it to the Volume (attempt 2: in e07-01 a link
// confirmed in the last second was lost and its code issued again).
// Stage 5: stage 4 with synchronous=EXTRA (E06), so a save confirmed just
// before a power cut is not rolled back on reboot.
// Stage 4: stage 3 plus click counts (E05). Every redirect adds one to an
// in-memory tally for (link, day of the click); once a second all tallies are
// saved to SQLite in a single transaction. A sudden power cut can lose up to
// about a second of counts; links themselves are still saved immediately.
// Redirects tell browsers not to remember them, so every click reaches us.
// nginx terminates HTTPS in front; this program listens only inside the machine.
import { createServer, request, type IncomingMessage, type ServerResponse } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { decode, encode, MAX_CODE_LENGTH } from "./codes.ts";

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 8080);
const DB_PATH = process.env.DB_PATH ?? "/var/lib/shortener/links.db";
const PUBLIC_BASE = process.env.PUBLIC_BASE ?? "https://localhost";
const LITESTREAM_SOCKET = process.env.LITESTREAM_SOCKET ?? "/var/run/litestream.sock";

const MAX_URL_LENGTH = 2048;

const db = new DatabaseSync(DB_PATH);
// WAL mode: Litestream copies each change from the write-ahead log (E07).
db.exec("PRAGMA journal_mode = WAL");
// Litestream folds the log into the database itself; if we did it too, it
// could miss a change.
db.exec("PRAGMA wal_autocheckpoint = 0");
// Litestream briefly locks the database while folding; wait instead of failing.
db.exec("PRAGMA busy_timeout = 5000");
// EXTRA (same as FULL in WAL mode) syncs every save before it returns, so a
// confirmed save survives a power cut (E06). Litestream's tips suggest NORMAL,
// which SQLite documents as able to roll back a confirmed save; we keep EXTRA.
db.exec("PRAGMA synchronous = EXTRA");
db.exec(`CREATE TABLE IF NOT EXISTS links (
  id         INTEGER PRIMARY KEY,
  url        TEXT    NOT NULL,
  created_at INTEGER NOT NULL
)`);
db.exec(`CREATE TABLE IF NOT EXISTS names (
  name       TEXT    PRIMARY KEY,
  url        TEXT    NOT NULL,
  created_at INTEGER NOT NULL
)`);
const insertLink = db.prepare("INSERT INTO links (url, created_at) VALUES (?, ?)");
const findLink = db.prepare("SELECT url FROM links WHERE id = ?");
db.exec(`CREATE TABLE IF NOT EXISTS clicks (
  code  TEXT    NOT NULL,
  day   TEXT    NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (code, day)
)`);
const insertName = db.prepare("INSERT INTO names (name, url, created_at) VALUES (?, ?, ?)");
const addClicks = db.prepare(
  "INSERT INTO clicks (code, day, count) VALUES (?, ?, ?) ON CONFLICT (code, day) DO UPDATE SET count = count + excluded.count",
);

// Clicks not yet saved, keyed by "code<TAB>day". The day is the day the click
// happened, not the day it is saved.
let pending = new Map<string, number>();

function saveClicks() {
  if (pending.size === 0) return;
  const batch = pending;
  pending = new Map();
  try {
    db.exec("BEGIN");
    for (const [key, n] of batch) {
      const [code, day] = key.split("\t");
      addClicks.run(code, day, n);
    }
    db.exec("COMMIT");
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch {}
    // Keep the counts and try again next time.
    for (const [key, n] of batch) pending.set(key, (pending.get(key) ?? 0) + n);
    console.error("saving clicks failed; will retry", err);
  }
}
setInterval(saveClicks, 1000);

// On a normal stop or restart, save what is pending before exiting.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    saveClicks();
    process.exit(0);
  });
}
const healthRead = db.prepare("SELECT 1 FROM links LIMIT 1");
const readClicks = db.prepare("SELECT day, count FROM clicks WHERE code = ? ORDER BY day");
const findName = db.prepare("SELECT url FROM names WHERE name = ?");

const MAX_NAME_LENGTH = 64;

// A custom name uses letters, digits and hyphens, and either contains a hyphen
// or is longer than a generated code can be, so the two never collide.
function isValidName(raw: unknown): raw is string {
  return (
    typeof raw === "string" &&
    raw.length <= MAX_NAME_LENGTH &&
    /^[A-Za-z0-9-]+$/.test(raw) &&
    (raw.includes("-") || raw.length > MAX_CODE_LENGTH)
  );
}

function isValidUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > MAX_URL_LENGTH) return false;
  try {
    const { protocol } = new URL(raw);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function send(res: ServerResponse, status: number, body: string, headers: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}

function readBody(req: IncomingMessage, limit: number): Promise<string | null> {
  return new Promise((resolve) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
      if (body.length > limit) {
        resolve(null);
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", () => resolve(null));
  });
}

// Ask Litestream to copy everything saved so far to the Volume and wait until
// the copy is on its disk. Resolves true only on success.
function copiedOffMachine(): Promise<boolean> {
  return new Promise((resolve) => {
    const body = JSON.stringify({ path: DB_PATH, wait: true, timeout: 5 });
    const req = request(
      { socketPath: LITESTREAM_SOCKET, path: "/sync", method: "POST", timeout: 6000,
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) } },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode === 200));
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", (err) => {
      console.error("copy to the Volume failed", err);
      resolve(false);
    });
    req.end(body);
  });
}

const deleteLink = db.prepare("DELETE FROM links WHERE id = ?");
const deleteName = db.prepare("DELETE FROM names WHERE name = ?");

async function createLink(req: IncomingMessage, res: ServerResponse) {
  const body = await readBody(req, MAX_URL_LENGTH + MAX_NAME_LENGTH + 512);
  let url: unknown;
  let name: unknown;
  try {
    ({ url, name } = body === null ? {} : JSON.parse(body));
  } catch {
    url = undefined;
  }
  if (!isValidUrl(url)) {
    return send(res, 400, "Send JSON {\"url\": \"https://...\"} with an http or https link of at most 2048 characters\n");
  }
  let code: string;
  let undo: () => void;
  if (name === undefined) {
    const { lastInsertRowid } = insertLink.run(url, Date.now());
    code = encode(Number(lastInsertRowid));
    undo = () => deleteLink.run(lastInsertRowid);
  } else {
    if (!isValidName(name)) {
      return send(res, 400, "A name uses letters, digits and hyphens, and contains a hyphen or is longer than 7 characters\n");
    }
    // Check, then save.
    if (findName.get(name)) return send(res, 409, "That name is taken\n");
    insertName.run(name, url, Date.now());
    code = name;
    undo = () => deleteName.run(name);
  }
  // Confirm only what would survive losing this machine. If the copy fails,
  // remove the link (nobody was told its code) and ask the creator to retry.
  if (!(await copiedOffMachine())) {
    undo();
    return send(res, 503, "Could not save the link safely; please try again\n");
  }
  res.writeHead(201, { "content-type": "application/json" });
  res.end(JSON.stringify({ code, short_url: `${PUBLIC_BASE}/${code}` }));
}

// The address's format alone decides which table to read.
function redirect(code: string, res: ServerResponse) {
  const id = decode(code);
  let row: { url: string } | undefined;
  if (id !== null) row = findLink.get(id) as { url: string } | undefined;
  else if (isValidName(code)) row = findName.get(code) as { url: string } | undefined;
  if (!row) return send(res, 404, "Not found\n");
  const key = `${code}\t${new Date().toISOString().slice(0, 10)}`;
  pending.set(key, (pending.get(key) ?? 0) + 1);
  // no-store: a browser must ask us again next time, so every click is counted
  // and a taken-down link stops working for everyone.
  send(res, 301, "", { location: row.url, "cache-control": "no-store" });
}

// For the outside monitor: answers only if the database can be read.
function health(res: ServerResponse) {
  try {
    healthRead.get();
  } catch {
    return send(res, 503, "Database unreadable\n", { "cache-control": "no-store" });
  }
  send(res, 200, "OK\n", { "cache-control": "no-store" });
}

function stats(code: string, res: ServerResponse) {
  const days: Record<string, number> = {};
  for (const r of readClicks.all(code) as { day: string; count: number }[]) days[r.day] = r.count;
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ code, clicks_per_day: days }));
}

const server = createServer(
  (req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (req.method === "POST" && path === "/links") {
      createLink(req, res).catch(() => send(res, 500, "Internal error\n"));
    } else if (req.method === "GET" && path === "/health") {
      // Checked before redirects. As a generated code, "health" would be link
      // number 15 billion or so, far beyond anything this episode stores.
      health(res);
    } else if (req.method === "GET" && /^\/links\/[A-Za-z0-9-]+\/stats$/.test(path)) {
      stats(path.split("/")[2], res);
    } else if (req.method === "GET" && path.length > 1) {
      redirect(path.slice(1), res);
    } else {
      send(res, 404, "Not found\n");
    }
  },
);

const syncMode = (db.prepare("PRAGMA synchronous").get() as { synchronous: number }).synchronous;
const journalMode = (db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode;
server.listen(PORT, HOST, () =>
  console.log(
    `shortener stage 6 listening on ${HOST}:${PORT}, database ${DB_PATH}, journal_mode=${journalMode}, synchronous=${syncMode} (3 = EXTRA)`,
  ),
);

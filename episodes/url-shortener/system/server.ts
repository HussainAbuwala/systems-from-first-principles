// Stage 4, attempt 1: stage 3 plus click counts (E05). Every redirect adds one
// to that link's count for the day and saves it immediately (SQLite defaults),
// and redirects tell browsers not to remember them, so every click reaches us.
// nginx terminates HTTPS in front; this program listens only inside the machine.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { decode, encode, MAX_CODE_LENGTH } from "./codes.ts";

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 8080);
const DB_PATH = process.env.DB_PATH ?? "/var/lib/shortener/links.db";
const PUBLIC_BASE = process.env.PUBLIC_BASE ?? "https://localhost";

const MAX_URL_LENGTH = 2048;

const db = new DatabaseSync(DB_PATH);
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
const countClick = db.prepare(
  "INSERT INTO clicks (code, day, count) VALUES (?, ?, 1) ON CONFLICT (code, day) DO UPDATE SET count = count + 1",
);
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
  if (name === undefined) {
    const { lastInsertRowid } = insertLink.run(url, Date.now());
    code = encode(Number(lastInsertRowid));
  } else {
    if (!isValidName(name)) {
      return send(res, 400, "A name uses letters, digits and hyphens, and contains a hyphen or is longer than 7 characters\n");
    }
    // Check, then save.
    if (findName.get(name)) return send(res, 409, "That name is taken\n");
    insertName.run(name, url, Date.now());
    code = name;
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
  countClick.run(code, new Date().toISOString().slice(0, 10));
  // no-store: a browser must ask us again next time, so every click is counted
  // and a taken-down link stops working for everyone.
  send(res, 301, "", { location: row.url, "cache-control": "no-store" });
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
    } else if (req.method === "GET" && /^\/links\/[A-Za-z0-9-]+\/stats$/.test(path)) {
      stats(path.split("/")[2], res);
    } else if (req.method === "GET" && path.length > 1) {
      redirect(path.slice(1), res);
    } else {
      send(res, 404, "Not found\n");
    }
  },
);

server.listen(PORT, HOST, () => console.log(`shortener stage 4 listening on ${HOST}:${PORT}, database ${DB_PATH}`));

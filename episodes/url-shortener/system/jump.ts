// Run once after the database has been restored from Litestream's copy, before
// the app starts (stage 7, E07/E08). Links confirmed in the lost machine's
// last moments may be missing from the copy, and SQLite would hand their
// numbers, and so their codes, out again. A placeholder link with an empty URL
// (the app answers 404 for it) a million numbers above the highest restored
// link makes the next new link start beyond any number the old machine could
// have used: at most about 200 confirmed links a second (the disk-bound save
// rate measured in e03-01 and e05-01), so a million covers well over an hour.
//
//   node jump.ts DB_PATH [JUMP]
import { DatabaseSync } from "node:sqlite";
import { encode } from "./codes.ts";

const [dbPath, jumpArg] = process.argv.slice(2);
const jump = Number(jumpArg ?? 1_000_000);

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA synchronous = EXTRA");
const newest = db.prepare("SELECT max(id) AS id FROM links").get() as { id: number | null };
const highest = Number(newest.id ?? 0);
const newestLink = db
  .prepare("SELECT created_at FROM links WHERE url != '' ORDER BY id DESC LIMIT 1")
  .get() as { created_at: number } | undefined;
const placeholder = highest + jump;
db.prepare("INSERT INTO links (id, url, created_at) VALUES (?, '', ?)").run(placeholder, Date.now());
db.close();

const age = newestLink ? `${Math.round((Date.now() - newestLink.created_at) / 1000)} s` : "none";
console.log(
  `counter jump: highest restored link ${highest} (${encode(highest)}), newest real link created ${age} ago; ` +
    `placeholder ${placeholder} (${encode(placeholder)}); next new link ${placeholder + 1} (${encode(placeholder + 1)})`,
);

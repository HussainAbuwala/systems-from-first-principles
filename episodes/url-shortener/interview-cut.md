# Interview cut: URL shortener

The final system (stage 8) in the order a system design interview expects. Every number comes from the episode's runs (run IDs in the stage logs) or from the traffic model in [event-script.md](event-script.md).

## 1. Requirements

- **Functional:** paste a long link, get a short one; opening the short link redirects to the long one. Creators may pick their own short name (exactly one owner, others told "taken"). Creators see clicks per link per day, at most 60 s behind and within 1%. An operator can take a link down; it must stop redirecting within 60 s, including in browsers.
- **Scale (10% of Bitly, peak):** 1,000 redirects/s and 20 creates/s; 100 million links stored (about 12 GB). With a peak factor of 3: (1,000 ÷ 3) × 2,629,800 s ≈ **877 million clicks a month**; (20 ÷ 3) × 2,629,800 s ≈ **17.5 million links a month**, about 1.75 million active creators at 10 links each. Read:write is 50:1 (Bitly's yearly figures). Every click is a fresh HTTPS connection.
- **Targets:** redirect p99 under 100 ms, create p99 under 300 ms, errors under 0.1%. A power cut loses no confirmed link and redirects work again within 5 minutes; losing the machine: back within 1 hour, losing at most the last 5 minutes of new links.

## 2. Final design

- **One server:** a Hetzner CX33 (4 shared vCPUs, 8 GB) in Nuremberg, €8.49/month, with a kept, protected IPv4 address (€0.50).
- **nginx** terminates TLS (one worker per vCPU) and passes requests to the app on the same machine.
- **One Node 24 program**: redirects, creates, names, stats, takedowns.
- **SQLite** in a single file on the server's disk: WAL mode, `synchronous=EXTRA` (a confirmed save survives a power cut).
- **Codes** are a counting-up row number written in base 62 (`FXsk` = link 10,000,000). Custom names live in their own table and need a hyphen or more than 7 characters, so they can never collide with generated codes.
- **Click counts** are tallied in memory and saved once a second, together with a one-row heartbeat; redirects carry `Cache-Control: no-store`.
- **Litestream** copies every change, about once a second, to a 10 GB Hetzner Volume (€0.57/month) that survives the server.
- **Better Stack** (free) checks `GET /health` every 30 s and emails on failure.
- **`recover.sh`** rebuilds on a new server with the kept IP and the Volume, restores the database and jumps the code counter a million ahead.
- **Takedowns:** `POST /links/<code>/takedown` with an operator secret; the link answers `410 Gone` from the next click.

Total: **€9.56 a month.**

## 3. Why each component exists

| Component | Added at stage | The number that forced it | What we tried first |
| --- | --- | --- | --- |
| Names table, format-based routing | 1 | E03: stage 0 ignored names; two creators both "won" `launch-day` (`e03-01`) | — |
| nginx in front for TLS | 2 | E03: bursts of 50 TLS handshakes on Node's single thread, redirect p99 179.5 ms | upstream keepalive default gave 502s (attempt 1) |
| 4 vCPUs (CX33) | 3 | E04: 2,000 clicks/s on one link (about 2,100 new TLS connections/s) ran the 2-vCPU server out of CPU | — |
| In-memory click tally, saved once a second | 4 | E05: saving every click collapsed at about 166 saves/s | one save per click (attempt 1) |
| `synchronous=EXTRA` | 5 | E06: SQLite's default undid the last confirmed save after a power cut, and the counting-up code was reissued (`e06-01`) | — |
| Litestream to a Volume, kept IP, `/health` + Better Stack, `recover.sh` | 6 | E07: the only copy of the data was on the disk being deleted | copying in the background reissued a lost link's code (`e07-01`); recovery stopped when Hetzner had no CX33 (`e07-04`) |
| Counter jump after a restore; names wait for the copy | 7 | E08: waiting for the copy on every create took create p99 to 753–848 ms while Litestream rewrote its 1.7 GB copy | — |
| Heartbeat save every second | 7 | E08: after a fresh full copy and a quiet spell, Litestream's checkpoint scanned the whole copy holding the write lock for 30.5 s, freezing the app (`e08-03`, `e08-06`) | — |
| Takedown endpoint, `410 Gone` | 8 | E09: there was no way to remove a link | — |

## 4. What we did not add, and why

| Common choice | Why it was not needed, with the measurement |
| --- | --- |
| A cache (Redis, an in-memory link cache) | Redirect p99 stayed 14–19 ms at 1,000/s with 100 M links and a 12 GB database larger than memory (E08/E09); and without a cache a takedown takes effect on the next click: zero redirects after any of 300 takedowns (E09) |
| A CDN | Would cache redirects at the edge and fight both click counting (every click must reach us, E05) and takedowns within 60 s (E09); one server served the whole load |
| A separate database server, Postgres or a NoSQL store | SQLite in the same process served 100 M links; the app itself used about a quarter of one core at E08 |
| A key-generation service or random codes | A counting-up number is unique by construction; the one way it could repeat (a restore that lost the newest links) is closed by jumping the counter a million ahead after any restore |
| A queue or stream for click events | An in-memory tally saved once a second counted 1,355,748 clicks exactly at 2,000+ clicks/s (E05) |
| Several app servers and a load balancer | One CX33 averaged about half its CPU at E08 |
| A standby server or database cluster | E07 allows an hour to recover; a rebuild took 3.4–5.9 minutes |

## 5. Breaking point

- **Largest measured load:** E08 and E09: 1,000 redirects/s and 20 creates/s with 100 M links stored, plus 100 takedowns.
- **What runs out next:** CPU. In the three E09 runs (stage 8) the server averaged 48–51% (peaks 66–73%, busiest core up to 80%, steal 0%): nginx doing TLS for 1,000 new connections a second used about 1–1.1 cores, Litestream about 0.6 on average and up to 1.5 while rewriting its whole copy, Node about a quarter of a core. Memory: the app and tools used about 1.5 GB; the rest of the 8 GB caches the 12 GB database.
- **The next move:** more cores (the 8-vCPU CX43) for TLS and Litestream's merges; beyond one machine, the single SQLite file and Node's single thread become the limits. Not measured: this episode claims no capacity above its largest run.

## 6. Likely follow-up questions

| Question | Answer from the episode's evidence |
| --- | --- |
| What if the server dies? | Better Stack notices (1–4 minutes in our runs), `recover.sh` builds a new server on the same IP and restores from the Volume in 2–3 minutes; links were back 3.4–5.9 minutes after the loss. Links confirmed in the last moment may be lost (they answer 404); their codes are never reused. |
| And a power cut? | Nothing confirmed is lost (`synchronous=EXTRA`); redirects back in about 60 s; up to about a second of click counts lost (accepted). |
| How do you stop two people getting the same code? | One process assigns counting-up numbers; after any restore the counter jumps a million ahead (at most about 200 links a second can be confirmed, so a million covers over an hour). |
| Two people claim the same name at once? | One process checks then saves; 1,001 rounds of 50 simultaneous claims, exactly one winner every time (E03). |
| A link goes viral? | 2,000 clicks/s on one link plus normal traffic: redirect p99 8.3 ms (E05 on stage 6). |
| How accurate are click counts? | Exact in normal runs (1,355,748 = 1,355,748 in E05); a power cut or machine loss can lose about the last second (accepted). |
| The database no longer fits in memory? | At 12 GB on 8 GB of RAM, clicks spread over all 100 M links (Zipf) still had p99 under 19 ms; right after a fresh restore the first seconds are slower while it warms. |
| How fast does a takedown work? | On the next click: zero redirects after any of 300 takedowns; redirects are `no-store`, so browsers cannot keep them. |
| Does it always hit the latency target? | On some Hetzner hosts about 1.5% of new connections take an extra 50–60 ms to open, which put redirect p99 at about 100–118 ms in two of three machine-loss runs; the server's own answer stays about 3 ms. Accepted: the host is the provider's choice. |
| What was the hardest bug? | Litestream's checkpoint check scans its newest copy file holding the write lock; after a fresh full copy that file is the whole 1.7 GB database, so the app froze for 30 s. A one-row heartbeat write every second keeps a small file newest; the real fix belongs in Litestream (its file format has a page index). |

# Stage 01: Custom names

## Trigger

- **Event:** E03 (Requirement): a creator can choose the short code. Under E02 load, 50 clients request the same name at the same moment, 1,000 times; exactly one must win and the rest be told "taken".
- **Failed run:** `results/e03-01/` (stage 0)
- **What the user would notice:** asking stage 0 for `launch-day` silently ignored the name. Two creators asking for the same name both got a success response with a counter code (`FXDY`, `FXDZ`), and `/launch-day` answered 404. Everyone thinks they succeeded.

## Diagnosis

Not a resource limit: stage 0 has no concept of a chosen name. Its codes are calculated from a counting-up number, and nothing is stored that a name could be looked up by.

## Options considered

| Option | What it fixes | What it costs | Chosen? Why |
| --- | --- | --- | --- |
| **A. Separate `names` table; names must contain a hyphen or be longer than 7 characters** | Names are stored and looked up by text; their format guarantees they never look like a calculated code, so the two never share an address | People cannot pick short plain names such as `sale` | **Yes.** Smallest change; generated links keep the pure-arithmetic path untouched; each request takes exactly one path, chosen by format alone |
| B. One table of stored codes for every link, any name allowed | Any name, one lookup path | Every link's code must be stored and indexed; the counter must skip numbers whose code a name already took; more data and more edge cases | No: more change than E03 requires |

**How "exactly one winner" is enforced:** the first attempt is the plain *check, then save*: look the name up, answer 409 "taken" if it exists, otherwise insert it. In many systems this races (two requests both check, both see "free", both save). In stage 1 the check and the save run back to back on Node's single thread with synchronous SQLite calls, so no other request can run between them. `name` is also the table's primary key, so the database would refuse a second owner even if a race occurred (it would surface as an error, not a double winner).

## Change

`system/server.ts`: a `names (name PRIMARY KEY, url, created_at)` table; `POST /links` accepts an optional `name`, validates its format (400), answers 409 if taken; `GET /<x>` decodes `x` as a counter code if it can, otherwise looks it up as a name. About 45 lines.

## Rerun of every event so far

| Event | Run ID | Redirect p99 | Errors | Correct | Pass |
| --- | --- | ---: | ---: | --- | --- |
| E01 | e01-02 | 18.2 ms | 0% | yes | PASS |
| E02 | e02-02 | 12.9 ms | 0% | yes | PASS |
| E03 | e03-02 | **179.5 ms** | 0% | yes (1,000/1,000 single winners) | **FAIL** (redirect p99) |

Stage 1 met every correctness rule of E03 but not its speed rule: bursts of 50 TLS handshakes block the single Node thread. See `results/e03-02/NOTES.md`. This triggers stage 2.

## Scoreboard row

| Stage | Design in one line | Peak load passed | p99 | Errors | Data size | $/month | What broke it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | Stage 0 + names table, routed by format | E02 (100 redirects/s, 10 M links) | 12.9 ms | 0% | 1.2 GB | €5.49 + €0.50 IPv4 | E03: bursts of 50 TLS handshakes on one thread (redirect p99 179.5 ms) |

## Interview line

"Custom names went in a separate table whose format can never collide with generated codes, so generated links kept their arithmetic-only path; uniqueness came from the primary key, and a single-threaded server made check-then-save safe."

# Event script: URL shortener

**Status:** Locked 2026-10-03, before stage 0 was built.

Once locked, events are not reordered, removed, or made easier. New events may only be appended, with a reason in the changelog. See [format](../../docs/FORMAT.md#the-event-script).

## The product

Paste a long link, get a short one. Anyone who opens the short link is sent to the long one. Later, creators can pick their own short names, see how many clicks their links get, and links can be taken down.

## The yardstick: Bitly

So "scale" means something real, the ladder is measured against the best-known shortener. Bitly states it handles **100B+ clicks and scans** and **2B+ links and QR codes created** per year ([bitly.com/pages/about](https://bitly.com/pages/about), checked 2026-10-01). That works out to:

- about **3,200 clicks per second** on average, around 9,500 at peak (using the peak factor below);
- about **63 links created per second** on average, around 190 at peak.

This episode climbs to **10% of Bitly**: production scale, about 877 million clicks a month. Full Bitly scale is kept as a reference row, not a target. Stored links at each step are about six months of creation at that scale.

## Traffic model (input)

| Input | Value | Why this value |
| --- | --- | --- |
| Clicks per link created (read:write) | 50:1 | Bitly's own yearly figures (100B clicks ÷ 2B links) |
| Peak factor (peak ÷ daily average) | 3 | Daily cycle plus bursts |
| Click distribution across links | Zipf, s = 1.0 | A few links get most of the clicks |
| Connections | Every click opens a new HTTPS connection | Short links are mostly clicked once by different people, so a test that reuses connections would flatter the server |
| Long URL length | 100 bytes average | Typical shared link |
| Links per active creator per month | 10 | Only used to turn link volume into a creator count |

Conversions (all load steps below are peak rates):

- `clicks per month = (peak redirects/s ÷ 3) × 2,629,800 s`
- `links per month = (peak creates/s ÷ 3) × 2,629,800 s`
- `active creators per month = links per month ÷ 10`

| Step | Peak redirects/s | Peak creates/s | Clicks per month (derived) | Links stored |
| --- | ---: | ---: | ---: | ---: |
| Friends | 1 | 0.02 (about 1 a minute) | 877,000 | 1,000 |
| 1% of Bitly | 100 | 2 | 88 million | 10 million |
| 10% of Bitly | 1,000 | 20 | 877 million | 100 million |
| Bitly (reference only) | 10,000 | 200 | 8.8 billion | 1 billion |

## Default pass criteria (input)

Measured from a load generator in the same region as the system, unless the event says otherwise.

| Measure | Threshold |
| --- | --- |
| Redirect p99 | under 100 ms |
| Create p99 | under 300 ms |
| Error rate | under 0.1% |
| Correctness | Every acknowledged link redirects to exactly its URL; no short code has two owners; no redirect goes to a wrong URL |

Why these numbers:

- **100 ms for redirects.** About 0.1 s is where a response stops feeling instant (Nielsen's response-time limits). A redirect is pure waiting before the page the visitor actually wants, and Google counts redirect time inside its 0.8 s "good" budget for time to first byte. Measured next to the server, 100 ms leaves the rest of that budget for the visitor's own network.
- **300 ms for creates.** Creating is rarer and follows a button press, so a short wait is acceptable, but it should stay well under 1 s, the limit before a person's flow is interrupted (Nielsen). Saving safely to disk also makes writes naturally slower than lookups.
- **p99, not the average.** The average hides the slowest visitors. At 1,000 clicks a second, the slowest 1% is still 10 people every second (Dean & Barroso, *The Tail at Scale*, 2013).
- **0.1% errors.** The common "three nines" (99.9%) reliability target. A judgment, not research.

## Test budget and where tests run

- **Stage 0 runs on the cheapest real server** we can find, not a free tier (see the episode README for why). Its monthly price is part of the story.
- **Bigger test runs rent machines by the hour** and delete them afterwards. Level-by-level estimate in [budget.md](budget.md).
- **Budget cap:** €25 for the whole episode, including keeping stage 0 online for a month. Actual spend is measured and reported at the end.
- **Spending safety:** a separate Hetzner project with cost alerts, every test machine labelled and deleted by script at the end of each run, and a watchdog that deletes any test machine older than its allowed lifetime. Hetzner bills switched-off servers, so machines are always deleted, never just stopped.
- Before E08, confirm with Hetzner support that load testing our own servers at that rate is fine.

## Starting requirements (E01)

What the product must do on day one. Everything else arrives later as an event.

**Create**

- Accept any `http://` or `https://` link up to 2,048 characters; reject anything else with a clear error.
- Return a short link whose code is at most 7 characters, using only letters and digits.
- Pasting the same long link twice may return the same code or a new one.

**Redirect**

- Opening a short link sends the browser to its long link.
- An unknown code shows a "not found" page.

**Secure**

- Served over HTTPS only, like any real website.

**Keep**

- An acknowledged link keeps working forever, including after a normal restart or redeploy. (Surviving a power cut comes later, in E06.)

**Not required yet:** accounts or login, custom names (E03), viral links (E04), click counts (E05), surviving a power cut (E06), surviving loss of the machine (E07), takedowns (E09).

## Events

Each load step holds for at least 5 minutes at the stated rate after warm-up, with the stated number of links already stored.

Before E01, a **calibration run** points the same tools at a trivial server that only answers "OK". It checks the tools, not the system: if they report sensible numbers for something fully understood, their numbers for the shortener can be trusted. It is not an event and nothing is designed from it.

| ID | Type | What happens | Pass criteria (if not default) |
| --- | --- | --- | --- |
| E01 | Requirement | **Launch.** The [starting requirements](#starting-requirements-e01) at the friends step: 1 redirect/s, 0.02 creates/s, 1,000 links stored. |  |
| E02 | Load | **1% of Bitly:** 100 redirects/s, 2 creates/s, 10 million links stored. |  |
| E03 | Requirement | **Custom names.** A creator can choose the short code. Under E02 load, 50 clients request the same name at the same moment, repeated 1,000 times with different names. | Exactly one winner every time; losers get a clear "taken" response |
| E04 | Load | **Viral spike.** On top of E02 load, one link ramps from 0 to 2,000 redirects/s over 60 s, holds 10 minutes, then falls back. | Default criteria hold for all links, including the hot one |
| E05 | Requirement | **Click counts.** Creators see total clicks per link per day, at most 60 s behind. Rerun E04 with counting on. | Each link's daily count is within 1% of the true number of clicks, including through the E06 power cut (counts are approximate, by choice) |
| E06 | Failure | **Hard kill.** Under E02 load, the machine holding the data is powered off without warning, then started again. | No acknowledged link lost; redirects working again within 5 minutes of the kill |
| E07 | Failure | **Machine lost.** Under E02 load, the server and its disk are deleted for good. | Service back on a new machine within 1 hour; at most the last 5 minutes of acknowledged links lost (recovery time 1 h, recovery point 5 min) |
| E08 | Load | **10% of Bitly:** 1,000 redirects/s, 20 creates/s, 100 million links stored. |  |
| E09 | Requirement | **Takedown.** Under E08 load, 100 links are reported and taken down during the run. | No taken-down link redirects more than 60 s after its takedown |

## How browser behaviour is checked

The load generator never caches redirects, so its numbers are the worst case for load. Real visitors use browsers, which may remember a redirect and skip the server on later visits. Levels whose promise is about real people are therefore also checked by reading the caching instructions in every redirect response (for example `Cache-Control`), without using a browser:

- **E05 (click counts):** fails if redirects allow browsers to reuse them without asking the server, because those repeat clicks would go uncounted.
- **E09 (takedowns):** fails if any redirect allows a browser to reuse it for more than 60 seconds.

## Decisions

- **Scope:** one video, ending at E09: 10% of Bitly in one region. Nothing is split into parts.
- **Click counts are approximate (within 1%).** Exact counting would mean every click is safely saved before the visitor is redirected, which slows down every redirect to make a statistic perfect. Real shorteners favour the fast redirect, and choosing "good enough" on purpose, and saying what it costs, is the point worth making.

## Not in this episode

Drafted with the script and set aside. Any of them could seed a later episode, starting from wherever this one ends.

| ID | Type | What happens | Pass criteria |
| --- | --- | --- | --- |
| F1 | Load | **Bitly:** 10,000 redirects/s, 200 creates/s, 1 billion links stored, including one link at 5,000 redirects/s. | Default |
| F2 | Requirement | **Three continents.** Load split across generators in North America, Europe and Asia-Pacific. | Redirect p99 under 100 ms measured on every continent |
| F3 | Failure | **Region loss.** One region is cut off completely. | Redirects work from the remaining regions within 5 minutes; creates may be refused during failover, but no acknowledged link is lost |

Stage 0's design is deliberately not decided here. The script says what happens to the system, not what the system is.

## Changelog

| Date | Change | Reason |
| --- | --- | --- |
| 2026-10-03 | **Locked.** Scope E01–E09, budget cap €25. Clarified how E05 and E09 are checked against browser caching (a stricter reading of their existing promises, not a new event) | User go-ahead |
| 2026-10-03 | Ceiling lowered to 10% of Bitly (E01–E09), one video; Bitly scale and global events moved to "not in this episode"; calibration run added before E01; budget cap €25 | User: first run should validate the setup at production scale rather than chase Bitly, and stay one video |
| 2026-10-01 | Drafted |  |
| 2026-10-02 | Added E07 machine lost (1 h / 5 min) and renumbered later events; HTTPS required from day one, with a new connection per click in the traffic model; unpredictable codes considered and skipped | User decisions on production must-haves |
| 2026-10-02 | Speed thresholds confirmed (100 ms redirect p99, 300 ms create p99) | User decision |
| 2026-10-02 | Scope set to E01–E09 (numbering at the time); E10–E11 moved to part two candidates; click counts approximate (within 1%); reasons for thresholds added | User decisions |
| 2026-10-01 | Redrafted: ladder in steps of Bitly's real traffic; read:write 50:1 from Bitly's figures; €50 test budget; events renumbered E01–E11 | User wants free where possible and a non-toy scale |

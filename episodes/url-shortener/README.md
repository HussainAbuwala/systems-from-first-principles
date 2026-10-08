# URL shortener

**Status:** all events played (E01–E09) on stage 8, 2026-10-08; scoreboard, final claim and interview cut written; script and storyboard next

## Central question

How far does one file on a €5 server get you, and what does it take to handle almost a billion clicks a month?

## Why this problem first

It is the most-covered problem in system design teaching, and the standard answer is one of the most over-built: key-generation services, coordination clusters, wide-column stores and caches before the first link exists. That makes it the strongest contrast for the series, and it is still asked in interviews.

## Where it runs

Stage 0 starts on the cheapest real server rather than a "free" tier, because the free options each fail us (checked 2026-10-01):

| Option | Why not for stage 0 |
| --- | --- |
| Oracle Cloud Always Free (now 2 ARM cores, 12 GB) | Its terms say you may not perform or publish performance tests of the service without Oracle's written approval. A public benchmark series cannot depend on that. |
| Cloudflare Workers free plan | Capped per day, and the platform scales for you, which hides the breaks the episode is meant to show. |
| AWS free plan ($100–200 credits for 6 months, new accounts) | Usable to pay for test runs, but credits expire and AWS list prices make the monthly-cost story less representative of "cheap". Load tests under 1 Gbps need no approval. |

Planned default: **Hetzner**, billed by the hour. Its smallest server (CX23: 2 vCPU, 4 GB, 20 TB traffic) is €5.49 a month after the 2026 price rises; a 16-core ARM machine (CAX41) is about €0.066 an hour for big runs.

## Files

| File | What it holds |
| --- | --- |
| [event-script.md](event-script.md) | Everything that will happen to the system. Must be locked before stage 0 is built. |
| `stages/NN-name.md` | One [stage log](../../templates/stage-template.md) per design change |
| `system/` | The application code. Each stage is tagged `url-shortener/stage-NN`. |
| `load/` | k6 scripts, one per event, plus the correctness checker |
| `results/<run-id>/` | Raw evidence for every run (see [measurement standard](../../docs/MEASUREMENT.md#recording-a-run)) |
| `scoreboard.md` | One row per stage, filled as the build goes |
| `interview-cut.md` | The final system in interview order |
| `script.md`, `storyboard.md` | Written once the build is done and the numbers are known |

## Order of work

1. Lock the event script.
2. Build stage 0, deploy it, and run E01.
3. Work through the events. Write the stage log as each change happens, not afterwards.
4. Fill the scoreboard and the interview cut.
5. Write the script from what actually happened.

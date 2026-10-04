# Measurement standard

Every number in an episode is either **measured** or **derived**. Nothing is estimated, extrapolated, or taken from someone else's benchmark.

## Three kinds of number

- **Measured:** read off an instrument during a recorded run: the load generator, server metrics, the database, the provider's bill or usage report.
- **Derived:** arithmetic on measured numbers. The formula is shown on screen or linked. Example: monthly clicks from measured peak req/s and the traffic model.
- **Input:** a stated assumption that shapes the test, never a result. Only the traffic model and pass criteria are inputs. They are written in the event script and locked with it.

If a number is neither measured nor derived, it does not appear.

## The largest claim is the largest run

The top of the ladder is the largest load we can actually generate and pay for. We never say "this would handle 10× more". If an episode claims a capacity, there is a run at that load in `results/`.

Measuring at scale is cheaper than running at scale: big machines and load generators are rented for hours, not months. The episode's test budget is set in the event script, and the real spend is reported at the end.

## Traffic model

"Users" cannot be measured in a load test; requests can. The traffic model turns one into the other. It states:

- requests per user per day, by kind (reads, writes);
- peak factor: peak req/s divided by daily average req/s;
- key distribution: how traffic spreads across items (uniform, or skewed so a few items are hot);
- payload sizes and data growth per day.

Load steps in the event script are expressed in req/s and data size. User and monthly figures are derived from them with the model, and the formula is shown.

## Load generation

- **Open model.** Use a fixed arrival rate (requests start on schedule whether or not earlier ones finished). A closed loop of virtual users slows down when the server slows down, which hides the very latency we are trying to show. Default tool: [k6](https://k6.io) with `constant-arrival-rate` or `ramping-arrival-rate`.
- **The generator must not be the bottleneck.** It runs on separate machines from the system under test. A run is invalid if generator CPU goes above about 70% or the tool reports dropped iterations.
- **Connect like real clients.** If real visitors mostly arrive fresh, each test request opens a new connection, including the HTTPS handshake. Reusing connections would flatter the server.
- **Same region as the system** unless the event is about distance.
- **Warm up, then hold.** Hold each load step for at least five minutes at the target rate, unless the event specifies a spike shape.
- **Real data volume.** Seed the data size the event calls for before the run. A database with 1,000 rows tells us nothing about one with 100 million.
- **Check provider rules** on load testing before any high-load run.

## Repeats

Shared vCPUs are slower when the host's other customers are busy (measured as CPU steal), so one run can be unlucky. Every verdict therefore comes from **three runs** of the same event on the same deployed stage, each from the same starting state (database reseeded before each run).

- **All three agree:** that is the verdict, reported with the best, median and worst value of every measure.
- **They disagree:** the verdict is **INCONSISTENT**. Check steal and the per-window results, and investigate before any design change.

Earlier single-run verdicts may stand where the margin is large (for example a p99 under a fifth of its limit); they are marked as single runs.

**Regression checks:** after a design change, earlier events are re-run to show nothing regressed. One run is enough when every measure is within a fifth of its limit (for example redirect p99 under 20 ms); otherwise that event also gets three runs.

## Pass criteria

Each event defines:

- p99 latency (also record p50 and p95);
- error rate (non-2xx/3xx responses and timeouts);
- correctness: checked by a script after every run. For example: every acknowledged write is readable, nothing is duplicated, no wrong answer was served.

A run that is fast but wrong fails.

## Diagnosing a break

Name the resource that ran out, with the graph that shows it: CPU, memory, disk I/O, connection pool, locks, network, or a provider limit. "Probably the database" is not a diagnosis. Collect host and database metrics during every run so the evidence exists before we need it.

A free-tier limit is a real break. Hitting it is a legitimate event.

## Cost

- **Measured:** the provider's usage or bill for the test window.
- **Derived monthly cost:** resource prices from the bill × 730 hours, plus storage and egress at the traffic model's monthly volume. Show the formula.
- Include everything the design needs to run: machines, managed services, storage, egress, backups. Exclude the load generators (they are not part of the system), but report their cost in the episode's test spend.

## Where to run

Prefer machines and containers where the bottleneck is visible and attributable: a VM, a process, a database you can watch. Managed or serverless platforms are fine when buying them is the stage's decision; then their limits and bill are what we measure. Do not start on a platform that hides the breaks the episode is meant to show.

## Recording a run

Every run gets an ID and a folder under `episodes/<slug>/results/<run-id>/` containing:

- the commit of the system and of the load script;
- machine sizes, provider, region;
- the raw load-generator output and a summary;
- host and database metrics for the run window;
- the correctness check output;
- pass or fail against the event's criteria.

Numbers on screen carry their run ID, so any viewer can find the evidence.

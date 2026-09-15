# Systems from First Principles

An interactive lab for building real software systems one requirement at a time.

The first system is an inventory reservation service. It currently contains six executable stages:

- `read → decide → write` reproducibly creates two promises from one unit;
- an atomic conditional update permits exactly one promise;
- a durable payment hold protects that unit while Alice pays, but strands it when she abandons checkout;
- an expiring hold returns the abandoned unit so Bob can acquire it on retry;
- a controlled crash between two writes makes the stock disappear without a durable owner;
- a D1 transaction commits the stock change and its hold together, even when the response is lost afterward.

Every interactive teaching path executes against persistent database state and emits a database trace. The deliberate pause in the naïve implementation exposes the same unsafe gap that ordinary latency can create. The short hold deadline makes expiry observable without making the viewer wait through a real checkout timeout.

Run `npm run verify:experiments` while the local preview is available to execute all six stages and assert their expected database outcomes.

## Performance experiments

The purchase API accepts a positive integer `quantity`, and experiment creation accepts `initialStock` from 1 to 10,000. The allocation and reservation ledgers record quantities so the invariant is measured in units rather than row counts.

Run `npm run benchmark:load -- --base-url <deployed-url> --stock 100 --buyers 500 --concurrency 50 --products 1 --max-quantity 5 --runs 3` from `product/` to generate a deterministic hot-product workload. The runner reports client-observed throughput, p50/p95/p99 latency, server latency for accepted and rejected purchases, response errors, and database conservation checks. Use a dedicated benchmark deployment for published measurements.

The `--products` option divides the same total stock across independent inventory records and sends buyers to them round-robin. Comparing `--products 1` with `--products 10` keeps the total buyers, stock, concurrency, Worker and database fixed while changing only the key distribution.

Use `--compare-products 10` to run a paired comparison. The runner alternates scenario order for each pair, disables educational trace writes, verifies the expected outcome with `--expected accepted|mixed|rejected`, and reports lookup and transaction timing separately. For example:

`npm run benchmark:load -- --base-url <benchmark-url> --stock 1000 --buyers 1000 --concurrency 50 --products 1 --compare-products 10 --runs 10 --expected accepted --output benchmarks/strong-success-c50.json`

The benchmark deployment binds four independent D1 databases. Use `--database-shards 1 --compare-database-shards 4` to keep the product workload fixed while testing whether independent database queues change performance:

`npm run benchmark:load -- --base-url <benchmark-url> --stock 1000 --buyers 1000 --concurrency 50 --products 10 --database-shards 1 --compare-database-shards 4 --runs 10 --expected accepted --output benchmarks/strong-database-shards-c50.json`

The raw exploratory results and methodology are checked into `benchmarks/` so the numbers shown by the website can be audited and regenerated.

## Local development

Use Node.js 22.13 or later. Generate and apply the D1 migration before starting the site; see the starter-compatible scripts in `package.json` and the migration under `drizzle/`.

## Source and production

The repository at `HussainAbuwala/systems-from-first-principles` is the canonical source. The application deploys from the `product/` directory to Cloudflare Workers and uses the `DB` binding for its D1 database.

The checked-in `wrangler.jsonc` contains non-secret resource identifiers and production runtime configuration. Run `npm run deploy` from `product/` to apply pending D1 migrations and deploy the Worker. This keeps production independent from whichever ChatGPT account performs the next development session.

The `benchmark` Wrangler environment is a separate Worker with four D1 database bindings. Run `npm run deploy:benchmark` before collecting measurements so load experiments cannot change the public demonstration's data or consume its write capacity.

## Product rule

Every version begins with a stated requirement, runs a repeatable experiment, exposes the resulting state and implementation, and carries forward the invariants established by earlier versions.

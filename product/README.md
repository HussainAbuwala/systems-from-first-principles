# Systems from First Principles

An interactive lab for building real software systems one requirement at a time.

The first system is an inventory reservation service. It currently contains four executable stages:

- `read → decide → write` reproducibly creates two promises from one unit;
- an atomic conditional update permits exactly one promise;
- a durable payment hold protects that unit while Alice pays, but strands it when she abandons checkout;
- an expiring hold returns the abandoned unit so Bob can acquire it on retry.

Every path executes against persistent database state and emits a database trace. The deliberate pause in the naïve implementation exposes the same unsafe gap that ordinary latency can create. The short hold deadline makes expiry observable without making the viewer wait through a real checkout timeout.

Run `npm run verify:experiments` while the local preview is available to execute all four stages and assert their expected database outcomes.

## Local development

Use Node.js 22.13 or later. Generate and apply the D1 migration before starting the site; see the starter-compatible scripts in `package.json` and the migration under `drizzle/`.

## Source and production

The repository at `HussainAbuwala/systems-from-first-principles` is the canonical source. The application deploys from the `product/` directory to Cloudflare Workers and uses the `DB` binding for its D1 database.

The checked-in `wrangler.jsonc` contains non-secret resource identifiers and production runtime configuration. Run `npm run deploy` from `product/` to apply pending D1 migrations and deploy the Worker. This keeps production independent from whichever ChatGPT account performs the next development session.

## Product rule

Every version begins with a stated requirement, runs a repeatable experiment, exposes the resulting state and implementation, and carries forward the invariants established by earlier versions.

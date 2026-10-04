# Episode format

Every episode takes one confined problem from the cheapest design that works to a design that serves real scale. The design is never planned in advance. It changes only when an event on the script breaks it.

## The arc

1. **The problem in one sentence**, shown as a user moment, before any technology is named.
2. **Stage 0:** the simplest thing that works, deployed for real, free or close to it.
3. **Events, in order.** Each one is a traffic step, a new requirement, or a failure. For each event:
   - run it against the current design;
   - **survived:** say so, show the numbers, move on. No change;
   - **broke:** show the break on a real graph, name the resource that ran out, consider at least two fixes, make the smallest one that passes, and rerun.
4. **The scoreboard**, filled one row per stage as the episode goes.
5. **The final claim:** what the system handles, at what latency, for what monthly cost, and which resource is closest to its limit.
6. **The interview cut:** the same system told in interview order, in two or three minutes. See [below](#the-interview-cut).

## The event script

The event script is the list of everything that will happen to the system, written and locked **before stage 0 is built**.

Why lock it first: if the events are chosen while building, it is too easy to invent the event that justifies the component you already wanted to teach ("now we need Kafka"). A locked script means the design has to answer to events it did not get to pick. It also keeps the series promise that the answer is not known at the start.

Each event has:

- **Type:** `Load` (more traffic or more data), `Requirement` (a new thing the product must do), or `Failure` (something is killed or cut off).
- **What happens:** rates, data size, duration, or the new behaviour, precisely enough that a script can generate it.
- **Pass criteria:** latency at p99, error rate, and correctness checks. Fixed per event, never loosened after a run.

Rules after lock:

- Events are not reordered, removed, or made easier.
- A new event may be **appended** only if something learned during the build makes it necessary. Record it in the script's changelog with the reason. Appended events are shown as appended in the video.
- Pass criteria never change after a run has been seen.

Use the [event script template](../templates/event-script-template.md).

## Plausible, not rigged

Failures are the best teaching moments, but only honest ones. Before any design choice goes on screen, it must pass three questions:

1. **Would a reasonable engineer pick this,** knowing only the events played so far? Simple, cheap, default, or common beginner choices all qualify.
2. **Can we say in one sentence why it is sensible?** For example: "it is the default", "it is one file and no extra service", "it is how most tutorials do it".
3. **Are we giving it a fair run?** We use it the way its documentation recommends, and diagnose any failure down to a real limit before replacing it.

A choice made *because* it will fail teaches nothing: the fix looks clever only because the starting point was silly, and experienced viewers will notice.

Plausible choices that later fail are welcome, and often the most useful lessons in the episode. Some will fail even before stage 0 passes E01. Those **attempts** are shown too, with what they taught, before the first design that passes.

## Changing the design

A change is allowed only when the current event fails. For each change, record in the [stage log](../templates/stage-template.md):

- the run that failed and the graph showing it;
- the saturated resource (CPU, memory, disk I/O, connections, locks, network, a provider limit) with the measurement that proves it;
- at least two options, what each would cost, and why the chosen one is the smallest that passes;
- a rerun of **every event so far** on the new design. A fix that breaks an earlier event is not a fix.

Rejected options matter as much as the chosen one. "We did not add a cache here, because the database was at 12% CPU" is the kind of sentence this series exists to say.

## Accepted failures

Sometimes the honest choice is not to fix a failing rule, because the fix costs far more than the failure. That is allowed only in the open:

- The run stays recorded as **FAIL**, with the rule unchanged; the stage log marks it **accepted (won't fix)** with the reason and what the fix would have cost.
- The scoreboard and the final claim state the limitation in plain words.
- The video shows the alternative and its price, so the viewer can disagree.

A correctness failure that loses or corrupts what users were promised (a confirmed link, a name with two owners) cannot be accepted.

## The scoreboard

One row per stage. Every cell is either measured or derived from measured numbers.

| Stage | Design in one line | Peak load passed | p99 | Errors | Data size | $/month | What broke it |
|---|---|---|---|---|---|---|---|

The final row turns into the claim: "This design handles N clicks a month (derived from M req/s measured at peak, using the traffic model), p99 X ms, for $Y a month. The resource closest to its limit in the largest run was Z, at W% utilisation, so that is what breaks next."

## The interview cut

A short closing segment, also kept as a written page in the episode folder. It retells the final system in the order an interview expects:

1. Requirements and the numbers behind them (from the traffic model).
2. The final design, one component at a time.
3. For each component, the stage where it appeared and the number that forced it.
4. What runs out next (the resource closest to its limit in the largest run) and the next move.

Interviews start with the scale and design backwards. The series builds forwards. The interview cut is the bridge: knowing the breaking point of every stage is what answers the follow-up questions. Use the [interview cut template](../templates/interview-cut-template.md).

## Length

One problem is one long-form episode by default. If the honest story needs more than about eight stages, split it into parts at a natural scale boundary, with the scoreboard carried across.

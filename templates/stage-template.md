# Stage NN: Short name

## Trigger

- **Event:** ENN (Load | Requirement | Failure)
- **Failed run:** `results/<run-id>/`
- **What the user would notice:**

## Diagnosis

The resource that ran out, and the measurement that shows it.

| Resource | Value during the run | Limit |
| --- | --- | --- |
|  |  |  |

## Attempts that failed

Plausible designs tried for this stage that did not pass, and what each one taught.

| Attempt | Why it was plausible | What failed (run ID) | Lesson |
| --- | --- | --- | --- |
|  |  |  |  |

## Options considered

| Option | What it fixes | What it costs (money, operations, complexity) | Chosen? Why |
| --- | --- | --- | --- |
|  |  |  |  |

## Change

The smallest change that passes, in a few lines. Link the commit.

## Rerun of every event so far

| Event | Run ID | p99 | Errors | Correct | Pass |
| --- | --- | --- | --- | --- | --- |
| E01 |  |  |  |  |  |

## Scoreboard row

| Stage | Design in one line | Peak load passed | p99 | Errors | Data size | $/month | What broke it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NN |  |  |  |  |  |  |  |

## Interview line

One sentence for the interview cut: "We added X at stage NN, because at N req/s, Y ran out."

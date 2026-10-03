# Event script: Problem name

**Status:** Draft | Locked YYYY-MM-DD

Once locked, events are not reordered, removed, or made easier. New events may only be appended, with a reason in the changelog. See [format](../docs/FORMAT.md#the-event-script).

## The product

One paragraph: what it does for a user, in plain words.

## Traffic model (input)

| Input | Value | Why this value |
| --- | --- | --- |
| Reads per user per day |  |  |
| Writes per user per day |  |  |
| Peak factor (peak ÷ daily average) |  |  |
| Key distribution |  |  |
| Payload size |  |  |

Conversions used to derive user and monthly figures:

- `monthly requests = (peak req/s ÷ peak factor) × 2,629,800 s`

## Default pass criteria (input)

| Measure | Threshold |
| --- | --- |
| p99 latency, reads |  |
| p99 latency, writes |  |
| Error rate |  |
| Correctness | Every acknowledged write is readable; no wrong answer served |

Events may tighten these, never loosen them.

## Test budget

Total spend allowed for all runs in this episode: $

## Events

| ID | Type | What happens | Pass criteria (if not default) |
| --- | --- | --- | --- |
| E01 | Requirement | Launch: the core feature works for real users |  |
| E02 | Load |  |  |

## Changelog

| Date | Change | Reason |
| --- | --- | --- |
| YYYY-MM-DD | Locked |  |

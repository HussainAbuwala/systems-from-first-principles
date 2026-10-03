# Systems from First Principles

Start with the cheapest thing that could possibly work. Throw real traffic at it. Add a piece only when something breaks or a new requirement arrives that the current design cannot deliver. End with a system that serves real scale, and say exactly how much it handles and what it costs, because we measured it.

This repository supports **Systems from First Principles**, a video series on **The Unplanned Stack** YouTube channel.

## Why this series exists

Most system design teaching shows the finished architecture: draw the boxes, explain each one, move on. Three things get lost:

1. **What forced each piece.** Viewers memorise the final diagram but cannot say why any box is there, or what number made it necessary.
2. **The break itself.** "This won't scale" is asserted, never shown. Architecture problems only appear at scale, so small examples hide them.
3. **When not to add a box.** The default answer reaches for queues, caches, and shards before anything has strained. Nobody shows how far a simple design actually goes.

This series does the opposite. The simple design gets a fair chance, every break is reproduced under load, and every number on screen comes from a measurement.

## The rules

1. **Start embarrassingly simple, but plausible.** Free or nearly free. If people laugh at stage 0, good. Every choice must be one a reasonable engineer could defend at that point; plausible choices that later fail are the best lessons. Choices made *because* they will fail are not allowed.
2. **The event script is fixed before building.** The traffic steps and new requirements are written down and locked before stage 0 exists. See [format](docs/FORMAT.md#the-event-script).
3. **Change the design only for a reason on the script.** A load step broke it, or a requirement cannot be met. "It would be best practice" is not a reason.
4. **Surviving counts.** When an event passes without changes, the video says so. That is the point.
5. **Everything is measured.** Capacity, latency, errors and cost come from real runs. Anything derived is arithmetic on measured numbers with the formula shown. See [measurement standard](docs/MEASUREMENT.md).
6. **End with the scoreboard.** What the final system handles, at what latency, for what monthly cost, and which resource runs out next.

## Episodes

| Episode | Status | Central question |
| --- | --- | --- |
| [URL shortener](episodes/url-shortener/README.md) | Event script locked; building tools and stage 0 | How far does one file on a €5 server get you, and what does it take to handle almost a billion clicks a month? |

Earlier episodes used a different format (reconstructing a company's system from its engineering posts). They live in [archive](archive/README.md).

## Repository structure

```text
docs/        Format, measurement standard, topic selection, production guide
templates/   Event script, stage log, interview cut, script and storyboard
episodes/    One folder per problem: event script, stages, results, script
archive/     Earlier-format episodes, their animation workspace and lab
```

Narration WAV files use Git LFS; run `git lfs install` once before cloning or pulling the repository.

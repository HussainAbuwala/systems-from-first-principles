# Systems from First Principles

Real-world software systems reconstructed from public engineering sources, starting with the simplest design and evolving it through failures, constraints, and production tradeoffs.

This repository supports **Systems from First Principles**, a video series on **The Unplanned Stack** YouTube channel. Each episode asks:

1. What problem are we solving?
2. Why does the simplest solution fail?
3. What does each added piece of complexity buy us?

## Evidence standard

- **Documented** — explicitly stated in a first-party engineering source.
- **Inferred** — supported by public evidence but not directly stated.
- **Proposed** — an educational simplification developed for the episode.

Company posts are dated snapshots, not proof of a complete or current architecture.

## Episodes

| Episode | Status | Central question |
| --- | --- | --- |
| [Figma multiplayer](episodes/figma-multiplayer/README.md) | Long form complete; Short in progress | How can multiple people edit one design without losing work? |
| [Shopify inventory reservations](episodes/shopify-inventory-reservations/README.md) | Story and canvas revised; ready to rehearse | How do we avoid promising the same last item twice? |

## Interactive lab

The companion application turns each requirement into a repeatable experiment backed by real infrastructure. The inventory system currently demonstrates the naïve concurrency race, an atomic inventory decision, a stranded payment hold, and an expiring hold that returns abandoned stock.

[Open the live lab](https://systems-from-first-principles.hussainabuwala-1997.workers.dev) or see [`product/`](product/README.md) for local development and deployment.

## Repository structure

```text
episodes/    Research, scripts, recordings, diagrams, and publishing assets
animation/   Reusable Remotion components and active compositions
product/     Interactive experiments deployed to Cloudflare Workers and D1
docs/        Cross-episode production guidance and lessons
templates/   Repeatable research and writing documents
```

Generated dependencies, audio beds, previews, and final renders stay out of Git. Choose topics with the [episode selection criteria](docs/episode-selection.md), then read the [video production guide](docs/video-production-guide.md) before beginning a new episode.

Narration WAV files use Git LFS; run `git lfs install` once before cloning or pulling the repository.

# Systems from First Principles

Real-world software systems reconstructed from public engineering sources, starting with the simplest design and evolving it through failures, constraints, and production tradeoffs.

This repository supports **The Unplanned Stack** video series. Each episode asks:

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

## Repository structure

```text
episodes/    Research, scripts, recordings, diagrams, and publishing assets
animation/   Reusable Remotion components and active compositions
docs/        Cross-episode production guidance and lessons
templates/   Repeatable research and writing documents
```

Generated dependencies, audio beds, previews, and final renders stay out of Git. See the [video production guide](docs/video-production-guide.md) before beginning a new episode.

Narration WAV files use Git LFS; run `git lfs install` once before cloning or pulling the repository.

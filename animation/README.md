# Animation workspace

Remotion compositions for the Figma multiplayer long-form episode, its system-map outro, and the vertical Short.

## Setup

```bash
npm install
npm run audio:generate
npm run studio
```

The generated music and room-tone WAV files are intentionally ignored. Cleaned narration lives in `public/audio/voice`; the original recordings remain with the episode.

## Render

```bash
npm run render:review          # silent 720p review
npm run render:voice           # narration without music
npm run render:youtube         # final 1920x1080 YouTube master
npm run render:short           # 1080x1920 Short
```

All renders go to the ignored `out/` directory. The YouTube command uses H.264, 24 fps, standard 4:2:0, BT.709, AAC audio, and a native 1.5x Remotion render rather than enlarging a finished 720p video.

## Active compositions

- `FigmaHandDrawnFullEpisode` — silent review composition
- `FigmaHandDrawnNarrated` — voice-only long form
- `FigmaHandDrawnNarratedMusic` — final long form
- `FigmaSystemMapOutro` — isolated recap for iteration
- `FigmaMultiplayerShort` — vertical Short

See [the production guide](../docs/video-production-guide.md) before starting another episode.

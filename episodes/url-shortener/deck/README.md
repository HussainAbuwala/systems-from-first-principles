# Deck: URL shortener

The board presented on camera in the episode: 66 slides drawn on a canvas in the [visual language](../../../docs/visual-language.md), with Present mode (arrow keys, laser pointer on L, notes on N) and a Read view of every slide with its narration.

| File | What it is |
| --- | --- |
| `episode.src.html` | Layout and drawing code; `__BEATS__` and `__RUNS__` are filled in by the build |
| `beats.js` | The 66 slides in order: chapter, kind, build steps and narration |
| `runs.json` | Per-second measurements from the runs the replays draw (from `../results/`) |
| `episode.html` | The built page, exactly as presented (open it in a browser) |
| `build.py` | Rebuilds `episode.html`; `--print` also writes `print.html` |

Rebuild after editing, and make the PDF ([`../slides.pdf`](../slides.pdf)) from `print.html`:

```bash
python3 build.py --print
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --virtual-time-budget=20000 --no-pdf-header-footer --print-to-pdf=../slides.pdf "file://$PWD/print.html"
```

Fonts (IBM Plex Sans and Mono) load from Google Fonts, so open or print it online, or with Plex installed.

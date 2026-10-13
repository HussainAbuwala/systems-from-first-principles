# YouTube metadata: URL shortener (final)

- Video: `~/Movies/llm-series/url-shortener-full-episode.mp4` (1:39:12, 1080p30, audio at -16 LUFS)
- Subtitles: `subtitles.en.srt` in this folder (also `~/Movies/llm-series/url-shortener-full-episode.en.srt`); upload under Subtitles → English
- Slides: `slides.pdf` in this folder, all 66 slides in their final state
- Thumbnail: `~/Movies/llm-series/url-shortener-thumbnail.png` (Design Bitly, long link → bit.ly/FXsk, "one €5 server → 877M clicks/mo", round photo; source `thumbnails/src/thumbs4.html?v=3`)

## Title

URL Shortener System Design, Actually Built and Load-Tested (Bitly)

## Description

```text
URL shortener system design (Bitly, TinyURL), actually built and load-tested. We start with one Node app and one SQLite file on a €5 server, hit it with nine events (a viral link, a power cut, the machine being deleted...), and fix only what breaks.

Result: about 877M clicks and 17.5M new links a month on one server, redirect p99 14.8 ms, 0 errors, €9.56 a month.

Slides (PDF):
https://github.com/HussainAbuwala/systems-from-first-principles/blob/main/episodes/url-shortener/slides.pdf

Code, run logs and results for this episode:
https://github.com/HussainAbuwala/systems-from-first-principles/tree/main/episodes/url-shortener

The heartbeat fix (1:29:21): right after a fresh full copy, Litestream held SQLite's write lock for about 30 s and froze the app. Writing one row every second keeps that check small. Write-up:
https://github.com/HussainAbuwala/systems-from-first-principles/blob/main/episodes/url-shortener/stages/07-counter-jump.md

Caveats: one event at a time, load generated from the same data centre, a single data centre, and no domain (IP address and a self-made certificate).

Chapters
0:00 What a URL shortener does
4:32 How far does one €5 server get you?
5:18 The nine events
6:31 Rules and traffic numbers
16:13 v0: one Node app + one SQLite file
20:50 E01 Launch
24:52 E02 1% of Bitly
26:29 E03 Custom names → v1, v2 (nginx)
42:23 E04 A link goes viral → v3 (4 cores)
50:03 E05 Click counts → v4
58:39 E06 Power cut → v5
1:07:15 E07 The machine is lost → v6 (Litestream)
1:15:29 E08 10% of Bitly → v7 (counter jump)
1:30:37 E09 Takedowns → v8
1:35:01 Final claim and caveats

#systemdesign #urlshortener #systemdesigninterview
```

## Tags

url shortener system design, system design, system design interview, design url shortener, design bitly, bitly system design, tinyurl system design, design tinyurl, url shortener, build a url shortener, system design from scratch, sqlite in production, litestream, nginx, node.js, load testing, p99 latency, tls handshake, base62, hetzner, backend engineering, the unplanned stack

## Other fields

- Category: Science & Technology (or Education)
- Playlist: Systems from First Principles
- Pinned comment idea: "Which event did you think would break it first? Pause at each run and guess before the result shows."

## Alternatives considered

Other titles: *Design a URL Shortener (Bitly): I Built It and Load-Tested It*; *URL Shortener System Design: 877M Clicks a Month on One Server*; *System Design Interview: URL Shortener, but We Actually Build It*; *Design Bitly on One €9.56 Server: System Design From Scratch*. Other thumbnails: `thumbnails/thumb-1.png`, `thumb-2.png` (for YouTube's Test & Compare), earlier sets in `thumbnails/v1/` to `v4/`.

## Search research (checked 2026-10-12)

- YouTube autocomplete for "url shortener" puts **url shortener system design** first among technical queries; its own suggestions add *interview*, *hello interview*, *bytebytego*, *gaurav sen*, *hld/lld*. Other phrasings people type: **design url shortener like tinyurl**, **tinyurl system design**, **bitly system design**.
- The top results for "url shortener system design" all front-load the same words: *Design a URL Shortener (Bitly) - System Design Interview* (NeetCode, 151K), *Tiny URL - System Design Interview Question (URL shortener)* (TechPrep, 327K), *Beginner System Design Interview: Design Bitly* (Hello Interview, 403K), *URL shortener system design | tinyurl system design | bitly system design* (523K).
- Their thumbnails: a large face cutout on one side, one or two huge words (Bitly, Tiny URL), a small label like "System Design".
- What none of them do: build it and measure it. Every top result is a whiteboard answer. That is this video's difference, and it goes after the keywords, not before.
- Second audience: "SQLite in production" videos do well (e.g. *Litestream + SQLite: Scale to 1M Users Without Postgres*, 24K in 2 months), which fits the one-server, one-SQLite-file angle.


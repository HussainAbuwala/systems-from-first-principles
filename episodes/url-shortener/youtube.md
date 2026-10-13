# YouTube metadata: URL shortener (final)

- Video: `~/Movies/llm-series/url-shortener-full-episode.mp4` (1:39:12, 1080p30, audio at -16 LUFS)
- Thumbnail: `~/Movies/llm-series/url-shortener-thumbnail.png` (Design Bitly, long link → bit.ly/FXsk, "one €5 server → 877M clicks/mo", round photo; source `thumbnails/src/thumbs4.html?v=3`)

## Title

URL Shortener System Design, Actually Built and Load-Tested (Bitly)

## Description

```text
URL shortener system design (Bitly, TinyURL), but actually built and load-tested. How far does one file on a €5 server get you? We build a URL shortener from the simplest thing that works (one Node app and one SQLite file on one cloud server) and throw nine events at it: real traffic, a viral link, a power cut, the machine being deleted, takedowns. Every time something breaks, we measure why and make the smallest change that fixes it.

Where it ends up: about 877 million clicks and 17.5 million new links a month, 100 million links stored, redirect p99 14.8 ms, 0 errors, for €9.56 a month on one machine.

Every number in this video comes from a real load test on Hetzner servers. The code, event script, run logs and results for this episode are all public:
https://github.com/HussainAbuwala/systems-from-first-principles/tree/main/episodes/url-shortener

The nine events
E01 Launch: 1 click/s
E02 1% of Bitly: 100 clicks/s, 10 million links
E03 Custom names: 50 people claim the same name at once
E04 A link goes viral: 2,000 clicks/s on one link
E05 Click counts per link, within 1%
E06 Power cut, without warning
E07 The machine and its disk are deleted
E08 10% of Bitly: 1,000 clicks/s, 100 million links
E09 Takedowns: removed links stop within 60 s

The eight fixes
v0 One Node program + SQLite, HTTPS served directly (€5.99/mo)
v1 + a names table
v2 + nginx in front, to do TLS on every core
v3 same software, 4 vCPU instead of 2 (€8.99/mo)
v4 click counts kept in memory, saved once a second
v5 durable saves (SQLite synchronous = EXTRA)
v6 Litestream copies every change to a Volume; health checks; one-command rebuild (€9.56/mo)
v7 counter jump after a restore, plus a heartbeat save
v8 takedowns (410 Gone)

About the heartbeat fix (mentioned around 1:29)
In one of the three E08 runs the app froze for about 30 seconds right at the start. Right after Litestream makes a fresh full copy of the database, its next checkpoint takes SQLite's write lock and then checks the newest file in the copy page by page. Straight after a full copy, that file is the whole 1.7 GB copy, so the lock is held for about 30 s. Node does its saves on its only thread, so every request, redirects included, waited behind it. The fix: the once-a-second save always writes to a one-row heartbeat table, so Litestream always has a small change file to check instead of the full copy. In the same scenario the lock was never held for 500 ms or more over 12 minutes (30.5 s without the heartbeat). Full write-up:
https://github.com/HussainAbuwala/systems-from-first-principles/blob/main/episodes/url-shortener/stages/07-counter-jump.md

Caveats
- One event at a time: combinations (like a viral spike during a power cut) weren't tested, and the power cut and machine loss ran at 1% of Bitly traffic.
- Measured next door: the load generator ran in the same data centre, so times don't include visitors' own internet connections.
- One machine, one data centre: losing the whole data centre isn't covered.
- No domain: links use the server's IP address and a self-made certificate (the TLS handshakes are still real).

Chapters
0:00 Intro: what a URL shortener does
2:07 Why short links exist
4:32 How far does one €5 server get you?
5:18 The nine events, locked before we build
6:31 Always-true rules: redirect p99 < 100 ms, create p99 < 300 ms
10:33 Traffic numbers from Bitly (1% and 10%)
16:13 v0: one Node app + one SQLite file
18:12 Base-62 codes
20:50 E01 Launch: 1 click/s
24:52 E02 1% of Bitly: 100 clicks/s, 10M links
26:29 E03 Custom names: 50 people, one name
29:17 v1: a names table
33:41 Why v1 failed: Node's one thread and TLS handshakes
37:06 Three ways out, v2: nginx in front
42:23 E04 A link goes viral: 2,000 clicks/s
45:37 Why it broke: one click, in time
47:00 v3: same software, 4 cores
50:03 E05 Click counts
54:40 v4: count in memory, save every second
58:39 E06 Power cut
1:01:17 Why the save came back undone (SQLite's journal)
1:04:17 v5: synchronous = EXTRA
1:07:15 E07 The machine is lost
1:10:45 v6: Litestream to a Volume
1:15:29 E08 10% of Bitly: 1,000 clicks/s, 100M links
1:17:04 How Litestream keeps a copy
1:20:34 Why creates got slow
1:23:05 v7: the counter jump
1:30:37 E09 Takedowns, v8: 410 Gone
1:35:01 Scoreboard and the final claim
1:36:20 Caveats

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


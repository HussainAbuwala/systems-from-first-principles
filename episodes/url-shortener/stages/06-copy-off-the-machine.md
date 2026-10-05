# Stage 06: Copy off the machine

Status: **designing** (options chosen 2026-10-05; nothing built yet).

## Trigger

- **Event:** E07 (Failure): under E02 load the server and its disk are deleted for good. Rules: service back on a new machine within 1 hour; at most the last 5 minutes of acknowledged links lost.
- **Failed run:** none. Stage 5 fails E07 by construction, so no run was paid for (checked through the Hetzner API on 2026-10-05):
  - the only copy of `links.db` is on `sfp-app`'s own disk;
  - Hetzner backups are off (no backup window), and the account has no Volumes and no snapshots;
  - the server's IPv4 address is set to `auto_delete=true`, so it would be deleted with the server. Every short link handed out contains that address, so even a perfect copy of the data would leave all existing links pointing nowhere.
- **What the user would notice:** every short link stops working, permanently. Nothing to restore from.

## Diagnosis

No resource ran out. The design has a single copy of the data and a single, disposable address, both tied to one machine.

## Options considered

Two separate choices: what carries the copy (the courier) and where it lives (the destination). Prices checked on Hetzner's own pages and API on 2026-10-05, excluding VAT.

**Courier**

| Option | What it fixes | What it costs | Chosen? Why |
| --- | --- | --- | --- |
| Hetzner daily backups | A copy off the disk | 20% of the server price (€1.70/month) | No: once a day, far past the 5-minute rule, and deleted together with the server |
| Periodic full copies (SQLite's safe-copy command, every few minutes) | A copy within minutes | Resends the whole database every time, heavy at E08's size; in the current rollback mode a long read blocks writes, so creates would stall during each copy (not measured) | No: probably needs WAL mode anyway, and loses minutes rather than about a second |
| `sqlite3_rsync` on a schedule | Sends only changed pages | Needs WAL mode and a machine at the other end that can run it; newer, less used; loss up to the gap between runs | No |
| **Litestream** (continuous, changes only) | A copy about a second behind; restore to any moment within its history | One more program on the server; SQLite must switch to WAL mode (E06 must be rerun) | **Yes**: barely bigger than a scheduled job, and light as the data grows |
| Live second server | Takeover in seconds, almost no loss | A second server every month plus failover machinery | No: E07 allows an hour |

**Destination**

| Option | What it is | Cost for us | Chosen? Why |
| --- | --- | --- | --- |
| Database itself on a Volume | The live file on a network disk that outlives the server | about €0.57/month | No: still the only copy; the disk holding the data is what E07 deletes |
| **Copy on a Volume** | Block storage: SSDs, every block on three servers; attaches to one server at a time, same location only | €0.0572 per GB-month, 10 GB minimum: about €0.57/month | **Yes**: the smallest and cheapest option that passes |
| Storage Box (BX11) | File storage: one server's hard drives in RAID, reached over SFTP; snapshots; can be in another city | €3.20/month for 1 TB, no setup fee | No, but shown as the alternative |
| Object Storage | Object storage: hard drives with erasure coding across many servers, reached by S3 web requests; can be in another city | €6.49/month base, includes 1 TB | No, but shown as the alternative |

**What the Volume gives up (stated in the video):**
- It is plugged into the server like a folder, so a mistake on the server (a wrong delete, a bad script) can reach the copy as easily as the original.
- Hetzner keeps no snapshots of Volumes. Its three copies are redundancy against broken hardware, not a backup against deletion; only Litestream's own history allows going back.
- It can only be in the same location as the server. A site-wide loss (not an event in this episode) would need the Storage Box or Object Storage in another city.

**Also decided:**
- **Detection:** a new `GET /health` that does a tiny database read, watched by an external monitoring service (set to ignore our self-made certificate), alerting by email and phone app.
- **Recovery:** started by a person after the alert, then one script: new server in nbg1, install, attach the Volume, `litestream restore`, move the IP, check known links, start copying again.
- **Address:** set the IPv4 to survive server deletion (`auto_delete=false`) so it can be moved to the new server. Primary IPs are tied to their location, which keeps recovery in nbg1 anyway.
- **Timing in E07:** recorded in three parts: deletion to alert, alert to start, start to links working. During runs, recovery starts from the monitoring service's alert, not from our own checks, so the detection time is the real one.

**Details checked (2026-10-05):**
- **Hetzner backups are deleted with their server** (API reference: "If you delete the Server, you also delete all backups bound to it"), so they would not survive E07 even if they ran often enough.
- **Deleting a server detaches, not deletes,** its Volumes and Primary IPs (API reference), except that a Primary IP with `auto_delete=true` is deleted. Volumes and Primary IPs can only be used by servers in their own location. A Primary IP can only be moved to a powered-off server, but `hcloud server create --primary-ipv4 … --volume … --automount` attaches both at creation, so recovery is one create call.
- **Volumes can be protected from deletion** (a Hetzner setting). It does not stop files on it being deleted from the server.
- **The recovered server must carry `keep=true`**, or the watchdog will delete it when its lifetime runs out.
- **`synchronous` under WAL:** SQLite documents `NORMAL` as not durable across power loss in WAL mode ("might roll back following a power loss"), and `FULL` as durable; `EXTRA` "is no different from FULL in WAL mode". Litestream's tips recommend `NORMAL`, which would reopen the E06 failure, so we keep `EXTRA` (equal to `FULL`) and say so.
- **Litestream also recommends** `busy_timeout = 5000` (it takes short write locks when it folds the WAL into the main file; our app sets no timeout, so a create would fail instead of waiting) and `wal_autocheckpoint = 0` (let Litestream do the folding, so it never misses a change).
- **Monitoring service:** UptimeRobot's free plan has 5-minute checks, no API access, and is described as for "hobby and non-profit projects". Better Stack's free plan is "free for personal projects", and has a `verify_ssl` switch, push/SMS/call alert options and a token-based API; its free-plan check interval and API access are to be confirmed after sign-up.

**User decisions (2026-10-05):** keep `synchronous=EXTRA` against Litestream's advice; Better Stack's free plan (this is a personal project; the user signs up); turn on deletion protection for the Volume.

## Change

Pending.

## Rerun of every event so far

Pending.

## Scoreboard row

Pending.

## Interview line

Pending.

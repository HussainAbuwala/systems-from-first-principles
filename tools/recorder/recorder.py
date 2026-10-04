#!/usr/bin/env python3
"""Record what a Linux machine is doing, once a second, until stopped.

    recorder.py OUT.csv [PROCESS_NAME ...]

Columns: unix time, busy % of each CPU core, % of CPU time spent waiting for
disk (iowait) and taken by the host for other customers' machines (steal), memory used, disk and network
throughput, open TCP connections, and sockets in TIME_WAIT. Per-core CPU
matters because a single-threaded program can saturate one core while the
average looks half idle. For each PROCESS_NAME (e.g. node), also records that
program's own CPU use as a % of one core, which a single-threaded program
caps at about 100 no matter which core the OS runs it on, and its memory.
Reads /proc only; needs nothing installed.
"""
import os
import sys
import time

TICKS = os.sysconf("SC_CLK_TCK")
PAGE_KB = os.sysconf("SC_PAGE_SIZE") // 1024


def process_usage(name):
    """Total CPU ticks and resident memory (MB) of all processes called name."""
    ticks = rss_kb = 0
    for pid in filter(str.isdigit, os.listdir("/proc")):
        try:
            with open(f"/proc/{pid}/stat") as f:
                stat = f.read()
        except OSError:
            continue
        # Match the program's file name (node renames its main thread to
        # "MainThread", so the kernel's short name cannot be trusted).
        try:
            with open(f"/proc/{pid}/cmdline", "rb") as f:
                argv0 = f.read().split(b"\0", 1)[0].decode(errors="replace")
        except OSError:
            continue
        # nginx renames its processes "nginx: master process ..." and
        # "nginx: worker process", so also match "<name>:" at the start.
        if os.path.basename(argv0) != name and not argv0.startswith(name + ":"):
            continue
        fields = stat[stat.rindex(")") + 2:].split()
        ticks += int(fields[11]) + int(fields[12])  # utime + stime
        rss_kb += int(fields[21]) * PAGE_KB
    return ticks, rss_kb // 1024


def cpu_times():
    cores = {}
    with open("/proc/stat") as f:
        for line in f:
            if line.startswith("cpu") and line[3].isdigit():
                name, *vals = line.split()
                vals = list(map(int, vals))
                idle = vals[3] + vals[4]  # idle + iowait
                steal = vals[7] if len(vals) > 7 else 0  # time the host gave our vCPU to someone else
                cores[name] = (sum(vals), idle, vals[4], steal)
    return cores


def meminfo_mb():
    info = {}
    with open("/proc/meminfo") as f:
        for line in f:
            key, val = line.split(":")
            info[key] = int(val.split()[0])
    return (info["MemTotal"] - info["MemAvailable"]) // 1024


def disk_sectors():
    read = written = 0
    with open("/proc/diskstats") as f:
        for line in f:
            parts = line.split()
            dev = parts[2]
            # whole disks only (sda, vda, nvme0n1), not partitions
            if dev.startswith(("sd", "vd")) and not dev[-1].isdigit() or (dev.startswith("nvme") and "p" not in dev[4:]):
                read += int(parts[5])
                written += int(parts[9])
    return read, written


def net_bytes():
    rx = tx = 0
    with open("/proc/net/dev") as f:
        for line in f.readlines()[2:]:
            iface, data = line.split(":", 1)
            if iface.strip() == "lo":
                continue
            vals = data.split()
            rx += int(vals[0])
            tx += int(vals[8])
    return rx, tx


def sockets():
    with open("/proc/net/sockstat") as f:
        for line in f:
            if line.startswith("TCP:"):
                parts = line.split()
                inuse = int(parts[parts.index("inuse") + 1])
                tw = int(parts[parts.index("tw") + 1])
                return inuse, tw
    return 0, 0


def main():
    out = open(sys.argv[1], "w", buffering=1)
    procs = sys.argv[2:]
    prev_cpu, prev_disk, prev_net = cpu_times(), disk_sectors(), net_bytes()
    prev_proc = {p: process_usage(p)[0] for p in procs}
    names = sorted(prev_cpu, key=lambda n: int(n[3:]))
    out.write("ts," + ",".join(f"{n}_busy_pct" for n in names) +
              ",cpu_iowait_pct,cpu_steal_pct,mem_used_mb,disk_read_kbps,disk_write_kbps,net_rx_kbps,net_tx_kbps,tcp_inuse,tcp_timewait" +
              "".join(f",{p}_cpu_pct,{p}_rss_mb" for p in procs) + "\n")
    next_tick = time.time() + 1
    while True:
        time.sleep(max(0, next_tick - time.time()))
        next_tick += 1
        cpu, disk, net = cpu_times(), disk_sectors(), net_bytes()
        busy, iowait_total, steal_total, total_all = [], 0, 0, 0
        for n in names:
            total = cpu[n][0] - prev_cpu[n][0]
            idle = cpu[n][1] - prev_cpu[n][1]
            iowait_total += cpu[n][2] - prev_cpu[n][2]
            steal_total += cpu[n][3] - prev_cpu[n][3]
            total_all += total
            busy.append(100 * (total - idle) / total if total else 0)
        iowait = 100 * iowait_total / total_all if total_all else 0
        steal = 100 * steal_total / total_all if total_all else 0
        inuse, tw = sockets()
        row = [f"{time.time():.0f}"] + [f"{b:.1f}" for b in busy] + [
            f"{iowait:.1f}", f"{steal:.1f}", str(meminfo_mb()),
            f"{(disk[0] - prev_disk[0]) / 2:.0f}", f"{(disk[1] - prev_disk[1]) / 2:.0f}",
            f"{(net[0] - prev_net[0]) / 1024:.0f}", f"{(net[1] - prev_net[1]) / 1024:.0f}",
            str(inuse), str(tw)]
        for p in procs:
            ticks, rss = process_usage(p)
            row += [f"{100 * (ticks - prev_proc[p]) / TICKS:.1f}", str(rss)]
            prev_proc[p] = ticks
        out.write(",".join(row) + "\n")
        prev_cpu, prev_disk, prev_net = cpu, disk, net


if __name__ == "__main__":
    main()

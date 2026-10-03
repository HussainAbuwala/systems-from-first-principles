#!/usr/bin/env python3
"""Generate a nearly inaudible continuous room bed for seamless edit points."""

import random
import struct
import sys
import wave
from pathlib import Path


SAMPLE_RATE = 48_000


def render(destination: Path, duration_seconds: float) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    random.seed(1701)
    state = 0.0
    sample_count = round(duration_seconds * SAMPLE_RATE)
    buffer = bytearray()

    with wave.open(str(destination), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)

        for index in range(sample_count):
            state = state * 0.997 + random.uniform(-1.0, 1.0) * 0.003
            sample = max(-32767, min(32767, round(state * 0.12 * 32767)))
            buffer.extend(struct.pack('<h', sample))
            if index % SAMPLE_RATE == SAMPLE_RATE - 1:
                output.writeframes(buffer)
                buffer.clear()

        if buffer:
            output.writeframes(buffer)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('usage: generate_room_tone.py OUTPUT.wav DURATION_SECONDS')
    render(Path(sys.argv[1]), float(sys.argv[2]))

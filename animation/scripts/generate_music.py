#!/usr/bin/env python3
"""Generate a quiet, original ambient bed for the Figma multiplayer episode."""

import math
import struct
import sys
import wave
from pathlib import Path


SAMPLE_RATE = 24_000
CHORD_SECONDS = 16.0

CHORDS = [
    (65.41, 98.00, 130.81, 164.81),   # C major 7
    (55.00, 82.41, 110.00, 130.81),   # A minor 7
    (43.65, 65.41, 87.31, 110.00),    # F major 7
    (49.00, 73.42, 98.00, 123.47),    # G 6
]

VOICE_AMPLITUDES = (0.085, 0.055, 0.038, 0.026)
PHASES = (0.0, 0.8, 1.7, 2.4)


def envelope(position: float) -> float:
    # A slow breath keeps chord changes smooth and leaves room for narration.
    fade = 2.4
    attack = min(1.0, position / fade)
    release = min(1.0, (CHORD_SECONDS - position) / fade)
    return max(0.0, min(attack, release)) ** 0.7


def render(destination: Path, duration_seconds: float) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    sample_count = math.ceil(duration_seconds * SAMPLE_RATE)
    chunk_frames = SAMPLE_RATE

    with wave.open(str(destination), 'wb') as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)

        for chunk_start in range(0, sample_count, chunk_frames):
            chunk_end = min(sample_count, chunk_start + chunk_frames)
            buffer = bytearray()
            for index in range(chunk_start, chunk_end):
                time = index / SAMPLE_RATE
                chord_index = int(time // CHORD_SECONDS) % len(CHORDS)
                position = time % CHORD_SECONDS
                level = envelope(position)
                chord = CHORDS[chord_index]

                left = 0.0
                right = 0.0
                for frequency, amplitude, phase in zip(chord, VOICE_AMPLITUDES, PHASES):
                    drift = 1.0 + 0.0012 * math.sin(time / 11.0 + phase)
                    left += amplitude * math.sin(2.0 * math.pi * frequency * drift * time + phase)
                    right += amplitude * math.sin(2.0 * math.pi * frequency * 1.002 * drift * time + phase + 0.34)

                # A very soft bell every eight seconds adds motion without becoming a beat.
                bell_position = time % 8.0
                bell = 0.018 * math.exp(-bell_position * 1.5) * math.sin(2.0 * math.pi * 523.25 * time)
                left = (left * level + bell) * 0.78
                right = (right * level + bell * 0.82) * 0.78

                left_sample = max(-32767, min(32767, round(left * 32767)))
                right_sample = max(-32767, min(32767, round(right * 32767)))
                buffer.extend(struct.pack('<hh', left_sample, right_sample))

            output.writeframes(buffer)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('usage: generate_music.py OUTPUT.wav DURATION_SECONDS')
    render(Path(sys.argv[1]), float(sys.argv[2]))

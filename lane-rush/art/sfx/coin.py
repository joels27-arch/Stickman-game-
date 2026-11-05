"""The coin pickup: two soft bell notes (B5 then E6), warm sine partials, quick attack, gentle fade.

python3 coin.py out.wav   (then: ffmpeg -i out.wav -b:a 96k sfx_coin3.mp3)
"""
import math
import struct
import sys
import wave

SR = 44100


def bell(t, f, decay):
    if t < 0:
        return 0.0
    att = min(1.0, t / 0.004)
    env = att * math.exp(-t / decay)
    # a sine with a soft octave and a faint fifth above it: round, not piercing
    return env * (math.sin(2 * math.pi * f * t) + 0.22 * math.sin(2 * math.pi * 2 * f * t) * math.exp(-t / (decay * 0.5)) + 0.08 * math.sin(2 * math.pi * 3 * f * t) * math.exp(-t / (decay * 0.3)))


def main(path):
    n = int(SR * 0.42)
    out = []
    for i in range(n):
        t = i / SR
        v = 0.55 * bell(t, 987.77, 0.07) + 0.6 * bell(t - 0.065, 1318.51, 0.16)
        out.append(max(-1.0, min(1.0, v * 0.42)))
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(x * 32000)) for x in out))


if __name__ == "__main__":
    main(sys.argv[-1] if len(sys.argv) > 1 else "coin.wav")

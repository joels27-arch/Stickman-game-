"""Smooth jazzy chill-house loops for the game's background music, synthesised from scratch.

usage: python3 chillhouse.py out.wav --bpm 118 --key 0 --prog a --bars 16 --energy 1.0 --seed 1
Rhodes-style FM chords (offbeat stabs + soft pad), round sine bass, four-on-the-floor kick,
shaker and open hats, rim on 2 & 4, a little vibraphone melody, sidechain pump and a room reverb.
The loop is seamless: the reverb tail wraps round to the start.
"""
import argparse
import wave

import numpy as np

SR = 44100

PROGS = {
    # (root midi note, chord intervals) per bar, two bars each chord
    "a": [(50, [0, 3, 7, 10, 14]), (55, [0, 4, 10, 14, 21]), (48, [0, 4, 7, 11, 14]), (57, [0, 3, 7, 10, 14])],  # Dm9 G13 Cmaj9 Am9
    "b": [(53, [0, 4, 7, 11, 14]), (52, [0, 3, 7, 10, 14]), (50, [0, 3, 7, 10, 14]), (55, [0, 5, 7, 10, 14])],  # Fmaj9 Em9 Dm9 G9sus
    "c": [(57, [0, 3, 7, 10, 14]), (50, [0, 4, 7, 10, 14]), (55, [0, 4, 7, 11, 14]), (52, [0, 3, 7, 10, 17])],  # Am9 D9 Gmaj9 Em11
    "d": [(52, [0, 3, 7, 10, 14]), (57, [0, 3, 7, 10, 14]), (50, [0, 4, 7, 10, 14]), (55, [0, 4, 7, 11, 14])],  # Em9 Am9 D9 Gmaj9
}


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env_adsr(n, a, d, s, r, sus_len):
    t = np.arange(n) / SR
    e = np.zeros(n)
    a_n, d_n = int(a * SR), int(d * SR)
    s_n = max(0, int(sus_len * SR) - a_n - d_n)
    i = 0
    e[: min(n, a_n)] = np.linspace(0, 1, a_n)[: min(n, a_n)]
    i = a_n
    if i < n:
        k = min(n - i, d_n)
        e[i : i + k] = np.linspace(1, s, d_n)[:k]
    i += d_n
    if i < n:
        k = min(n - i, s_n)
        e[i : i + k] = s
    i += s_n
    if i < n:
        k = n - i
        e[i:] = s * np.exp(-np.arange(k) / (r * SR))
    return e


def rhodes(f, dur, vel=1.0):
    """FM electric piano: 1:1 carrier/modulator with a fast-decaying index (the tine bark), plus a soft 14x bell."""
    n = int((dur + 1.2) * SR)
    t = np.arange(n) / SR
    idx = 1.6 * vel * np.exp(-t * 7) + 0.35
    mod = np.sin(2 * np.pi * f * t)
    body = np.sin(2 * np.pi * f * t + idx * mod)
    bell = 0.12 * vel * np.sin(2 * np.pi * f * 14 * t) * np.exp(-t * 18)
    amp = env_adsr(n, 0.004, 0.6, 0.55, 0.35, dur) * np.exp(-t * 0.6)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.8 * t)
    return (body + bell) * amp * trem * vel


def pad(f, dur):
    n = int((dur + 1.5) * SR)
    t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * (1 + d) * t + p) for d, p in [(-0.004, 0), (0.0, 1.3), (0.004, 2.1)])
    s += 0.25 * sum(np.sin(2 * np.pi * 2 * f * (1 + d) * t) for d in (-0.003, 0.003))
    return s / 3 * env_adsr(n, 0.8, 0.5, 0.8, 1.0, dur)


def bass(f, dur):
    n = int((dur + 0.15) * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * 2 * f * t) + 0.18 * np.sin(2 * np.pi * 3 * f * t)  # upper harmonics: audible on phone speakers
    s = np.tanh(1.4 * s) / np.tanh(1.4)
    return s * env_adsr(n, 0.006, 0.12, 0.75, 0.06, dur)


def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 46 + 95 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7.5) + 0.25 * np.exp(-t * 300) * np.random.default_rng(3).standard_normal(n) * 0.3


def noise_hit(dur, decay, hp, rng):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    # crude high-pass: subtract a moving average
    k = max(1, int(SR / hp))
    lp = np.convolve(x, np.ones(k) / k, mode="same")
    x = x - lp
    return x * np.exp(-np.arange(n) / SR * decay)


def rim():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1700 * t) * 0.6 + np.sin(2 * np.pi * 820 * t)) * np.exp(-t * 60)


def vibe(f, dur):
    n = int((dur + 1.0) * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 9)
    return s * np.exp(-t * 2.2) * (1 + 0.2 * np.sin(2 * np.pi * 5.5 * t)) * env_adsr(n, 0.003, 0.05, 1, 1, dur)


def place(buf, sig, at, gain=1.0, pan=0.0):
    i = int(at * SR) % len(buf)
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    end = i + len(sig)
    if end <= len(buf):
        buf[i:end, 0] += sig * gain * l * 1.414
        buf[i:end, 1] += sig * gain * r * 1.414
    else:  # wrap round: the loop is seamless
        k = len(buf) - i
        buf[i:, 0] += sig[:k] * gain * l * 1.414
        buf[i:, 1] += sig[:k] * gain * r * 1.414
        rest = sig[k:]
        buf[: len(rest), 0] += rest * gain * l * 1.414
        buf[: len(rest), 1] += rest * gain * r * 1.414


def reverb(x, rng, seconds=2.2, mix=0.22):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 3.2)
        ir[: int(0.012 * SR)] = 0
        ir /= np.sqrt(np.sum(ir**2))
        L = len(x)
        size = 1 << int(np.ceil(np.log2(L + n)))
        y = np.fft.irfft(np.fft.rfft(x[:, ch], size) * np.fft.rfft(ir, size), size)
        wet = y[:L].copy()
        wet[: n - 1] += y[L : L + n - 1][: L]  # the tail wraps to the loop start
        out[:, ch] = wet
    return x + mix * out


def lowpass(x, cutoff):
    """Soft low-pass in the frequency domain (circular, so the loop stays seamless)."""
    f = np.fft.rfftfreq(len(x), 1 / SR)
    gain = 1 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.stack([np.fft.irfft(np.fft.rfft(x[:, ch]) * gain, len(x)) for ch in range(2)], axis=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--bpm", type=float, default=118)
    ap.add_argument("--key", type=int, default=0)
    ap.add_argument("--prog", default="a")
    ap.add_argument("--bars", type=int, default=16)
    ap.add_argument("--energy", type=float, default=1.0)
    ap.add_argument("--seed", type=int, default=1)
    o = ap.parse_args()
    rng = np.random.default_rng(o.seed)
    beat = 60 / o.bpm
    bar = 4 * beat
    total = o.bars * bar
    N = int(round(total * SR))
    drums = np.zeros((N, 2))
    keys = np.zeros((N, 2))
    low = np.zeros((N, 2))
    prog = PROGS[o.prog]
    K = kick()
    swing = 0.035 * beat  # a little shuffle on the 16ths

    for b in range(o.bars):
        root, ivs = prog[(b // 2) % len(prog)]
        root += o.key
        t0 = b * bar
        # pad underneath (whole bar)
        for iv in ivs[:4]:
            place(keys, pad(hz(root + iv), bar * 0.95), t0, 0.10 * o.energy, pan=rng.uniform(-0.4, 0.4))
        # Rhodes comping: deep-house offbeat stabs, a different rhythm each bar
        pattern = [0.5, 1.5, 2.5, 3.25, 3.75] if b % 2 == 0 else [0.0, 0.75, 1.5, 2.5, 3.5]
        for k, pos in enumerate(pattern):
            if rng.random() < 0.15:
                continue
            vel = rng.uniform(0.55, 0.85)
            voicing = [root + iv for iv in ivs[1:]] + ([root + 12] if k % 2 else [])
            for m in voicing:
                place(keys, rhodes(hz(m), beat * 0.42, vel), t0 + pos * beat + rng.uniform(0, 0.008), 0.19, pan=rng.uniform(-0.5, 0.5))
        # bass: root on 1, syncopated pickups
        bl = root - 24 if root - 24 >= 26 else root - 12
        for pos, iv, d in [(0, 0, 0.7), (1.5, 0, 0.35), (2.0, 7, 0.45), (2.75, 12, 0.2), (3.5, 10 if b % 2 else 7, 0.4)]:
            place(low, bass(hz(bl + iv), beat * d), t0 + pos * beat, 0.17)
        # drums
        for q in range(4):
            place(drums, K, t0 + q * beat, 0.30 * min(1.0, o.energy + 0.1))
            if q in (1, 3):
                place(drums, rim(), t0 + q * beat + 0.004, 0.09, pan=0.15)
            place(drums, noise_hit(0.22, 22, 7000, rng), t0 + (q + 0.5) * beat, 0.07 * o.energy, pan=-0.2)  # open hat
            for s in range(4):  # shaker 16ths
                acc = 1.0 if s == 2 else 0.55
                sw = swing if s % 2 else 0
                place(drums, noise_hit(0.05, 70, 9000, rng), t0 + (q + s / 4) * beat + sw, 0.035 * acc * o.energy, pan=0.35)
        # vibraphone melody every other bar: a soft pentatonic phrase over the chord
        if b % 4 in (1, 3):
            scale = [0, 2, 3, 7, 9, 10, 14]
            note = root + 12 + rng.choice(scale)
            for pos in sorted(rng.choice(np.arange(0, 4, 0.5), size=rng.integers(2, 5), replace=False)):
                note = root + 12 + scale[int(np.clip(np.searchsorted(scale, note - root - 12) + rng.integers(-1, 2), 0, len(scale) - 1))]
                place(keys, vibe(hz(note), beat * 0.6), t0 + pos * beat, 0.2, pan=rng.uniform(-0.3, 0.3))

    # sidechain pump: keys and pad duck under every kick
    t = (np.arange(N) / SR) % beat
    pump = 1 - 0.45 * np.exp(-t / (beat * 0.22))
    keys *= pump[:, None]
    keys = lowpass(keys, 5200)
    mix = drums + keys + low * (1 - 0.25 * np.exp(-t / (beat * 0.12)))[:, None]
    mix = reverb(mix, rng)
    # gentle glue: soft saturation, then normalise
    mix = np.tanh(mix * 1.15)
    mix /= np.max(np.abs(mix)) + 1e-9
    mix *= 0.89
    pcm = (mix * 32767).astype(np.int16)
    with wave.open(o.out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(o.out, f"{total:.1f}s")


if __name__ == "__main__":
    main()

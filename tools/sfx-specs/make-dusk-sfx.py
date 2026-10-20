#!/usr/bin/env python3
"""DUSK · 黄昏之炼 — 16 theme cues, synthesised from clay, wood, paper,
glass and low strings. No third-party samples, no broadband noise on
click/hover cues (only the switch transition gets a low-passed air bed).

    python tools/sfx-specs/make-dusk-sfx.py <outDir>

Output: <outDir>/<cue>.wav (mono, 44.1 kHz, 16-bit). Encode with:

    ffmpeg -i <cue>.wav -c:a libvorbis -q:a 5 -ac 1 <cue>.ogg
"""

import math
import os
import random
import struct
import sys
import wave

SR = 44100
random.seed(20261020)


# ---------------------------------------------------------------- utilities

def env(n, attack=0.004, decay=0.25, curve=3.2, sustain=0.0, release=0.05):
    """Simple attack / exponential decay envelope."""
    out = [0.0] * n
    a = max(1, int(attack * SR))
    d_end = min(n, a + int(decay * SR))
    r = max(1, int(release * SR))
    for i in range(n):
        if i < a:
            v = i / a
        elif i < d_end:
            t = (i - a) / max(1, d_end - a)
            v = (1.0 - t) ** curve
        else:
            t = (i - d_end) / r
            v = max(0.0, 1.0 - t) * (sustain if sustain else 0.0)
        out[i] = v
    return out


def lowpass(sig, cutoff):
    """One-pole low-pass; enough to keep the cues dark and warm."""
    if cutoff >= SR / 2:
        return sig
    alpha = 1.0 - math.exp(-2.0 * math.pi * cutoff / SR)
    out = []
    y = 0.0
    for x in sig:
        y += alpha * (x - y)
        out.append(y)
    return out


def highpass(sig, cutoff):
    alpha = 1.0 - math.exp(-2.0 * math.pi * cutoff / SR)
    out = []
    y_prev = 0.0
    x_prev = 0.0
    for x in sig:
        y = alpha * (y_prev + x - x_prev)
        out.append(y)
        y_prev, x_prev = y, x
    return out


def noise(n):
    return [random.uniform(-1.0, 1.0) for _ in range(n)]


def tone(n, freq, amp=1.0, bend=0.0, partials=(1.0,)):
    """Additive tone with an optional exponential pitch bend."""
    out = [0.0] * n
    phase = 0.0
    for i in range(n):
        t = i / SR
        f = freq * (1.0 + bend * (1.0 - math.exp(-t * 12.0)))
        phase += 2.0 * math.pi * f / SR
        v = 0.0
        for k, ratio in enumerate(partials, start=1):
            v += math.sin(phase * ratio) / (k * 1.6)
        out[i] = v * amp
    return out


def mix(*layers):
    n = max(len(layer) for layer in layers)
    out = [0.0] * n
    for layer in layers:
        for i, v in enumerate(layer):
            out[i] += v
    return out


def gain(sig, amount):
    return [v * amount for v in sig]


def offset(sig, seconds):
    pad = int(seconds * SR)
    return [0.0] * pad + sig


def apply_env(sig, envelope):
    n = min(len(sig), len(envelope))
    return [sig[i] * envelope[i] for i in range(n)]


def reverb(sig, delay=0.055, feedback=0.28, mixes=3):
    """Cheap room: a few decaying taps. Keeps the tails short."""
    n = len(sig)
    out = list(sig)
    d = int(delay * SR)
    for m in range(1, mixes + 1):
        g = feedback ** m
        for i in range(n - d * m):
            out[i + d * m] += sig[i] * g
    return out


def fade_tail(sig, seconds=0.06):
    n = len(sig)
    f = min(n, int(seconds * SR))
    for i in range(f):
        sig[n - f + i] *= 1.0 - i / f
    return sig


def normalize(sig, peak=0.82):
    top = max(1e-9, max(abs(v) for v in sig))
    return [v / top * peak for v in sig]


# ---------------------------------------------------------------- materials

def clay(n, freq=320.0, amp=1.0):
    """陶铃：inharmonic clay bell, short and dry."""
    body = tone(n, freq, amp, bend=-0.03, partials=(1.0, 2.76, 5.18))
    body = lowpass(body, 4200)
    return apply_env(body, env(n, 0.003, 0.34, 3.6))


def clay_low(n, freq=168.0, amp=1.0):
    body = tone(n, freq, amp, bend=-0.05, partials=(1.0, 2.02, 3.41))
    body = lowpass(body, 2400)
    return apply_env(body, env(n, 0.006, 0.42, 3.2))


def wood(n, freq=1180.0, amp=1.0):
    """木：a dry woodblock — resonant ping plus a tiny noise transient."""
    ping = tone(n, freq, amp, bend=-0.12, partials=(1.0, 2.4))
    ping = apply_env(ping, env(n, 0.0015, 0.055, 5.0))
    hit = apply_env(lowpass(noise(n), 3400), env(n, 0.0008, 0.02, 6.0))
    return mix(ping, gain(hit, 0.35))


def paper(n, amp=1.0):
    """纸：a short dry brush, band-limited so it never hisses."""
    grains = apply_env(lowpass(highpass(noise(n), 380), 2900), env(n, 0.004, 0.07, 3.0))
    return gain(grains, amp * 0.55)


def glass(n, freq=2120.0, amp=1.0):
    """玻璃瓶：a clean vial ping with a fast shimmer."""
    ping = tone(n, freq, amp, bend=0.012, partials=(1.0, 2.01))
    ping = apply_env(ping, env(n, 0.002, 0.22, 4.4))
    shimmer = apply_env(lowpass(tone(n, freq * 1.5, amp * 0.5), 5200), env(n, 0.002, 0.12, 5.0))
    return mix(ping, shimmer)


def strings(n, freq=72.0, amp=1.0, attack=0.13, decay=0.5):
    """低音弦：soft bowed low note, slow attack, no bite."""
    body = tone(n, freq, amp, partials=(1.0, 1.5, 2.0, 3.0))
    body = lowpass(body, 1400)
    return apply_env(body, env(n, attack, decay, 2.2))


def air(n, amp=1.0, cutoff=2600.0):
    bed = lowpass(noise(n), cutoff)
    return gain(bed, amp * 0.5)


def sec(n):
    return int(n * SR)


# ---------------------------------------------------------------- the cues

def build(cue):
    if cue == "bong":
        n = sec(0.75)
        sig = mix(gain(clay_low(n, 196, 1.0), 0.9), gain(clay(n, 392, 0.5), 0.5))
        return reverb(sig, 0.045, 0.22), 0.86

    if cue == "click":
        n = sec(0.12)
        return mix(wood(n, 1320, 0.9), gain(paper(n, 0.4), 0.5)), 0.7

    if cue == "nav":
        n = sec(0.16)
        return mix(wood(n, 980, 0.65), gain(glass(n, 2360, 0.22), 0.35)), 0.62

    if cue == "soft":
        n = sec(0.2)
        return mix(paper(n, 0.9), gain(wood(n, 720, 0.25), 0.4)), 0.5

    if cue == "select":
        n = sec(0.34)
        sig = mix(glass(n, 1980, 0.7), gain(clay(n, 440, 0.4), 0.45))
        return reverb(sig, 0.05, 0.2), 0.72

    if cue == "confirm":
        n = sec(0.7)
        a = apply_env(tone(n, 523.25, 0.7, partials=(1.0, 2.0)), env(n, 0.004, 0.3, 3.4))
        b = offset(apply_env(tone(sec(0.5), 783.99, 0.7, partials=(1.0, 2.0)), env(sec(0.5), 0.004, 0.32, 3.2)), 0.1)
        return reverb(mix(a, b), 0.05, 0.24), 0.8

    if cue == "error":
        n = sec(0.55)
        thud = apply_env(tone(n, 118, 1.0, bend=-0.18, partials=(1.0, 1.98)), env(n, 0.004, 0.3, 3.0))
        dull = apply_env(lowpass(noise(n), 900), env(n, 0.003, 0.16, 4.0))
        return mix(thud, gain(dull, 0.3)), 0.78

    if cue == "tick":
        n = sec(0.07)
        return wood(n, 1680, 0.7), 0.55

    if cue == "chime":
        n = sec(1.5)
        steps = [(0.0, 783.99), (0.085, 1046.5), (0.17, 1318.5)]
        parts = []
        for at, f in steps:
            seg = apply_env(glass(sec(1.2), f, 0.55), env(sec(1.2), 0.003, 0.5, 3.0))
            parts.append(offset(seg, at))
        sig = reverb(mix(*parts), 0.07, 0.3, 4)
        return sig, 0.72

    if cue == "deep":
        n = sec(1.1)
        body = strings(n, 65.4, 1.0, attack=0.16, decay=0.7)
        return lowpass(reverb(body, 0.08, 0.2), 900), 0.8

    if cue == "launchRise":
        n = sec(0.9)
        swell = strings(n, 87.3, 0.8, attack=0.28, decay=0.5)
        lift = apply_env(tone(n, 261.6, 0.35, bend=0.55, partials=(1.0, 2.0)), env(n, 0.25, 0.5, 2.0))
        return mix(swell, lift), 0.82

    if cue == "launchFall":
        n = sec(0.8)
        fall = apply_env(tone(n, 392.0, 0.5, bend=-0.42, partials=(1.0, 2.0, 3.0)), env(n, 0.01, 0.55, 2.6))
        low = strings(n, 98.0, 0.5, attack=0.02, decay=0.6)
        return mix(fall, low), 0.78

    if cue == "switch":
        n = sec(0.55)
        # 唯一允许的空气声：低通到 2.6k 的风声，只服务于主题切换
        bed = apply_env(air(n, 0.75, 2600.0), env(n, 0.08, 0.32, 2.0))
        seam = apply_env(tone(n, 174.6, 0.5, bend=0.2, partials=(1.0, 2.0)), env(n, 0.12, 0.3, 2.2))
        return mix(bed, seam), 0.74

    if cue == "launch":
        n = sec(1.0)
        bell = clay_low(n, 220, 0.9)
        swell = strings(n, 110, 0.55, attack=0.05, decay=0.8)
        return reverb(mix(bell, swell), 0.06, 0.26), 0.86

    if cue == "exit":
        n = sec(0.62)
        thud = apply_env(tone(n, 98, 0.85, bend=-0.1, partials=(1.0, 1.5)), env(n, 0.006, 0.4, 2.8))
        paper_out = apply_env(paper(n, 0.5), env(n, 0.01, 0.3, 2.4))
        return mix(thud, paper_out), 0.72

    if cue == "boot":
        # 与开屏关键帧对齐：风声 → 陶铃 → 玻璃瓶 → 低弦 → 收尾钟声
        total = sec(2.6)
        parts = [
            offset(apply_env(air(sec(1.2), 0.5, 2400), env(sec(1.2), 0.35, 0.8, 1.6)), 0.0),
            offset(clay_low(sec(0.8), 196, 0.85), 0.34),
            offset(gain(glass(sec(0.6), 1760, 0.5), 0.8), 0.62),
            offset(strings(sec(1.4), 87.3, 0.7, attack=0.22, decay=1.0), 0.86),
            offset(gain(clay(sec(1.0), 523.25, 0.6), 0.9), 1.46),
            offset(gain(glass(sec(1.1), 1046.5, 0.4), 0.7), 1.62),
        ]
        return reverb(mix(*parts), 0.08, 0.26, 3), 0.8

    raise SystemExit("unknown cue: " + cue)


CUES = [
    "bong", "click", "nav", "soft", "select", "confirm", "error", "tick",
    "chime", "deep", "launchRise", "launchFall", "switch", "launch", "exit",
    "boot",
]


def write_wav(path, sig):
    peak = max(1e-9, max(abs(v) for v in sig))
    frames = bytearray()
    for v in sig:
        s = int(max(-1.0, min(1.0, v / peak * 0.86)) * 32767)
        frames += struct.pack("<h", s)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(bytes(frames))


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "themes/dusk/sounds"
    os.makedirs(out, exist_ok=True)
    for cue in CUES:
        sig, peak = build(cue)
        sig = fade_tail(sig, 0.05)
        sig = normalize(sig, peak)
        path = os.path.join(out, cue + ".wav")
        write_wav(path, sig)
        print(f"{cue:11s} {len(sig)/SR:5.2f}s  {path}")


if __name__ == "__main__":
    main()

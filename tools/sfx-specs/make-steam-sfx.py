#!/usr/bin/env python3
"""STEAM CLASSIC · 16 theme cues.

Materials: plastic keys, mouse-wheel notches, a soft drive hum, short
digital blips and one low-passed air sweep for the theme switch. No
third-party samples; no broadband noise on click / hover cues.

    python tools/sfx-specs/make-steam-sfx.py <outDir>

Then: ffmpeg -i <cue>.wav -c:a libvorbis -q:a 5 -ac 1 <cue>.ogg
"""

import math
import os
import random
import struct
import sys
import wave

SR = 44100
random.seed(20261021)


def env(n, attack=0.002, decay=0.12, curve=3.0, release=0.03):
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
            v = max(0.0, 1.0 - t) * 0.0
        out[i] = v
    return out


def lowpass(sig, cutoff):
    if cutoff >= SR / 2:
        return sig
    alpha = 1.0 - math.exp(-2.0 * math.pi * cutoff / SR)
    out, y = [], 0.0
    for x in sig:
        y += alpha * (x - y)
        out.append(y)
    return out


def highpass(sig, cutoff):
    alpha = 1.0 - math.exp(-2.0 * math.pi * cutoff / SR)
    out, y_prev, x_prev = [], 0.0, 0.0
    for x in sig:
        y = alpha * (y_prev + x - x_prev)
        out.append(y)
        y_prev, x_prev = y, x
    return out


def noise(n):
    return [random.uniform(-1.0, 1.0) for _ in range(n)]


def tone(n, freq, amp=1.0, partials=(1.0,), bend=0.0):
    out, phase = [0.0] * n, 0.0
    for i in range(n):
        t = i / SR
        f = freq * (1.0 + bend * (1.0 - math.exp(-t * 14.0)))
        phase += 2.0 * math.pi * f / SR
        v = 0.0
        for k, ratio in enumerate(partials, start=1):
            v += math.sin(phase * ratio) / (k * 1.5)
        out[i] = v * amp
    return out


def apply_env(sig, envelope):
    n = min(len(sig), len(envelope))
    return [sig[i] * envelope[i] for i in range(n)]


def mix(*layers):
    n = max(len(x) for x in layers)
    out = [0.0] * n
    for layer in layers:
        for i, v in enumerate(layer):
            out[i] += v
    return out


def gain(sig, amount):
    return [v * amount for v in sig]


def offset(sig, seconds):
    return [0.0] * int(seconds * SR) + sig


def normalize(sig, peak=0.8):
    top = max(1e-9, max(abs(v) for v in sig))
    return [v / top * peak for v in sig]


def fade_tail(sig, seconds=0.04):
    n = len(sig)
    f = min(n, int(seconds * SR))
    for i in range(f):
        sig[n - f + i] *= 1.0 - i / f
    return sig


def sec(t):
    return int(t * SR)


def reverb(sig, delay=0.03, feedback=0.2, taps=2):
    out = list(sig)
    d = int(delay * SR)
    for m in range(1, taps + 1):
        g = feedback ** m
        for i in range(len(sig) - d * m):
            out[i + d * m] += sig[i] * g
    return out


# ---------------------------------------------------------------- materials

def key(n, amp=1.0, f=1700.0):
    """塑料键：一个极短的噪声瞬态 + 一个阻尼共振。"""
    click = apply_env(lowpass(highpass(noise(n), 700), 4200), env(n, 0.0006, 0.012, 6.0))
    body = apply_env(tone(n, f, amp, partials=(1.0, 2.0)), env(n, 0.001, 0.035, 5.0))
    return mix(gain(click, .5), gain(body, .6))


def notch(n, amp=1.0):
    """滚轮格：两下更闷的键声，间距 28ms。"""
    a = key(sec(0.05), amp, 1180)
    b = offset(key(sec(0.05), amp * .8, 1320), 0.028)
    return mix(a, b)


def blip(n, f=880.0, amp=1.0):
    """数字提示音：奇次谐波，短促，低通到 4k。"""
    t = tone(n, f, amp, partials=(1.0, 3.0, 5.0))
    return lowpass(apply_env(t, env(n, 0.003, 0.14, 3.4)), 4200)


def hum(n, f=68.0, amp=1.0, attack=0.12):
    body = tone(n, f, amp, partials=(1.0, 2.0, 3.0, 4.0))
    return lowpass(apply_env(body, env(n, attack, 0.5, 2.2)), 900)


def air(n, amp=1.0, cutoff=2400.0):
    return gain(lowpass(noise(n), cutoff), amp * .45)


def clunk(n, amp=1.0):
    thud = apply_env(tone(n, 96, amp, partials=(1.0, 1.6), bend=-0.12), env(n, 0.004, 0.18, 3.0))
    tick = apply_env(lowpass(noise(n), 2200), env(n, 0.001, 0.02, 6.0))
    return mix(thud, gain(tick, .35))


# ---------------------------------------------------------------- cues

def build(cue):
    if cue == "bong":
        n = sec(.6)
        return reverb(mix(gain(hum(n, 110, .8, .01), .8), gain(blip(n, 440, .45), .5)), .04, .2), .82
    if cue == "click":
        return key(sec(.09)), .62
    if cue == "nav":
        return notch(sec(.1)), .55
    if cue == "soft":
        n = sec(.1)
        return mix(gain(key(n, .5, 980), .7), gain(air(n, .25, 1800), .4)), .42
    if cue == "select":
        n = sec(.2)
        return mix(blip(n, 1046, .6), gain(key(n, .25, 1500), .4)), .62
    if cue == "confirm":
        n = sec(.5)
        a = apply_env(blip(n, 784, .6), env(n, .003, .2, 3.0))
        b = offset(apply_env(blip(sec(.4), 1046, .6), env(sec(.4), .003, .24, 3.0)), .09)
        return reverb(mix(a, b), .035, .18), .74
    if cue == "error":
        n = sec(.45)
        low = apply_env(tone(n, 146, .8, partials=(1.0, 2.0)), env(n, .004, .18, 3.0))
        buzz = apply_env(lowpass(highpass(noise(n), 300), 1600), env(n, .002, .12, 4.0))
        return mix(low, gain(buzz, .3)), .72
    if cue == "tick":
        return key(sec(.05), .7, 2100), .48
    if cue == "chime":
        n = sec(1.2)
        parts = []
        for at, f in ((0.0, 880), (0.08, 1174), (0.16, 1568)):
            seg = apply_env(blip(sec(1.0), f, .45), env(sec(1.0), .003, .34, 3.0))
            parts.append(offset(seg, at))
        return reverb(mix(*parts), .05, .24, 3), .68
    if cue == "deep":
        n = sec(1.0)
        return reverb(hum(n, 62, 1.0, .16), .06, .18), .8
    if cue == "launchRise":
        n = sec(.8)
        swell = hum(n, 82, .8, .22)
        lift = apply_env(blip(n, 523, .35), env(n, .2, .4, 2.0))
        return mix(swell, lift), .82
    if cue == "launchFall":
        n = sec(.7)
        fall = apply_env(tone(n, 392, .5, partials=(1.0, 2.0, 3.0), bend=-.4), env(n, .008, .45, 2.6))
        return mix(fall, gain(hum(n, 98, .5, .01), .6)), .76
    if cue == "switch":
        n = sec(.45)
        bed = apply_env(air(n, .9, 2400), env(n, .06, .26, 2.0))
        seam = apply_env(tone(n, 196, .4, partials=(1.0, 2.0)), env(n, .02, .2, 2.6))
        return mix(bed, seam), .7
    if cue == "launch":
        n = sec(.85)
        return reverb(mix(clunk(n), gain(hum(n, 104, .6, .03), .7)), .04, .2), .86
    if cue == "exit":
        n = sec(.5)
        return mix(clunk(n, .8), gain(air(n, .3, 1600), .4)), .7
    if cue == "boot":
        total = sec(2.3)
        parts = [
            offset(apply_env(air(sec(1.0), .5, 2200), env(sec(1.0), .3, .7, 1.6)), 0.0),
            offset(hum(sec(1.4), 62, .55, .3), 0.1),
            offset(blip(sec(.4), 523, .5), .45),
            offset(blip(sec(.4), 659, .5), .62),
            offset(blip(sec(.4), 784, .5), .79),
            offset(gain(reverb(blip(sec(.9), 1046, .5), .04, .2), .9), 1.02),
        ]
        return reverb(mix(*parts), .05, .22, 2), .8
    raise SystemExit("unknown cue: " + cue)


CUES = ["bong", "click", "nav", "soft", "select", "confirm", "error", "tick",
        "chime", "deep", "launchRise", "launchFall", "switch", "launch", "exit", "boot"]


def write_wav(path, sig):
    peak = max(1e-9, max(abs(v) for v in sig))
    frames = bytearray()
    for v in sig:
        frames += struct.pack("<h", int(max(-1.0, min(1.0, v / peak * 0.86)) * 32767))
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(bytes(frames))


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "themes/steam/sounds"
    os.makedirs(out, exist_ok=True)
    for cue in CUES:
        sig, peak = build(cue)
        sig = normalize(fade_tail(sig, 0.04), peak)
        path = os.path.join(out, cue + ".wav")
        write_wav(path, sig)
        print(f"{cue:11s} {len(sig)/SR:5.2f}s  {path}")


if __name__ == "__main__":
    main()

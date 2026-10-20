#!/usr/bin/env python3
"""Generate the 16 cues for DUSK / STEAM / NIGHT FLIGHT with genny.

    python tools/sfx-specs/make-themes-2.2.py

Writes themes-2.2-genny.json, renders WAVs into _tools/sfx-out, checks
sharpness, converts to OGG and copies into themes/<id>/sounds/.

The palettes:
  dusk        clay / wood / paper / glass / low strings (Atelier dusk)
  steam       solenoid / console clicks / low synth / bell (Big Picture)
  nightflight split-flap clacks / airport chimes / wind / PA voice
"""

import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.abspath(os.path.join(ROOT, "..", "_tools", "sfx-out"))
BATCH = os.path.join(os.path.dirname(__file__), "themes-2.2-genny.json")

# helpers ---------------------------------------------------------------

def S(kind, params=None, gain=1.0, at=None, fx=None):
    layer = {"type": "sfx", "kind": kind, "gain": gain}
    if params:
        layer["params"] = params
    if at is not None:
        layer["at"] = at
    if fx:
        layer["fx"] = fx
    return layer


def N(inst, notes, dur, vel=0.6, gain=1.0, at=None, fx=None, params=None):
    layer = {"type": "synth", "inst": inst, "notes": notes, "dur": dur, "vel": vel, "gain": gain}
    if at is not None:
        layer["at"] = at
    if fx:
        layer["fx"] = fx
    if params:
        layer["params"] = params
    return layer


def Q(inst, steps, gain=1.0, at=None, fx=None, vel=0.7, params=None):
    layer = {"type": "seq", "inst": inst, "steps": steps, "gain": gain, "vel": vel}
    if at is not None:
        layer["at"] = at
    if fx:
        layer["fx"] = fx
    if params:
        layer["params"] = params
    return layer


def D(kind, vel=0.7, gain=1.0, at=None, params=None):
    layer = {"type": "drum", "kind": kind, "vel": vel, "gain": gain}
    if at is not None:
        layer["at"] = at
    if params:
        layer["params"] = params
    return layer


def V(text, gain=0.4, at=None, voice="female", rate=0.92, pitch=190, fx=None):
    layer = {"type": "speech", "text": text, "gain": gain,
             "params": {"voice": voice, "rate": rate, "pitch": pitch}}
    if at is not None:
        layer["at"] = at
    if fx:
        layer["fx"] = fx
    return layer


def spec(name, theme, duration, layers, fx=None, extra=None):
    s = {
        "out": f"{theme}/{name}.wav",
        "duration": duration,
        "layers": layers,
        "fx": (fx or []) + [{"type": "mono"}],
        "normalize": -1.0,
    }
    if extra:
        s.update(extra)
    return s


def reverb(mix=0.18, size=0.4):
    return {"type": "reverb", "mix": mix, "size": size}


def lp(cutoff):
    return {"type": "lowpass", "cutoff": cutoff}


def hp(cutoff):
    return {"type": "highpass", "cutoff": cutoff}


# DUSK -----------------------------------------------------------------

def dusk():
    t = "dusk"
    out = []
    out.append(spec("click", t, 0.12, [
        S("click", {"tone": 1500}, 0.9),
        S("pop", {"freq": 380}, 0.35),
    ], [lp(3200)]))
    out.append(spec("nav", t, 0.18, [
        D("woodblock", 0.55, 0.7),
        S("blip", {"freq": 760, "dur": 0.05}, 0.35),
    ], [lp(3400)]))
    out.append(spec("soft", t, 0.15, [
        S("pop", {"freq": 320}, 0.75),
        S("noise", {"dur": 0.06, "color": "white"}, 0.12, fx=[hp(500), lp(1900)]),
    ], [lp(2600)]))
    out.append(spec("tick", t, 0.07, [
        S("blip", {"freq": 1850, "dur": 0.035}, 0.45),
    ], [lp(3800)]))
    out.append(spec("bong", t, 0.8, [
        N("handpan", "G3", 0.7, 0.55, 0.55),
        N("marimba", "C4", 0.35, 0.5, 0.45),
    ], [reverb(0.18, 0.35)]))
    out.append(spec("select", t, 0.45, [
        Q("marimba", "A4:0.12 C5:0.28", 0.7),
        N("glass", "E5", 0.3, 0.45, 0.24, at=0.06),
    ], [reverb(0.16, 0.35)]))
    out.append(spec("confirm", t, 0.75, [
        Q("marimba", "A4:0.1 C5:0.12 E5:0.4", 0.7),
        N("glass", "A5", 0.55, 0.42, 0.22, at=0.16),
    ], [reverb(0.22, 0.45)]))
    out.append(spec("error", t, 0.6, [
        Q("felt_piano", "C4:0.12 Bb3:0.3", 0.65, vel=0.55),
        N("sub", "C2", 0.45, 0.5, 0.28, at=0.02),
    ], [lp(2200), reverb(0.08, 0.25)]))
    out.append(spec("chime", t, 1.0, [
        N("singing_bowl", "C4", 1.0, 0.4, 0.28),
        N("glass", "C6", 0.7, 0.36, 0.22, at=0.04),
        N("marimba", "G5", 0.4, 0.4, 0.2, at=0.12),
    ], [reverb(0.25, 0.55)]))
    out.append(spec("deep", t, 1.2, [
        N("cello", "C2", 1.05, 0.55, 0.35),
        S("sweep_down", {"start": 180, "end": 88, "dur": 0.8, "wave": "sine"}, 0.24),
        S("noise", {"dur": 0.7, "color": "brown"}, 0.08, at=0.1, fx=[lp(600)]),
    ], [lp(1500), reverb(0.2, 0.5)]))
    out.append(spec("launchRise", t, 1.0, [
        N("warm_pad", "C3", 0.95, 0.4, 0.3),
        Q("harp", "C4:0.1 G4:0.1 C5:0.35", 0.5, at=0.08),
        S("sweep_up", {"start": 120, "end": 620, "dur": 0.7, "wave": "sine"}, 0.16),
    ], [reverb(0.2, 0.45)]))
    out.append(spec("launchFall", t, 1.0, [
        N("warm_pad", "C3", 0.9, 0.36, 0.26),
        Q("harp", "C5:0.1 G4:0.1 C4:0.3", 0.45, at=0.04),
        S("sweep_down", {"start": 480, "end": 120, "dur": 0.7, "wave": "sine"}, 0.18),
    ], [reverb(0.18, 0.4)]))
    out.append(spec("switch", t, 0.75, [
        S("noise", {"dur": 0.16, "color": "white"}, 0.2, fx=[hp(600), lp(3000)]),
        S("whoosh", {"dur": 0.55, "low": 260, "high": 2600, "direction": "up"}, 0.2, at=0.08),
        N("marimba", "C5", 0.35, 0.4, 0.26, at=0.35),
        N("glass", "G5", 0.5, 0.3, 0.16, at=0.42),
    ], [reverb(0.18, 0.4)]))
    out.append(spec("launch", t, 1.3, [
        N("cello", "C2", 1.2, 0.5, 0.3),
        N("handpan", "C3", 1.0, 0.5, 0.32, at=0.1),
        Q("harp", "C4:0.12 E4:0.12 G4:0.4", 0.42, at=0.25),
        N("glass", "C6", 0.7, 0.28, 0.14, at=0.5),
    ], [reverb(0.25, 0.55)]))
    out.append(spec("exit", t, 0.8, [
        Q("felt_piano", "G3:0.15 C3:0.35", 0.55, vel=0.5),
        S("sweep_down", {"start": 300, "end": 90, "dur": 0.6, "wave": "sine"}, 0.14),
    ], [lp(2400), reverb(0.1, 0.3)]))
    out.append(spec("boot", t, 2.7, [
        N("cello", "C2", 2.4, 0.42, 0.24),
        S("wind", {"dur": 2.2}, 0.1, at=0.05, fx=[lp(900)]),
        S("noise", {"dur": 0.1, "color": "white"}, 0.12, at=0.38, fx=[hp(400), lp(2400)]),
        Q("marimba", "C4:0.18 E4:0.18 G4:0.5", 0.42, at=0.7),
        N("glass", "C6", 0.8, 0.3, 0.18, at=1.4),
        N("handpan", "C3", 1.0, 0.42, 0.26, at=1.75),
        N("singing_bowl", "C3", 0.9, 0.28, 0.12, at=2.05),
    ], [lp(4800), reverb(0.24, 0.55)]))
    return out


# STEAM ----------------------------------------------------------------

def steam():
    t = "steam"
    out = []
    out.append(spec("click", t, 0.12, [
        S("solenoid", {"size": 0.14, "metal": 0.45, "thump": 0.35, "bounce": 0.25, "seed": 11}, 0.8),
        S("click", {"tone": 2400}, 0.45),
    ], [lp(4200)]))
    out.append(spec("nav", t, 0.18, [
        S("solenoid", {"size": 0.22, "metal": 0.35, "thump": 0.4, "bounce": 0.3, "seed": 12}, 0.7),
        S("swoosh", {"dur": 0.12}, 0.18, at=0.02),
        S("blip", {"freq": 880, "dur": 0.04}, 0.3, at=0.05),
    ], [lp(3800)]))
    out.append(spec("soft", t, 0.15, [
        S("pop", {"freq": 340}, 0.7),
        S("solenoid", {"size": 0.08, "metal": 0.2, "thump": 0.25, "bounce": 0.2, "seed": 13}, 0.5),
    ], [lp(3000)]))
    out.append(spec("tick", t, 0.07, [
        S("blip", {"freq": 2450, "dur": 0.03}, 0.4),
    ], [lp(4200)]))
    out.append(spec("bong", t, 0.75, [
        S("solenoid", {"size": 0.5, "metal": 0.55, "thump": 0.65, "bounce": 0.4, "seed": 14}, 0.6),
        N("sub", "A1", 0.45, 0.55, 0.32),
        N("bell", "C4", 0.45, 0.4, 0.3, at=0.02),
    ], [lp(3000), reverb(0.12, 0.3)]))
    out.append(spec("select", t, 0.45, [
        N("bell", "E5", 0.32, 0.5, 0.5),
        S("solenoid", {"size": 0.16, "metal": 0.3, "thump": 0.2, "bounce": 0.3, "seed": 15}, 0.4, at=0.02),
    ], [reverb(0.14, 0.35)]))
    out.append(spec("confirm", t, 0.75, [
        Q("bell", "C5:0.1 E5:0.12 G5:0.4", 0.55, vel=0.5),
        N("glass", "C6", 0.5, 0.35, 0.2, at=0.16),
    ], [reverb(0.18, 0.4)]))
    out.append(spec("error", t, 0.55, [
        S("error", {"freq": 165, "dur": 0.24}, 0.7),
        N("sub", "C2", 0.4, 0.5, 0.28, at=0.02),
        S("noise", {"dur": 0.16, "color": "brown"}, 0.12, at=0.06, fx=[lp(900)]),
    ], [lp(1500), reverb(0.06, 0.2)]))
    out.append(spec("chime", t, 0.9, [
        N("bell", "G5", 0.6, 0.42, 0.4),
        N("glass", "D6", 0.45, 0.3, 0.18, at=0.06),
        N("pad", "C3", 0.85, 0.28, 0.18, at=0.02),
    ], [reverb(0.2, 0.45)]))
    out.append(spec("deep", t, 1.2, [
        N("sub", "A1", 0.95, 0.55, 0.4),
        S("sweep_down", {"start": 150, "end": 62, "dur": 0.8, "wave": "sine"}, 0.2),
        S("noise", {"dur": 0.6, "color": "brown"}, 0.08, at=0.1, fx=[lp(500)]),
    ], [lp(1200), reverb(0.14, 0.4)]))
    out.append(spec("launchRise", t, 1.1, [
        S("riser", {"dur": 0.85, "start": 90, "end": 820}, 0.22),
        N("pad", "C3", 1.0, 0.36, 0.28),
        S("solenoid", {"size": 0.3, "metal": 0.4, "thump": 0.4, "bounce": 0.3, "seed": 16}, 0.4, at=0.1),
    ], [lp(4800), reverb(0.16, 0.4)]))
    out.append(spec("launchFall", t, 0.95, [
        S("sweep_down", {"start": 360, "end": 78, "dur": 0.75, "wave": "sine"}, 0.25),
        N("sub", "A1", 0.7, 0.5, 0.3),
        S("noise", {"dur": 0.4, "color": "brown"}, 0.1, at=0.02, fx=[lp(700)]),
    ], [lp(1500), reverb(0.12, 0.35)]))
    out.append(spec("switch", t, 0.75, [
        S("whoosh", {"dur": 0.45, "low": 200, "high": 2000, "direction": "up"}, 0.24),
        S("solenoid", {"size": 0.55, "metal": 0.5, "thump": 0.5, "bounce": 0.5, "seed": 17}, 0.55, at=0.05),
        S("blip", {"freq": 720, "dur": 0.05}, 0.24, at=0.2),
    ], [lp(4500), reverb(0.12, 0.3)]))
    out.append(spec("launch", t, 1.35, [
        S("riser", {"dur": 0.65, "start": 90, "end": 900}, 0.2),
        N("pad", "C3", 1.2, 0.36, 0.26),
        N("bell", "C5", 0.6, 0.36, 0.22, at=0.42),
        N("glass", "G5", 0.5, 0.26, 0.12, at=0.55),
    ], [reverb(0.2, 0.5)]))
    out.append(spec("exit", t, 0.85, [
        S("solenoid", {"size": 0.3, "metal": 0.35, "thump": 0.4, "bounce": 0.25, "seed": 18}, 0.45),
        S("powerdown", {"freq": "C5", "steps": 4, "rate": 0.06}, 0.25, at=0.04),
    ], [lp(2600), reverb(0.1, 0.3)]))
    out.append(spec("boot", t, 2.6, [
        N("sub", "A1", 2.3, 0.38, 0.24),
        S("engine", {"rpm": 55, "dur": 2.4}, 0.08, at=0.02, fx=[lp(380)]),
        S("solenoid", {"size": 0.18, "metal": 0.4, "thump": 0.3, "bounce": 0.3, "seed": 19}, 0.45, at=0.28),
        S("solenoid", {"size": 0.24, "metal": 0.4, "thump": 0.3, "bounce": 0.3, "seed": 20}, 0.45, at=0.72),
        S("blip", {"freq": 760, "dur": 0.05}, 0.22, at=0.95),
        N("bell", "G5", 0.65, 0.38, 0.3, at=1.55),
        N("glass", "D6", 0.5, 0.26, 0.14, at=1.7),
        N("pad", "C3", 0.9, 0.25, 0.16, at=1.9),
    ], [lp(4200), reverb(0.16, 0.45)]))
    return out


# NIGHT FLIGHT ---------------------------------------------------------

def night():
    t = "nightflight"
    out = []
    out.append(spec("click", t, 0.12, [
        S("solenoid", {"size": 0.12, "metal": 0.35, "thump": 0.3, "bounce": 0.25, "seed": 31}, 0.8),
        S("click", {"tone": 2000}, 0.4),
    ], [lp(4000)]))
    out.append(spec("nav", t, 0.18, [
        D("woodblock", 0.55, 0.6),
        S("blip", {"freq": 1280, "dur": 0.04}, 0.3, at=0.02),
    ], [lp(3600)]))
    out.append(spec("soft", t, 0.15, [
        S("pop", {"freq": 420}, 0.7),
        S("solenoid", {"size": 0.08, "metal": 0.2, "thump": 0.25, "bounce": 0.2, "seed": 32}, 0.45),
    ], [lp(3000)]))
    out.append(spec("tick", t, 0.07, [
        S("blip", {"freq": 2250, "dur": 0.03}, 0.38),
    ], [lp(4200)]))
    out.append(spec("bong", t, 0.75, [
        D("woodblock", 0.5, 0.5),
        N("sub", "A1", 0.4, 0.45, 0.28),
        N("bell", "C5", 0.5, 0.38, 0.28, at=0.02),
    ], [lp(3200), reverb(0.16, 0.35)]))
    out.append(spec("select", t, 0.45, [
        N("bell", "A5", 0.32, 0.45, 0.42),
        D("clave", 0.4, 0.35, at=0.02),
    ], [reverb(0.16, 0.35)]))
    out.append(spec("confirm", t, 0.8, [
        Q("bell", "A5:0.1 C#6:0.1 E6:0.4", 0.48, vel=0.45),
        N("glass", "A6", 0.5, 0.22, 0.08, at=0.16),
    ], [lp(5200), reverb(0.22, 0.5)]))
    out.append(spec("error", t, 0.55, [
        S("error", {"freq": 170, "dur": 0.24}, 0.6),
        S("static", {"dur": 0.14, "color": "white"}, 0.1, at=0.04, fx=[lp(2200)]),
        N("sub", "A1", 0.35, 0.4, 0.22, at=0.02),
    ], [lp(1600), reverb(0.06, 0.2)]))
    out.append(spec("chime", t, 1.0, [
        Q("bell", "C6:0.1 G5:0.45", 0.45, vel=0.4),
        N("glass", "E6", 0.5, 0.24, 0.14, at=0.1),
        N("pad", "C3", 0.9, 0.2, 0.12, at=0.02),
    ], [reverb(0.25, 0.55)]))
    out.append(spec("deep", t, 1.2, [
        S("wind", {"dur": 1.0}, 0.16, fx=[lp(700)]),
        S("sweep_down", {"start": 120, "end": 58, "dur": 0.9, "wave": "sine"}, 0.18),
        N("sub", "A1", 0.8, 0.45, 0.28, at=0.02),
    ], [lp(1200), reverb(0.14, 0.45)]))
    out.append(spec("launchRise", t, 1.1, [
        S("riser", {"dur": 0.9, "start": 80, "end": 780}, 0.2),
        S("wind", {"dur": 0.9}, 0.1, at=0.05, fx=[lp(1600)]),
        N("bell", "C5", 0.6, 0.36, 0.26, at=0.45),
    ], [lp(4500), reverb(0.18, 0.45)]))
    out.append(spec("launchFall", t, 1.0, [
        S("sweep_down", {"start": 400, "end": 80, "dur": 0.8, "wave": "sine"}, 0.22),
        S("static", {"dur": 0.18, "color": "white"}, 0.08, at=0.04, fx=[lp(2000)]),
        S("wind", {"dur": 0.8}, 0.1, fx=[lp(900)]),
    ], [lp(1800), reverb(0.12, 0.4)]))
    out.append(spec("switch", t, 0.8, [
        S("solenoid", {"size": 0.1, "metal": 0.25, "thump": 0.25, "bounce": 0.25, "seed": 33}, 0.5, at=0.0),
        S("solenoid", {"size": 0.1, "metal": 0.25, "thump": 0.25, "bounce": 0.25, "seed": 34}, 0.5, at=0.1),
        S("solenoid", {"size": 0.1, "metal": 0.25, "thump": 0.25, "bounce": 0.25, "seed": 35}, 0.5, at=0.2),
        S("solenoid", {"size": 0.12, "metal": 0.3, "thump": 0.3, "bounce": 0.3, "seed": 36}, 0.5, at=0.3),
        S("whoosh", {"dur": 0.55, "low": 220, "high": 1800, "direction": "up"}, 0.16, at=0.06),
        N("bell", "C6", 0.6, 0.34, 0.22, at=0.36),
    ], [lp(4500), reverb(0.18, 0.45)]))
    out.append(spec("launch", t, 1.5, [
        S("riser", {"dur": 0.7, "start": 90, "end": 800}, 0.18),
        S("wind", {"dur": 1.2}, 0.12, fx=[lp(1200)]),
        V("boarding", 0.32, at=0.28, fx=[{"type": "telephone"}, reverb(0.18, 0.45)]),
        N("bell", "C5", 0.7, 0.34, 0.24, at=0.7),
        N("glass", "G5", 0.6, 0.24, 0.12, at=0.85),
    ], [reverb(0.2, 0.5)]))
    out.append(spec("exit", t, 0.85, [
        Q("bell", "G5:0.1 E5:0.35", 0.45, vel=0.4),
        S("static", {"dur": 0.12, "color": "white"}, 0.07, at=0.02, fx=[lp(2000)]),
        S("wind", {"dur": 0.6}, 0.08, fx=[lp(700)]),
    ], [lp(3000), reverb(0.14, 0.4)]))
    out.append(spec("boot", t, 2.7, [
        S("wind", {"dur": 2.4}, 0.14, fx=[lp(800)]),
        S("solenoid", {"size": 0.1, "metal": 0.25, "thump": 0.25, "bounce": 0.25, "seed": 37}, 0.4, at=0.22),
        S("solenoid", {"size": 0.1, "metal": 0.25, "thump": 0.25, "bounce": 0.25, "seed": 38}, 0.4, at=0.46),
        S("solenoid", {"size": 0.1, "metal": 0.25, "thump": 0.25, "bounce": 0.25, "seed": 39}, 0.4, at=0.7),
        Q("bell", "C6:0.1 G5:0.5", 0.38, at=1.0, vel=0.38),
        V("boarding", 0.3, at=1.28, fx=[{"type": "telephone"}, reverb(0.18, 0.5)]),
        N("glass", "E6", 0.55, 0.22, 0.12, at=2.0),
        N("pad", "C3", 0.8, 0.2, 0.1, at=2.0),
    ], [reverb(0.22, 0.5)]))
    return out


def main():
    sounds = dusk() + steam() + night()
    batch = {"out_dir": OUT, "sounds": sounds}
    with open(BATCH, "w", encoding="utf-8") as f:
        json.dump(batch, f, ensure_ascii=False, indent=1)
    print(f"wrote {BATCH} ({len(sounds)} specs)")
    os.makedirs(OUT, exist_ok=True)
    r = subprocess.run(["genny", "render", BATCH, "--quiet"], cwd=ROOT)
    if r.returncode != 0:
        sys.exit(r.returncode)

    for s in sounds:
        theme, name = s["out"].split("/")
        wav = os.path.join(OUT, theme, name.replace(".wav", ".wav"))
        ogg = os.path.join(ROOT, "themes", theme, "sounds", name.replace(".wav", ".ogg"))
        os.makedirs(os.path.dirname(ogg), exist_ok=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav,
                        "-c:a", "libvorbis", "-q:a", "5", "-ac", "1", ogg], check=True)
    print("encoded OGG into themes/*/sounds/")


if __name__ == "__main__":
    main()

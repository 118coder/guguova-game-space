#!/usr/bin/env python3
"""Builds the genny batch that renders every theme's cue set.

Each theme owns 15 cues: the 12 shared interface sounds (same keys as
src/assets/sfx) plus switch / launch / exit / boot. `boot` is a sequence whose
layer offsets are the theme's intro keyframes, so the launcher's opening
animation and its sound land on the same beats.
"""
import json
import io
import os

# intro duration + the keyframe offsets measured from src/intro.css
INTROS = {
    'nova':      (2350, [60, 620, 1200]),
    'aurum':     (2450, [350, 450, 900]),
    'codex':     (2600, [100, 500, 950]),
    'riso':      (2400, [500, 650]),
    'endfield':  (2400, [60, 200, 420]),
    'zerohour':  (2200, [100, 380, 620]),
    'mnemo':     (2600, [100, 380, 580]),
    'summer':    (1900, [0, 180, 760]),
    'broadcast': (2200, [120, 620, 900]),
    'grimoire':  (2500, [120, 280, 1500]),
    'riot':      (2100, [80, 600, 1200]),
}


def sfx(kind, gain=1.0, at=0.0, **params):
    layer = {'type': 'sfx', 'kind': kind, 'gain': gain}
    if at:
        layer['at'] = at
    if params:
        layer['params'] = params
    return layer


def synth(inst, notes, dur, vel=0.5, gain=0.6, at=0.0, **params):
    layer = {'type': 'synth', 'inst': inst, 'notes': notes, 'dur': dur,
             'vel': vel, 'gain': gain}
    if at:
        layer['at'] = at
    if params:
        layer['params'] = params
    return layer


def seq(inst, steps, vel=0.5, gain=0.6, at=0.0, **params):
    layer = {'type': 'seq', 'inst': inst, 'steps': steps, 'vel': vel, 'gain': gain}
    if at:
        layer['at'] = at
    if params:
        layer['params'] = params
    return layer


def fx(kind, **params):
    return dict(type=kind, **params)


# Per-theme character, taken from docs/themes/<id>.md. Each theme gets its own
# physical material rather than "the same click at another pitch":
#   nova       电影感封面 —— 柔光、影院后排
#   aurum      暗色圣所 —— 金线、青玉、石室
#   codex      安静铜版 —— 羽毛笔、铜版、罗盘针
#   riso       三色套印 —— 纸张、字模、印压
#   endfield   工业纸面 —— 继电器、打字机、终端
#   zerohour   街区命令台 —— CRT、街机、漫画分镜
#   mnemo      雾紫档案 —— 档案夹、印章、检索
#   broadcast  胶片电台 —— 调频噪、磁带、黑胶
#   grimoire   羊皮档案 —— 纸页、蜡封、颂钵
#   riot       唱片封套 —— 木质敲击、黑胶、弦乐
#   summer     白纸杂志 —— 纸张、钟琴、快门
THEMES = {
    'nova': dict(
        click=('click', {'tone': 1500}, 'pop', {'freq': 480}, 2600, 300),
        nav=('click', {'tone': 2200}, 'pop', {'freq': 700}, 3000, 400),
        soft=('click', {'tone': 1200}, 'pop', {'freq': 340}, 2000, 240),
        bong=('celesta', 'A3', 'glass', 'A5'),
        select=('celesta', 'A3:0.12 C4:0.12', 'glass', 'E5'),
        confirm=('celesta', 'A3:0.10 C4:0.10 E4:0.36', 'glass', 'A5'),
        error=('felt_piano', 'A3:0.08 G3:0.12', 'sub', 'A1'),
        tick=('blip', {'freq': 2400, 'dur': 0.03}, 1400, 4200),
        chime=('bell', 'E5', 'glass', 'B5', 3.0),
        rise=('warm_pad', 'A3', ('sweep_up', 180, 600), 'sub', 'A1'),
        fall=('warm_pad', 'A3', ('sweep_down', 600, 180), 'sub', 'A1'),
        switch=('whoosh', {'dur': 0.45, 'low': 300, 'high': 2200, 'direction': 'up'}),
        bootbed=('warm_pad', 'A2'),
    ),
    'aurum': dict(
        click=('steel_ball', {'surface': 'metal', 'force': 0.3, 'seed': 2}, 'blip', {'freq': 1900, 'dur': 0.025}, 3200, 350),
        nav=('steel_ball', {'surface': 'metal', 'force': 0.4, 'seed': 5}, 'blip', {'freq': 2400, 'dur': 0.03}, 3600, 420),
        soft=('steel_ball', {'surface': 'wood', 'force': 0.22, 'seed': 8}, 'blip', {'freq': 1300, 'dur': 0.03}, 2400, 280),
        bong=('harp', 'A3', 'bell', 'A4'),
        select=('harp', 'A3:0.12 C4:0.12', 'bell', 'E5'),
        confirm=('harp', 'A3:0.10 C4:0.10 E4:0.36', 'bell', 'A5'),
        error=('cello', 'A2:0.10 G2:0.12', 'sub', 'A1'),
        tick=('blip', {'freq': 2100, 'dur': 0.03}, 1200, 3800),
        chime=('singing_bowl', 'A3', 'bell', 'E5'),
        rise=('harp', 'A3 C4 E4 A4', ('sweep_up', 160, 520), 'sub', 'A1'),
        fall=('harp', 'A4 E4 C4 A3', ('sweep_down', 520, 160), 'sub', 'A1'),
        switch=('whoosh', {'dur': 0.5, 'low': 240, 'high': 1800, 'direction': 'up'}),
        bootbed=('singing_bowl', 'A2'),
    ),
    'codex': dict(
        click=('typewriter', {}, 'blip', {'freq': 1700, 'dur': 0.02}, 3000, 380),
        nav=('typewriter', {}, 'blip', {'freq': 2200, 'dur': 0.025}, 3400, 460),
        soft=('typewriter', {}, 'blip', {'freq': 1200, 'dur': 0.025}, 2400, 300),
        bong=('harpsichord', 'F3', 'celesta', 'C5'),
        select=('harpsichord', 'F3:0.12 A3:0.12', 'celesta', 'C5'),
        confirm=('harpsichord', 'F3:0.10 A3:0.10 C4:0.36', 'celesta', 'F5'),
        error=('harpsichord', 'F3:0.08 E3:0.12', 'sub', 'F1'),
        tick=('blip', {'freq': 2300, 'dur': 0.03}, 1300, 4000),
        chime=('celesta', 'F5', 'glass', 'C6'),
        rise=('celesta', 'F3 A3 C4', ('sweep_up', 180, 560), 'sub', 'F1'),
        fall=('celesta', 'C4 A3 F3', ('sweep_down', 560, 180), 'sub', 'F1'),
        switch=('noise', {'dur': 0.26, 'color': 'pink', 'attack': 0.05}),
        bootbed=('glass_pad', 'F2'),
    ),
    'riso': dict(
        click=('typewriter', {}, 'pop', {'freq': 520}, 3200, 400),
        nav=('typewriter', {}, 'pop', {'freq': 700}, 3600, 480),
        soft=('typewriter', {}, 'pop', {'freq': 380}, 2400, 300),
        bong=('kalimba', 'G3', 'glass', 'D5'),
        select=('kalimba', 'G3:0.10 B3:0.10', 'glass', 'D5'),
        confirm=('kalimba', 'G3:0.08 B3:0.08 D4:0.30', 'glass', 'G5'),
        error=('noise', {'dur': 0.12, 'color': 'white', 'attack': 0.002}, 'sub', 'G1'),
        tick=('typewriter', {}, 1200, 5000),
        chime=('glass', 'G5', 'kalimba', 'G4'),
        rise=('kalimba', 'G3 B3 D4 G4', ('sweep_up', 200, 700), 'sub', 'G1'),
        fall=('kalimba', 'G4 D4 B3 G3', ('sweep_down', 700, 190), 'sub', 'G1'),
        switch=('noise', {'dur': 0.2, 'color': 'white', 'attack': 0.01}),
        bootbed=('kalimba', 'G3'),
    ),
    'endfield': dict(
        click=('solenoid', {'size': 0.35, 'metal': 0.4, 'thump': 0.3, 'bounce': 0.2, 'seed': 3}, 'typewriter', {}, 4600, 200),
        nav=('solenoid', {'size': 0.4, 'metal': 0.5, 'thump': 0.35, 'bounce': 0.25, 'seed': 7}, 'typewriter', {}, 5000, 240),
        soft=('solenoid', {'size': 0.3, 'metal': 0.3, 'thump': 0.5, 'bounce': 0.15, 'seed': 11}, None, {}, 2200, 160),
        bong=('marimba', 'D4', 'sub', 'D2'),
        select=('marimba', 'A3:0.08 C4:0.08', 'sub', 'A1'),
        confirm=('marimba', 'A3:0.07 C4:0.07 E4:0.28', 'sub', 'A1'),
        error=('sub', 'A1:0.10 G1:0.10', 'marimba', 'A2'),
        tick=('typewriter', {}, 900, 5000),
        chime=('bell', 'A5', 'marimba', 'A4', 3.0),
        rise=('marimba', 'A3 C4 E4', ('sweep_up', 160, 520), 'sub', 'A1'),
        fall=('marimba', 'E4 C4 A3', ('sweep_down', 520, 150), 'sub', 'A1'),
        switch=('solenoid', {'size': 0.5, 'metal': 0.55, 'thump': 0.45, 'bounce': 0.35, 'seed': 5}),
        bootbed=('engine', None),
    ),
    'zerohour': dict(
        click=('pop', {'freq': 420}, 'blip', {'freq': 900, 'dur': 0.03}, 2400, 200),
        nav=('pop', {'freq': 560}, 'blip', {'freq': 1300, 'dur': 0.03}, 2800, 260),
        soft=('pop', {'freq': 340}, 'blip', {'freq': 700, 'dur': 0.03}, 2000, 160),
        bong=('pluck', 'E3', 'sub', 'E1'),
        select=('pluck', 'E3:0.12 G3:0.12', 'glass', 'B3'),
        confirm=('pluck', 'E3:0.10 G3:0.10 B3:0.34', 'glass', 'E4'),
        error=('pluck', 'E3:0.10 D3:0.14', 'sub', 'E1'),
        tick=('blip', {'freq': 1500, 'dur': 0.026}, 900, 3000),
        chime=('glass', 'E5', 'pluck', 'B4'),
        rise=('pluck', 'E3 G3 B3', ('sweep_up', 140, 420), 'sub', 'E1'),
        fall=('pluck', 'B3 G3 E3', ('sweep_down', 420, 140), 'sub', 'E1'),
        switch=('sweep_down', {'start': 180, 'end': 80, 'dur': 0.28, 'wave': 'sine'}),
        bootbed=('vinyl', None),
    ),
    'mnemo': dict(
        click=('door', {}, 'blip', {'freq': 1500, 'dur': 0.02}, 2600, 300),
        nav=('door', {}, 'blip', {'freq': 2000, 'dur': 0.025}, 3000, 380),
        soft=('door', {}, 'blip', {'freq': 1100, 'dur': 0.025}, 2000, 240),
        bong=('vibraphone', 'A3', 'glass', 'A4'),
        select=('vibraphone', 'A3:0.12 C4:0.12', 'glass', 'E5'),
        confirm=('vibraphone', 'A3:0.10 C4:0.10 E4:0.34', 'glass', 'A5'),
        error=('knocker', {'size': 0.5, 'rattle': 0.2, 'seed': 4}, 'sub', 'A1'),
        tick=('blip', {'freq': 2500, 'dur': 0.028}, 1500, 4200),
        chime=('glass', 'E6', 'vibraphone', 'A4'),
        rise=('glass_pad', 'A3', ('sweep_up', 190, 580), 'sub', 'A1'),
        fall=('glass_pad', 'A3', ('sweep_down', 580, 190), 'sub', 'A1'),
        switch=('whoosh', {'dur': 0.28, 'low': 500, 'high': 2400, 'direction': 'up'}),
        bootbed=('glass_pad', 'A2'),
    ),
    'broadcast': dict(
        click=('click', {'tone': 1500}, 'pop', {'freq': 500}, 2600, 300),
        nav=('click', {'tone': 2200}, 'pop', {'freq': 700}, 3000, 380),
        soft=('click', {'tone': 1200}, 'pop', {'freq': 360}, 2000, 240),
        bong=('epiano', 'C3', 'sub', 'C1'),
        select=('epiano', 'C3:0.12 E3:0.12', 'glass', 'G4'),
        confirm=('epiano', 'C3:0.10 E3:0.10 G3:0.34', 'glass', 'C5'),
        error=('static', {'dur': 0.18, 'color': 'white'}, 'sub', 'C1'),
        tick=('pop', {'freq': 620}, 900, 3000),
        chime=('bell', 'G5', 'glass', 'C6'),
        rise=('soft_lead', 'C3 E3 G3', ('sweep_up', 150, 600), 'sub', 'C1'),
        fall=('soft_lead', 'G3 E3 C3', ('sweep_down', 600, 150), 'sub', 'C1'),
        switch=('static', {'dur': 0.25, 'color': 'white'}),
        bootbed=('tone', None),
    ),
    'grimoire': dict(
        click=('typewriter', {}, 'pop', {'freq': 460}, 2800, 300),
        nav=('typewriter', {}, 'blip', {'freq': 1600, 'dur': 0.025}, 3200, 380),
        soft=('typewriter', {}, 'pop', {'freq': 340}, 2200, 240),
        bong=('marimba', 'D3', 'glass', 'A4'),
        select=('harp', 'D3:0.12 F3:0.12', 'glass', 'A4'),
        confirm=('harp', 'D3:0.10 F3:0.10 A3:0.36', 'glass', 'D5'),
        error=('cello', 'D2:0.10 C2:0.12', 'sub', 'D1'),
        tick=('typewriter', {}, 1000, 4600),
        chime=('singing_bowl', 'D3', 'glass', 'D5'),
        rise=('harp', 'D3 F3 A3 D4', ('sweep_up', 170, 560), 'sub', 'D1'),
        fall=('harp', 'D4 A3 F3 D3', ('sweep_down', 560, 170), 'sub', 'D1'),
        switch=('noise', {'dur': 0.24, 'color': 'pink', 'attack': 0.04}),
        bootbed=('singing_bowl', 'D3'),
    ),
    'riot': dict(
        click=('steel_ball', {'surface': 'wood', 'force': 0.35, 'seed': 3}, 'pop', {'freq': 500}, 3000, 300),
        nav=('steel_ball', {'surface': 'wood', 'force': 0.45, 'seed': 6}, 'pop', {'freq': 700}, 3400, 380),
        soft=('steel_ball', {'surface': 'wood', 'force': 0.2, 'seed': 9}, 'pop', {'freq': 380}, 2200, 240),
        bong=('marimba', 'E3', 'sub', 'E1'),
        select=('marimba', 'E3:0.10 G3:0.10', 'strings', 'B3'),
        confirm=('marimba', 'E3:0.08 G3:0.08 B3:0.30', 'strings', 'E4'),
        error=('marimba', 'E3:0.08 D3:0.12', 'sub', 'E1'),
        tick=('click', {'tone': 2800}, 1800, 4600),
        chime=('glass', 'B5', 'marimba', 'E5'),
        rise=('strings', 'E3 G3 B3', ('sweep_up', 200, 800), 'sub', 'E1'),
        fall=('strings', 'B3 G3 E3', ('sweep_down', 800, 180), 'sub', 'E1'),
        switch=('whoosh', {'dur': 0.35, 'low': 400, 'high': 2800, 'direction': 'up'}),
        bootbed=('vinyl', None),
    ),
    'summer': dict(
        click=('typewriter', {}, 'blip', {'freq': 2400, 'dur': 0.02}, 3600, 420),
        nav=('typewriter', {}, 'blip', {'freq': 3000, 'dur': 0.025}, 4000, 520),
        soft=('pop', {'freq': 420}, 'blip', {'freq': 1500, 'dur': 0.02}, 2600, 300),
        bong=('kalimba', 'C4', 'glockenspiel', 'C6'),
        select=('glockenspiel', 'C6:0.10 E6:0.18', 'glass', 'C7'),
        confirm=('glockenspiel', 'C6:0.09 E6:0.09 G6:0.30', 'glass', 'C7'),
        error=('kalimba', 'C4:0.08 B3:0.12', 'sub', 'C2'),
        tick=('blip', {'freq': 2700, 'dur': 0.028}, 1600, 4200),
        chime=('glockenspiel', 'C6', 'glass', 'E6'),
        rise=('glockenspiel', 'C5 E5 G5', ('sweep_up', 260, 900), 'sub', 'C2'),
        fall=('glockenspiel', 'G5 E5 C5', ('sweep_down', 900, 240), 'sub', 'C2'),
        switch=('typewriter', {}, ),
        bootbed=('warm_pad', 'C3'),
    ),
}


def build():
    sounds = []
    for theme, cfg in THEMES.items():
        dur_ms, beats = INTROS[theme]
        sounds.extend(build_ui(theme, cfg))
        sounds.extend(build_events(theme, cfg, dur_ms, beats))
    return {'out_dir': 'themes', 'sr': 44100, 'normalize': -1.0,
            'max_loudness': -6.0, 'sounds': sounds}


def build_ui(theme, cfg):
    out = []

    # --- ordinary button: transient + body, filtered for softness ----------
    kind, params, add_kind, add_params, cutoff, hp = cfg['click']
    out.append(spec(f'{theme}/click.wav', 0.02, [
        sfx(kind, 0.8, **params),
        sfx(add_kind, 0.3, **add_params) if add_kind else None,
    ], [fx('lowpass', cutoff=cutoff), fx('highpass', cutoff=hp), fx('highshelf', freq=3200, gain=-2)]))

    kind, params, add_kind, add_params, cutoff, hp = cfg['nav']
    out.append(spec(f'{theme}/nav.wav', 0.022, [
        sfx(kind, 0.75, **params),
        sfx(add_kind, 0.34, **add_params) if add_kind else None,
    ], [fx('lowpass', cutoff=cutoff), fx('highpass', cutoff=hp), fx('highshelf', freq=3200, gain=-2)]))

    kind, params, add_kind, add_params, cutoff, hp = cfg['soft']
    out.append(spec(f'{theme}/soft.wav', 0.022, [
        sfx(kind, 0.7, **params),
        sfx(add_kind, 0.28, **add_params) if add_kind else None,
    ], [fx('lowpass', cutoff=cutoff), fx('highpass', cutoff=hp), fx('highshelf', freq=3200, gain=-2)]))

    # --- directional step ---------------------------------------------------
    inst, note, inst2, note2 = cfg['bong']
    out.append(spec(f'{theme}/bong.wav', 0.14, [
        synth(inst, note, 0.1, vel=0.55, gain=0.85),
        synth(inst2, note2, 0.1, vel=0.4, gain=0.3),
    ], [fx('reverb', mix=0.12, size=0.25)]))

    # --- two-step and three-step confirmations ------------------------------
    inst, steps, extra_inst, extra_note = cfg['select']
    layers = [seq(inst, steps, vel=0.55, gain=0.8)]
    if extra_inst:
        layers.append(synth(extra_inst, extra_note, 0.16, vel=0.3, gain=0.18, at=0.05))
    out.append(spec(f'{theme}/select.wav', 0.32, layers,
                    [fx('reverb', mix=0.22, size=0.35)]))

    inst, steps, extra_inst, extra_note = cfg['confirm']
    layers = [seq(inst, steps, vel=0.58, gain=0.8)]
    if extra_inst:
        layers.append(synth(extra_inst, extra_note, 0.2, vel=0.28, gain=0.16, at=0.18))
    out.append(spec(f'{theme}/confirm.wav', 0.58, layers,
                    [fx('reverb', mix=0.26, size=0.45)]))

    # --- failure ------------------------------------------------------------
    inst, steps, sub_inst, sub_note = cfg['error']
    if isinstance(steps, dict):
        # The theme describes its failure as a noise/generator hit rather than
        # a melodic interval.
        body = sfx(inst, 0.7, **steps)
    elif ':' in steps:
        body = seq(inst, steps, vel=0.5, gain=0.8)
    else:
        body = synth(inst, steps, 0.16, vel=0.5, gain=0.8)
    out.append(spec(f'{theme}/error.wav', 0.18, [
        body,
        synth(sub_inst, sub_note, 0.1, vel=0.4, gain=0.25),
    ], [fx('lowpass', cutoff=2400), fx('reverb', mix=0.1, size=0.2)]))

    # --- hover tick ---------------------------------------------------------
    tick_kind, tick_params, tick_hp, tick_lp = cfg['tick']
    out.append(spec(f'{theme}/tick.wav', 0.045, [
        sfx(tick_kind, 0.32, **tick_params),
    ], [fx('highpass', cutoff=tick_hp),
        fx('lowpass', cutoff=min(tick_lp, 4200)),
        fx('highshelf', freq=3200, gain=-4)]))

    # --- game ready ---------------------------------------------------------
    inst, note, extra_inst, extra_note, *ratio = cfg['chime']
    params = {'ratio': ratio[0]} if ratio else {}
    out.append(spec(f'{theme}/chime.wav', 0.3, [
        synth(inst, note, 0.18, vel=0.5, gain=0.8, **params),
        synth(extra_inst, extra_note, 0.22, vel=0.28, gain=0.2),
    ], [fx('reverb', mix=0.3, size=0.4)]))

    # --- launch / dismiss (shared fallback path) ----------------------------
    out.append(launch_spec(f'{theme}/launchRise.wav', cfg, rising=True))
    out.append(launch_spec(f'{theme}/launchFall.wav', cfg, rising=False))

    # --- sleep: the same "powering down" gesture in the theme's material ---
    out.append(deep_spec(theme, cfg))
    return out


def deep_spec(theme, cfg):
    """A low downward gesture: the one cue that should feel like a lamp
    going out, built from whatever the theme already sounds like."""
    bed_inst, bed_note = cfg['bootbed']
    layers = [sfx('sweep_down', 0.6, start=240, end=100, dur=0.2, wave='sine')]
    if bed_inst == 'engine':
        layers.append(sfx('solenoid', 0.42, size=0.5, metal=0.3, thump=0.75, bounce=0.1))
    elif bed_inst == 'vinyl':
        layers.append(sfx('vinyl', 0.16, dur=0.2, crackle=8, hiss=0.2, seed=3))
    elif bed_inst == 'tone':
        layers.append(sfx('tone', 0.24, freq=58, dur=0.16, wave='sine'))
    else:
        layers.append(synth(bed_inst, bed_note, 0.18, vel=0.3, gain=0.34))
    return spec(f'{theme}/deep.wav', 0.22, layers,
                [fx('lowpass', cutoff=1200), fx('reverb', mix=0.12, size=0.3)])


def launch_spec(path, cfg, rising):
    inst, notes, (sweep_kind, a, b), sub_inst, sub_note = cfg['rise' if rising else 'fall']
    if not rising:
        notes = ' '.join(reversed(notes.split()))
    return spec(path, 0.28, [
        synth(inst, notes.split()[0], 0.2, vel=0.45, gain=0.5),
        sfx(sweep_kind, 0.45, start=a, end=b, dur=0.2, wave='sine'),
        synth(sub_inst, sub_note, 0.12, vel=0.35, gain=0.25),
    ], [fx('reverb', mix=0.2, size=0.4)])


def build_events(theme, cfg, dur_ms, beats):
    out = []
    dur = dur_ms / 1000.0

    # --- switching to this theme -------------------------------------------
    kind, params = cfg['switch']
    extra = []
    if kind == 'static':
        extra = [sfx('click', 0.25, tone=1800, at=min(0.25, dur * 0.6))]
    elif kind == 'noise':
        extra = [sfx('typewriter', 0.2, at=min(0.18, dur * 0.5))]
    elif kind == 'solenoid':
        extra = [sfx('solenoid', 0.5, at=0.09, size=0.4, metal=0.5, thump=0.35, bounce=0.2, seed=9)]
    elif kind == 'whoosh':
        extra = [sfx('click', 0.2, tone=1600, at=min(0.3, dur * 0.7))]
    # Every switch keeps a ceiling: transitions are the one place a
    # texture is allowed to be noisy, but never broadband.
    switch_fx = [fx('lowpass', cutoff=3600), fx('highshelf', freq=3000, gain=-2),
                 fx('reverb', mix=0.14, size=0.3)]
    if kind == 'whoosh':
        switch_fx = [fx('lowpass', cutoff=3200), fx('highshelf', freq=3000, gain=-3),
                     fx('reverb', mix=0.12, size=0.3)]
    if kind == 'sweep_down':
        switch_fx = [fx('lowpass', cutoff=1400), fx('reverb', mix=0.14, size=0.3)]
    if kind in ('static', 'noise'):
        # Noise only reads as "static" while its top octave is under control.
        switch_fx = [fx('lowpass', cutoff=3000), fx('highshelf', freq=3000, gain=-4),
                     fx('reverb', mix=0.1, size=0.3)]
    out.append(spec(f'{theme}/switch.wav', dur, [sfx(kind, 0.7, **params)] + extra,
                    switch_fx))

    # --- starting a game: the theme's rise, spelled out --------------------
    inst, notes, (sweep_kind, a, b), sub_inst, sub_note = cfg['rise']
    out.append(spec(f'{theme}/launch.wav', 0.65, [
        synth(inst, notes.split()[0], 0.28, vel=0.45, gain=0.5),
        sfx(sweep_kind, 0.5, start=a, end=b, dur=0.4, wave='sine'),
        synth(sub_inst, sub_note, 0.24, vel=0.4, gain=0.3),
        synth(cfg['chime'][0], cfg['chime'][1], 0.24, vel=0.26, gain=0.16, at=0.22),
    ], [fx('reverb', mix=0.24, size=0.45)]))

    # --- ending a game: mirrored ------------------------------------------
    inst, notes, (sweep_kind, a, b), sub_inst, sub_note = cfg['fall']
    out.append(spec(f'{theme}/exit.wav', 0.5, [
        synth(inst, notes.split()[0], 0.22, vel=0.4, gain=0.45),
        sfx(sweep_kind, 0.42, start=a, end=b, dur=0.32, wave='sine'),
        synth(sub_inst, sub_note, 0.18, vel=0.3, gain=0.24),
    ], [fx('lowpass', cutoff=3000), fx('reverb', mix=0.22, size=0.4)]))

    # --- the launcher opening: hits on the intro keyframes ----------------
    bed_inst, bed_note = cfg['bootbed']
    layers = []
    if bed_inst == 'engine':
        layers.append(sfx('engine', 0.3, rpm=80, dur=dur * 0.7))
    elif bed_inst == 'vinyl':
        layers.append(sfx('vinyl', 0.6, dur=dur * 0.92, crackle=7, hiss=0.18, seed=5))
    elif bed_inst == 'tone':
        layers.append(sfx('tone', 0.24, freq=56, dur=dur * 0.6, wave='sine'))
    elif bed_inst == 'kalimba':
        layers.append(synth('kalimba', bed_note, dur * 0.6, vel=0.18, gain=0.14))
    else:
        layers.append(synth(bed_inst, bed_note, dur * 0.8, vel=0.3, gain=0.3))

    # One hit per keyframe. The first is the heaviest, the rest answer it.
    for i, ms in enumerate(beats):
        at = ms / 1000.0
        if theme == 'endfield':
            layers.append(sfx('solenoid', 0.55 if i == 0 else 0.4, at=at,
                              size=0.45, metal=0.5, thump=0.45, bounce=0.25, seed=11 + i))
        elif theme == 'zerohour':
            # A CRT degauss thump, not a noise burst: the old static hits were
            # the main reason this theme read as harsh.
            layers.append({'type': 'drum', 'kind': 'kick', 'gain': 0.42 if i == 0 else 0.3,
                           'at': at, 'params': {'tune': 45}})
        elif theme == 'broadcast':
            layers.append(sfx('static', 0.26, at=at, dur=0.14, color='white'))
        elif theme == 'summer':
            layers.append(synth('glockenspiel', ['C6', 'E6', 'G6'][i % 3], 0.3,
                                vel=0.36, gain=0.34, at=at))
        elif theme == 'grimoire':
            layers.append(sfx('typewriter', 0.3, at=at) if i < 2
                          else synth('singing_bowl', 'D3', 0.5, vel=0.3, gain=0.35, at=at))
        elif theme == 'riot':
            # The bed alone is far too quiet to read as a launch cue; give the
            # keyframes the theme's wooden mallet voice on top of it.
            layers.append(synth('marimba', ['E3', 'G3', 'B3'][i % 3], 0.3,
                                vel=0.4, gain=0.5, at=at))
        elif theme == 'riso':
            layers.append(sfx('typewriter', 0.34, at=at))
        elif theme == 'codex':
            layers.append(synth('celesta', ['F4', 'A4', 'C5'][i % 3], 0.3,
                                vel=0.34, gain=0.4, at=at))
        elif theme == 'aurum':
            layers.append(synth('harp', ['A3', 'C4', 'E4'][i % 3], 0.35,
                                vel=0.34, gain=0.4, at=at))
        elif theme == 'mnemo':
            layers.append(synth('glass', ['A5', 'C6', 'E6'][i % 3], 0.3,
                                vel=0.26, gain=0.3, at=at))
        else:  # nova
            layers.append(synth('celesta', ['A3', 'C4', 'E4'][i % 3], 0.32,
                                vel=0.34, gain=0.4, at=at))

    boot_fx = [fx('reverb', mix=0.28, size=0.5)]
    if theme in ('zerohour', 'broadcast', 'riso', 'riot'):
        boot_fx = [fx('lowpass', cutoff=2800), fx('highshelf', freq=3000, gain=-5),
                   fx('reverb', mix=0.22, size=0.45)]
    out.append(spec(f'{theme}/boot.wav', dur, layers, boot_fx))
    return out


def spec(path, dur, layers, effects):
    return {
        'out': path,
        'duration': round(dur, 3),
        'layers': [l for l in layers if l],
        'fx': effects,
        'trim': True,
    }


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    data = build()
    out = os.path.join(here, 'themes-all.json')
    io.open(out, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, indent=1))
    print(f'{len(data["sounds"])} specs -> {out}')

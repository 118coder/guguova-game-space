//! Cover palette kernel, compiled to WebAssembly.
//!
//! The launcher derives a "cover DNA" from artwork: dominant accent, secondary
//! accent, average luminance/saturation and edge density. The C# side already
//! does this at import time; this kernel exists for the paths that only have
//! pixels in the page — a dropped image, a user-picked file, a theme preview —
//! so they can produce the identical numbers without a round-trip to the host
//! and without blocking the UI thread on a full 1920x1080 scan.
//!
//! Design constraints:
//!   * no allocator, no std: the module must stay small and load instantly;
//!   * deterministic: same pixels in, same palette out, on every engine;
//!   * the JS implementation in src/capability/palette.js mirrors this file
//!     exactly, so a browser without WASM gets the same answer, slower.

#![no_std]

const HUE_BUCKETS: usize = 24;
const BUCKET_WIDTH: u32 = 15;

/// Result layout in the shared output buffer. Keep in sync with palette.js.
/// 0..3   accent rgb (0-255)       3..6   accent2 rgb
/// 6..9   light rgb                9..12  dark rgb
/// 12     luma (0-1)               13     saturation (0-1)
/// 14     warmth (0-1)             15     edge density (0-1)
const OUT_LEN: usize = 16;

#[no_mangle]
pub static mut OUT: [f32; OUT_LEN] = [0.0; OUT_LEN];

#[no_mangle]
pub static mut HUE_COUNT: [f32; HUE_BUCKETS] = [0.0; HUE_BUCKETS];
#[no_mangle]
pub static mut HUE_SAT: [f32; HUE_BUCKETS] = [0.0; HUE_BUCKETS];
#[no_mangle]
pub static mut HUE_VAL: [f32; HUE_BUCKETS] = [0.0; HUE_BUCKETS];

/// Absolute luminance grid, reused as the scratch buffer for edge detection.
/// Callers size it to `width * height` floats.
static mut LUMA: [f32; MAX_PIXELS] = [0.0; MAX_PIXELS];
const MAX_PIXELS: usize = 4 * 1024 * 1024;

/// Analyse an RGBA8 buffer.
///
/// Returns a pointer to the 16-float result block. `step` subsamples the grid
/// (1 = every pixel, 2 = every other, ...), which is what keeps a 1920x1080
/// cover under a millisecond: the palette does not change when you skip rows.
#[no_mangle]
pub unsafe extern "C" fn analyse(
    ptr: *const u8,
    width: u32,
    height: u32,
    step: u32,
) -> *const f32 {
    let step = if step == 0 { 1 } else { step } as usize;
    let w = width as usize;
    let h = height as usize;

    for bucket in 0..HUE_BUCKETS {
        HUE_COUNT[bucket] = 0.0;
        HUE_SAT[bucket] = 0.0;
        HUE_VAL[bucket] = 0.0;
    }

    let mut sum_r = 0.0f32;
    let mut sum_b = 0.0f32;
    let mut sum_luma = 0.0f32;
    let mut sum_sat = 0.0f32;
    let mut count = 0.0f32;

    let mut y = 0usize;
    while y < h {
        let mut x = 0usize;
        while x < w {
            let index = (y * w + x) * 4;
            let r = *ptr.add(index) as f32;
            let g = *ptr.add(index + 1) as f32;
            let b = *ptr.add(index + 2) as f32;

            sum_r += r;
            sum_b += b;

            let max = if r > g { if r > b { r } else { b } } else if g > b { g } else { b };
            let min = if r < g { if r < b { r } else { b } } else if g < b { g } else { b };
            let delta = max - min;
            let value = max / 255.0;
            let sat = if max == 0.0 { 0.0 } else { delta / max };
            // Rec. 709 luma, the same weights the C# analyser uses.
            let luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0;

            sum_luma += luma;
            sum_sat += sat;

            if y * w + x < MAX_PIXELS {
                LUMA[y * w + x] = luma;
            }

            if sat > 0.18 && value > 0.16 {
                let mut hue = if delta == 0.0 {
                    0.0
                } else if max == r {
                    60.0 * (((g - b) / delta) % 6.0)
                } else if max == g {
                    60.0 * ((b - r) / delta + 2.0)
                } else {
                    60.0 * ((r - g) / delta + 4.0)
                };
                if hue < 0.0 {
                    hue += 360.0;
                }
                let bucket = ((hue / BUCKET_WIDTH as f32) as u32 % HUE_BUCKETS as u32) as usize;
                let weight = sat * value;
                HUE_COUNT[bucket] += weight;
                HUE_SAT[bucket] += sat * weight;
                HUE_VAL[bucket] += value * weight;
            }

            count += 1.0;
            x += step;
        }
        y += step;
    }

    let edge = edge_density(w, h, step);
    let avg_luma = if count > 0.0 { sum_luma / count } else { 0.0 };
    let avg_sat = if count > 0.0 { sum_sat / count } else { 0.0 };
    // Warmth is the red-vs-blue balance of the average colour, mapped to 0..1.
    let warmth = clamp(
        0.5 + ((sum_r / count / 255.0) - (sum_b / count / 255.0)) * 0.9,
        0.0,
        1.0,
    );

    // Dominant bucket, then the strongest bucket far enough away in hue.
    let mut primary = 0usize;
    for bucket in 1..HUE_BUCKETS {
        if HUE_COUNT[bucket] > HUE_COUNT[primary] {
            primary = bucket;
        }
    }
    let mut secondary = primary;
    let mut best = -1.0f32;
    for bucket in 0..HUE_BUCKETS {
        if circular_distance(bucket, primary) <= 3 {
            continue;
        }
        if HUE_COUNT[bucket] > best {
            best = HUE_COUNT[bucket];
            secondary = bucket;
        }
    }
    if best < 0.0 {
        secondary = (primary + 2) % HUE_BUCKETS;
    }

    let primary_hue = (primary as f32 * BUCKET_WIDTH as f32 + 7.5) % 360.0;
    let (primary_sat, primary_val) = bucket_stats(primary, 0.32, 0.82, 0.55, 0.95);
    let accent = hsv_to_rgb(primary_hue, primary_sat, primary_val);

    let accent2 = if HUE_COUNT[secondary] > 0.0001 {
        let hue = (secondary as f32 * BUCKET_WIDTH as f32 + 7.5) % 360.0;
        let (s, v) = bucket_stats(secondary, 0.38, 0.80, 0.55, 0.90);
        hsv_to_rgb(hue, s, v)
    } else {
        hsv_to_rgb((primary_hue + 32.0) % 360.0, primary_sat * 0.9, min_f32(1.0, primary_val * 0.96))
    };

    let light = if avg_luma > 0.62 {
        [246.0, 241.0, 230.0]
    } else {
        hsv_to_rgb(primary_hue, clamp(avg_sat * 0.45, 0.10, 0.40), 0.95)
    };
    let dark = hsv_to_rgb(
        primary_hue,
        clamp(primary_sat * 0.55, 0.28, 0.72),
        clamp(primary_val * 0.24, 0.08, 0.25),
    );

    OUT[0] = accent[0];
    OUT[1] = accent[1];
    OUT[2] = accent[2];
    OUT[3] = accent2[0];
    OUT[4] = accent2[1];
    OUT[5] = accent2[2];
    OUT[6] = light[0];
    OUT[7] = light[1];
    OUT[8] = light[2];
    OUT[9] = dark[0];
    OUT[10] = dark[1];
    OUT[11] = dark[2];
    OUT[12] = avg_luma;
    OUT[13] = avg_sat;
    OUT[14] = warmth;
    OUT[15] = edge;

    core::ptr::addr_of!(OUT) as *const f32
}

/// Number of pixels examined, so the caller can sanity-check coverage.
#[no_mangle]
pub extern "C" fn out_len() -> u32 {
    OUT_LEN as u32
}

#[inline]
fn bucket_stats(bucket: usize, sat_lo: f32, sat_hi: f32, val_lo: f32, val_hi: f32) -> (f32, f32) {
    unsafe {
        if HUE_COUNT[bucket] > 0.0001 {
            (
                clamp(HUE_SAT[bucket] / HUE_COUNT[bucket], sat_lo, sat_hi),
                clamp(HUE_VAL[bucket] / HUE_COUNT[bucket], val_lo, val_hi),
            )
        } else {
            (0.5, 0.7)
        }
    }
}

/// Mean absolute luma gradient over the sampled grid. This is what a
/// dossier-style theme reads as "how busy is this artwork".
unsafe fn edge_density(w: usize, h: usize, step: usize) -> f32 {
    if w < 3 || h < 3 {
        return 0.0;
    }
    let mut total = 0.0f32;
    let mut samples = 0.0f32;
    let mut y = 1usize;
    while y < h - 1 {
        let mut x = 1usize;
        while x < w - 1 {
            let at = y * w + x;
            if at >= MAX_PIXELS {
                return 0.0;
            }
            let center = LUMA[at];
            let dx = abs_f32(center - LUMA[at + 1]);
            let dy = abs_f32(center - LUMA[at + w]);
            if dx + dy > 0.12 {
                total += 1.0;
            }
            samples += 1.0;
            x += step;
        }
        y += step;
    }
    if samples == 0.0 { 0.0 } else { total / samples }
}

#[inline]
fn circular_distance(a: usize, b: usize) -> i32 {
    let d = a as i32 - b as i32;
    let abs = if d < 0 { -d } else { d };
    if abs > HUE_BUCKETS as i32 / 2 { HUE_BUCKETS as i32 - abs } else { abs }
}

#[inline]
fn hsv_to_rgb(h: f32, s: f32, v: f32) -> [f32; 3] {
    let h = ((h % 360.0) + 360.0) % 360.0;
    let c = v * s;
    let x = c * (1.0 - abs_f32((h / 60.0) % 2.0 - 1.0));
    let m = v - c;
    let (r, g, b) = if h < 60.0 {
        (c, x, 0.0)
    } else if h < 120.0 {
        (x, c, 0.0)
    } else if h < 180.0 {
        (0.0, c, x)
    } else if h < 240.0 {
        (0.0, x, c)
    } else if h < 300.0 {
        (x, 0.0, c)
    } else {
        (c, 0.0, x)
    };
    [(r + m) * 255.0, (g + m) * 255.0, (b + m) * 255.0]
}

#[inline]
fn abs_f32(v: f32) -> f32 {
    if v < 0.0 { -v } else { v }
}

#[inline]
fn min_f32(a: f32, b: f32) -> f32 {
    if a < b { a } else { b }
}

#[inline]
fn clamp(v: f32, lo: f32, hi: f32) -> f32 {
    if v < lo { lo } else if v > hi { hi } else { v }
}

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}

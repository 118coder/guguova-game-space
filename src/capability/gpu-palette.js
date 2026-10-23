/* ============================================================
   NOVA · WEBGPU COVER KERNEL
   ------------------------------------------------------------
   The same palette analysis as palette.js, run as a compute shader.

   Why a GPU kernel at all: the JS path is fine at 96x96, but a theme that
   wants to sample a full 1920x1080 hero — or sample four candidates to pick
   the best crop — pays that cost on the frame. A compute pass reads the whole
   image in well under a millisecond.

   This module is strictly optional. capability.js decides whether it is used,
   and every entry point returns null on failure so the caller falls back to
   WASM or plain JS. Nothing here is on the critical path of a launch.

   Determinism: threads accumulate into private registers, then a fixed
   tree reduction folds them through workgroup memory. No float atomics means
   the result does not depend on scheduling, so a GPU answer and a CPU answer
   are comparable. tools/test-palette.js enforces that when a GPU exists.
   ============================================================ */
(function () {
  'use strict';

  const HUE_BUCKETS = 24;
  const WORKGROUP = 256;
  // 24 hue weights + sat weights + val weights, then 4 scalars
  // (sumR, sumB, sumLuma, sumSat) and one sample count.
  const SLOTS = HUE_BUCKETS * 3 + 5;
  const SLOTS_PADDED = 128; // power of two keeps the tree reduction simple

  const SHADER = `
struct Params {
  width: u32,
  height: u32,
  step: u32,
  _pad: u32,
};

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> pixels: array<u32>;
@group(0) @binding(2) var<storage, read_write> result: array<f32, ${SLOTS_PADDED}>;

// 256 lanes x one scalar at a time during reduction.
var<workgroup> scratch: array<f32, ${WORKGROUP}>;

fn hue_bucket(hue_in: f32) -> u32 {
  var h = hue_in;
  if (h < 0.0) { h = h + 360.0; }
  return u32(h / 15.0) % ${HUE_BUCKETS}u;
}

@compute @workgroup_size(${WORKGROUP})
fn main(@builtin(local_invocation_index) lid: u32) {
  // Private per-thread accumulators, laid out like the result vector.
  var acc: array<f32, ${SLOTS}>;
  for (var i = 0u; i < ${SLOTS}u; i = i + 1u) { acc[i] = 0.0; }

  let total = params.width * params.height;
  let step = max(1u, params.step);

  var index = lid;
  let stride = ${WORKGROUP}u;
  loop {
    if (index >= total) { break; }
    let x = index % params.width;
    let y = index / params.width;
    if ((x % step) == 0u && (y % step) == 0u) {
      let packed = pixels[index];
      let r = f32(packed & 0xFFu);
      let g = f32((packed >> 8u) & 0xFFu);
      let b = f32((packed >> 16u) & 0xFFu);

      acc[${HUE_BUCKETS * 3}u + 0u] = acc[${HUE_BUCKETS * 3}u + 0u] + r;
      acc[${HUE_BUCKETS * 3}u + 1u] = acc[${HUE_BUCKETS * 3}u + 1u] + b;

      let mx = max(r, max(g, b));
      let mn = min(r, min(g, b));
      let delta = mx - mn;
      let value = mx / 255.0;
      var sat = 0.0;
      if (mx > 0.0) { sat = delta / mx; }
      let luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0;
      acc[${HUE_BUCKETS * 3}u + 2u] = acc[${HUE_BUCKETS * 3}u + 2u] + luma;
      acc[${HUE_BUCKETS * 3}u + 3u] = acc[${HUE_BUCKETS * 3}u + 3u] + sat;
      acc[${HUE_BUCKETS * 3}u + 4u] = acc[${HUE_BUCKETS * 3}u + 4u] + 1.0;

      if (sat > 0.18 && value > 0.16) {
        var hue = 0.0;
        if (delta > 0.0) {
          if (mx == r) { hue = 60.0 * (((g - b) / delta) % 6.0); }
          else if (mx == g) { hue = 60.0 * ((b - r) / delta + 2.0); }
          else { hue = 60.0 * ((r - g) / delta + 4.0); }
        }
        let bucket = hue_bucket(hue);
        let weight = sat * value;
        acc[bucket] = acc[bucket] + weight;
        acc[${HUE_BUCKETS}u + bucket] = acc[${HUE_BUCKETS}u + bucket] + sat * weight;
        acc[${HUE_BUCKETS * 2}u + bucket] = acc[${HUE_BUCKETS * 2}u + bucket] + value * weight;
      }
    }
    index = index + stride;
  }

  // Tree-reduce, one slot at a time, in a fixed order so the floating point
  // result is identical no matter which lane happened to run first.
  for (var slot = 0u; slot < ${SLOTS}u; slot = slot + 1u) {
    scratch[lid] = acc[slot];
    workgroupBarrier();
    var width = ${WORKGROUP}u / 2u;
    loop {
      if (width == 0u) { break; }
      if (lid < width) {
        scratch[lid] = scratch[lid] + scratch[lid + width];
      }
      workgroupBarrier();
      width = width / 2u;
    }
    if (lid == 0u) { result[slot] = scratch[0]; }
    workgroupBarrier();
  }
}
`;

  /* ------------------------------------------------------- device setup */

  let device = null;
  let pipeline = null;
  let bindGroupLayout = null;
  let ready = null;
  let failure = null;

  async function init() {
    if (ready) return ready;
    ready = (async () => {
      if (!navigator.gpu) throw new Error('navigator.gpu is unavailable');
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
      if (!adapter) throw new Error('no WebGPU adapter (software rendering or blocked)');
      device = await adapter.requestDevice();
      device.lost.then((info) => {
        failure = info.reason || 'device lost';
        window.dispatchEvent(new CustomEvent('nova-gpu-lost', { detail: { reason: failure } }));
      });
      const module = device.createShaderModule({ code: SHADER });
      if (module.getCompilationInfo) {
        const info = await module.getCompilationInfo();
        const errors = info.messages.filter((m) => m.type === 'error');
        if (errors.length) throw new Error(`shader: ${errors[0].message}`);
      }
      pipeline = device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
      bindGroupLayout = pipeline.getBindGroupLayout(0);
      return true;
    })().catch((error) => {
      failure = error.message;
      ready = null;
      return false;
    });
    return ready;
  }

  function available() {
    return !!device && !failure;
  }

  /**
   * Analyse an RGBA buffer on the GPU.
   *
   * Uploads the pixels as packed u32 (a straight memcpy when the source is
   * already RGBA and 4-byte aligned, which ImageData always is). Returns the
   * reduced slot vector, or null when the GPU path is unavailable so the
   * caller can fall back.
   */
  async function analyse(rgba, width, height, step) {
    if (!(await init()) || !available() || !width || !height) return null;

    const pixelCount = width * height;
    const packed = new Uint32Array(pixelCount);
    const aligned = rgba.byteOffset % 4 === 0 && rgba.byteLength >= pixelCount * 4;
    if (aligned) packed.set(new Uint32Array(rgba.buffer, rgba.byteOffset, pixelCount));
    else {
      for (let i = 0; i < pixelCount; i += 1) {
        packed[i] = rgba[i * 4] | (rgba[i * 4 + 1] << 8) | (rgba[i * 4 + 2] << 16) | (rgba[i * 4 + 3] << 24);
      }
    }

    const paramsBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([width, height, Math.max(1, step | 0), 0]));

    const storageSize = SLOTS_PADDED * 4;
    const resultBuffer = device.createBuffer({
      size: storageSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });
    const readBuffer = device.createBuffer({
      size: storageSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    // A Workgroup-sized bucket for pixels would exceed the per-binding limit
    // on large images, so the pixel buffer is its own binding with its own size.
    const pixelBuffer = device.createBuffer({
      size: Math.max(16, packed.byteLength),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(pixelBuffer, 0, packed);

    try {
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: paramsBuffer } },
          { binding: 1, resource: { buffer: pixelBuffer } },
          { binding: 2, resource: { buffer: resultBuffer } }
        ]
      }));
      pass.dispatchWorkgroups(1);
      pass.end();
      encoder.copyBufferToBuffer(resultBuffer, 0, readBuffer, 0, storageSize);
      device.queue.submit([encoder.finish()]);

      await readBuffer.mapAsync(GPUMapMode.READ);
      const slots = new Float32Array(readBuffer.getMappedRange().slice(0, SLOTS * 4));
      readBuffer.unmap();
      return slots;
    } finally {
      paramsBuffer.destroy();
      pixelBuffer.destroy();
      resultBuffer.destroy();
      readBuffer.destroy();
    }
  }

  window.NovaGPU = {
    init,
    available,
    analyse,
    HUE_BUCKETS,
    SLOTS,
    get failure() { return failure; }
  };
})();

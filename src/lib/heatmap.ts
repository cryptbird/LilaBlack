/**
 * Density heatmap over minimap UV space: bin points into a grid, Gaussian-blur it,
 * then colour it into an offscreen canvas that the map draws stretched over the minimap.
 */
export const HEAT_GRID = 192

export class HeatGrid {
  readonly values = new Float32Array(HEAT_GRID * HEAT_GRID)
  count = 0

  add(u: number, v: number) {
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return
    const gx = Math.floor(u * HEAT_GRID)
    const gy = Math.floor((1 - v) * HEAT_GRID) // image rows run top-down
    this.values[gy * HEAT_GRID + gx]++
    this.count++
  }
}

function gaussianKernel(sigma: number) {
  const r = Math.ceil(sigma * 3)
  const k: number[] = []
  let sum = 0
  for (let i = -r; i <= r; i++) {
    const w = Math.exp(-(i * i) / (2 * sigma * sigma))
    k.push(w)
    sum += w
  }
  return k.map((w) => w / sum)
}

function blur(src: Float32Array, n: number, sigma: number) {
  const k = gaussianKernel(sigma)
  const r = (k.length - 1) / 2
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let s = 0
      for (let i = -r; i <= r; i++) {
        const xx = x + i
        if (xx >= 0 && xx < n) s += src[y * n + xx] * k[i + r]
      }
      tmp[y * n + x] = s
    }
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let s = 0
      for (let i = -r; i <= r; i++) {
        const yy = y + i
        if (yy >= 0 && yy < n) s += tmp[yy * n + x] * k[i + r]
      }
      out[y * n + x] = s
    }
  return out
}

// Transparent -> deep blue -> cyan -> yellow -> red.
const STOPS: [number, [number, number, number, number]][] = [
  [0.0, [0, 0, 0, 0]],
  [0.12, [40, 60, 220, 0]],
  [0.25, [40, 80, 230, 120]],
  [0.4, [0, 220, 255, 170]],
  [0.7, [255, 230, 0, 210]],
  [1.0, [255, 30, 40, 235]],
]

const RAMP = (() => {
  const lut = new Uint8ClampedArray(256 * 4)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    let s = 0
    while (s < STOPS.length - 2 && t > STOPS[s + 1][0]) s++
    const [t0, c0] = STOPS[s]
    const [t1, c1] = STOPS[s + 1]
    const f = (t - t0) / (t1 - t0)
    for (let c = 0; c < 4; c++) lut[i * 4 + c] = c0[c] + (c1[c] - c0[c]) * f
  }
  return lut
})()

/** Sparse layers (kills, deaths) get a wider blur so single events stay visible. */
export function renderHeat(grid: HeatGrid, canvas: HTMLCanvasElement, sparse: boolean): number {
  const n = HEAT_GRID
  canvas.width = n
  canvas.height = n
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(n, n)
  if (grid.count === 0) {
    ctx.putImageData(img, 0, 0)
    return 0
  }
  const blurred = blur(grid.values, n, sparse ? 2.6 : 1.4)
  // Normalise to a high percentile rather than the max so one hotspot doesn't wash everything out.
  const nonZero = Array.from(blurred).filter((x) => x > 1e-4).sort((a, b) => a - b)
  const ref = nonZero[Math.floor(nonZero.length * 0.985)] || 1
  for (let i = 0; i < blurred.length; i++) {
    const t = Math.min(1, Math.sqrt(blurred[i] / ref))
    const li = Math.round(t * 255) * 4
    img.data.set(RAMP.subarray(li, li + 4), i * 4)
  }
  ctx.putImageData(img, 0, 0)
  return grid.count
}

export const HEAT_GRADIENT_CSS = `linear-gradient(90deg, ${STOPS.slice(1)
  .map(([t, [r, g, b]]) => `rgb(${r},${g},${b}) ${Math.round(t * 100)}%`)
  .join(', ')})`

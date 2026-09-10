// Color parsing/formatting for the theme settings. Kept out of the store and
// the picker component so it stays pure and testable without a DOM.

export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

const HEX_SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i
const HEX_LONG = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const RGB_FUNC = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function clampAlpha(value: number) {
  return Math.max(0, Math.min(1, value))
}

// `null` rather than a fallback color: callers decide what the default is.
export function parseColor(value: unknown): Rgba | null {
  if (typeof value !== 'string') {
    return null
  }

  const input = value.trim()

  const short = HEX_SHORT.exec(input)
  if (short) {
    const [, r, g, b] = short
    if (!r || !g || !b) {
      return null
    }

    return {
      r: Number.parseInt(r + r, 16),
      g: Number.parseInt(g + g, 16),
      b: Number.parseInt(b + b, 16),
      a: 1,
    }
  }

  const long = HEX_LONG.exec(input)
  if (long) {
    const [, r, g, b] = long
    if (!r || !g || !b) {
      return null
    }

    return {
      r: Number.parseInt(r, 16),
      g: Number.parseInt(g, 16),
      b: Number.parseInt(b, 16),
      a: 1,
    }
  }

  const func = RGB_FUNC.exec(input)
  if (func) {
    const [, r, g, b, a] = func
    if (!r || !g || !b) {
      return null
    }

    const channels = [Number(r), Number(g), Number(b)]
    if (channels.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 255)) {
      return null
    }

    const alpha = a === undefined ? 1 : Number(a)
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
      return null
    }

    return {
      r: clampChannel(channels[0] ?? 0),
      g: clampChannel(channels[1] ?? 0),
      b: clampChannel(channels[2] ?? 0),
      a: alpha,
    }
  }

  return null
}

// `<input type="color">` only speaks `#rrggbb`, so alpha is dropped here and
// carried separately by the picker.
export function toHex(color: Rgba): string {
  return `#${[color.r, color.g, color.b]
    .map((channel) => clampChannel(channel).toString(16).padStart(2, '0'))
    .join('')}`
}

export function formatColor(color: Rgba): string {
  const alpha = clampAlpha(color.a)

  if (alpha >= 1) {
    return toHex(color)
  }

  // Trim the float so round-tripping a slider value stays readable in CSS.
  const rounded = Math.round(alpha * 100) / 100
  return `rgba(${clampChannel(color.r)}, ${clampChannel(color.g)}, ${clampChannel(color.b)}, ${rounded})`
}

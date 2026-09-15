// Font family parsing/normalizing for the appearance settings. Kept out of the
// store and the picker component so it stays pure and testable without a DOM.

export const MAX_FONT_FAMILY_LENGTH = 200

// Generic families must stay unquoted: quoting one turns a CSS keyword into a
// family name no system has.
const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
])

// `-apple-system` and `BlinkMacSystemFont` are valid unquoted identifiers; a
// name carrying spaces or punctuation is not, and gets quoted below.
const CUSTOM_IDENT = /^-?[A-Za-z_][A-Za-z0-9_-]*$/

// A whitelist, not a blacklist. The value ends up in a CSS custom property that
// `font-family` consumes, so everything that could close the declaration or
// open a function or a comment (; { } ( ) \ / * @ < >) is rejected by omission.
const SAFE_CHARS = /^[\p{L}\p{N} '",._-]+$/u

const QUOTED = /^(["'])(.*)\1$/

function normalizePart(part: string): string | null {
  const trimmed = part.trim()
  const quoted = QUOTED.exec(trimmed)
  const name = (quoted?.[2] ?? trimmed).trim().replace(/\s+/g, ' ')

  // An empty part means a stray or doubled comma; a leftover quote means the
  // quoting was unbalanced.
  if (!name || name.includes('"') || name.includes("'")) {
    return null
  }

  if (GENERIC_FAMILIES.has(name.toLowerCase()) || CUSTOM_IDENT.test(name)) {
    return name
  }

  return `"${name}"`
}

// `null` rather than a fallback stack: callers decide what the default is, the
// same contract as parseColor. Normalizing (rather than storing verbatim) means
// a name typed with or without quotes round-trips through localStorage
// unchanged, and is always valid CSS however the operator typed it.
export function normalizeFontFamily(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const input = value.trim()

  if (!input || input.length > MAX_FONT_FAMILY_LENGTH || !SAFE_CHARS.test(input)) {
    return null
  }

  const parts: string[] = []

  for (const part of input.split(',')) {
    const normalized = normalizePart(part)

    if (!normalized) {
      return null
    }

    parts.push(normalized)
  }

  return parts.join(', ')
}

// Text that came from a file, a tool argument or a server, made safe to draw. Pure: no $.
// A Pane refuses a whole tree whose Text holds a control character (an escape, a bell, a form feed, a C1
// character), and bidi overrides or zero-width characters can show a name reversed or spoofed. Tab, line feed
// and carriage return stay.
const UNSAFE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F؜​-‏‪-‮⁦-⁩﻿]/g

export function clean(s: string): string {
  return s.replace(UNSAFE, '')
}

/** Every string inside a parsed JSON value, cleaned; depth-limited, so a deep value is cut rather than walked. */
export function cleanDeep(v: unknown, depth = 0): unknown {
  if (typeof v === 'string') return clean(v)
  if (depth > 8 || typeof v !== 'object' || v === null) return typeof v === 'object' ? null : v
  if (Array.isArray(v)) return v.map(x => cleanDeep(x, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [k, x] of Object.entries(v)) out[clean(k)] = cleanDeep(x, depth + 1)
  return out
}

// Layout and look choices: the only thing the suite keeps across sessions ($.store 'prefs').
// Pure: no $, no case data. Their one home is the desk's Customize view and the /comp-desk-layout and
// /comp-desk-look commands; /config holds only what must be known before the desk draws.
import type { Look, Preset, Prefs, Sections } from '../types'

type Bundled = Pick<Prefs, 'order' | 'sections' | 'band' | 'status' | 'notices' | 'cards'>
export type PresetName = Exclude<Preset, 'custom'>
export type PrefsChange = Partial<Omit<Prefs, 'v' | 'preset' | 'sections'>> & { sections?: Partial<Sections> }

export const PRESET_NAMES: readonly PresetName[] = ['desk', 'focus', 'figures', 'glance', 'quiet']
export const DENSITIES: readonly Prefs['density'][] = ['fit', 'comfortable', 'compact']
export const NAMES: readonly Prefs['names'][] = ['show', 'hide']
export const LOOKS: readonly Look[] = ['app', 'paper', 'paper-light', 'paper-night']
export const MOTIONS: readonly Prefs['motion'][] = ['subtle', 'off']
export const CARDS: readonly Prefs['cards'][] = ['full', 'compact', 'off']
export const GUARDS = ['sends', 'sends-and-writes', 'hub-only'] as const
export const OPEN_DESK = ['offer', 'on-hub-work', 'on-start'] as const

export const PRESETS: Record<PresetName, Bundled> = {
  desk:    { order: 'review-first',  sections: { review: true,  hearings: true,  figures: true,  connection: true,  next: true  }, band: true,  status: true,  notices: true,  cards: 'full'    },
  focus:   { order: 'review-first',  sections: { review: true,  hearings: true,  figures: false, connection: false, next: false }, band: true,  status: true,  notices: false, cards: 'compact' },
  figures: { order: 'figures-first', sections: { review: true,  hearings: true,  figures: true,  connection: true,  next: true  }, band: true,  status: true,  notices: true,  cards: 'full'    },
  glance:  { order: 'review-first',  sections: { review: false, hearings: false, figures: false, connection: false, next: false }, band: false, status: true,  notices: false, cards: 'compact' },
  quiet:   { order: 'review-first',  sections: { review: true,  hearings: true,  figures: true,  connection: false, next: true  }, band: false, status: false, notices: false, cards: 'compact' },
}

export function opt<T extends string>(v: unknown, allowed: readonly T[], d: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : d
}

function bundledOf(name: PresetName): Bundled {
  const b = PRESETS[name]
  return { order: b.order, sections: { ...b.sections }, band: b.band, status: b.status, notices: b.notices, cards: b.cards }
}

/** The desk's starting choices: the Desk layout, fit to width, names shown, the app's own look. */
export function freshPrefs(): Prefs {
  return { v: 1, preset: 'desk', ...bundledOf('desk'), density: 'fit', names: 'show', look: 'app', serif: true, motion: 'subtle' }
}

export const DEFAULT_PREFS: Prefs = freshPrefs()

const SECTION_KEYS = ['review', 'hearings', 'figures', 'connection', 'next'] as const
const PRESETS_ALL: readonly Preset[] = [...PRESET_NAMES, 'custom']

/** A stored value back as Prefs, or null when anything in it is not a known value. Extra keys are dropped. */
export function cleanStoredPrefs(raw: unknown): Prefs | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (r.v !== 1) return null
  const sec = r.sections
  if (typeof sec !== 'object' || sec === null) return null
  const sr = sec as Record<string, unknown>
  if (!SECTION_KEYS.every(k => typeof sr[k] === 'boolean')) return null
  const isIn = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === 'string' && (list as readonly string[]).includes(v)
  if (!isIn(r.preset, PRESETS_ALL) || !isIn(r.order, ['review-first', 'figures-first'] as const) || !isIn(r.cards, CARDS)
    || !isIn(r.density, DENSITIES) || !isIn(r.names, NAMES) || !isIn(r.look, LOOKS) || !isIn(r.motion, MOTIONS)) return null
  if (typeof r.band !== 'boolean' || typeof r.status !== 'boolean' || typeof r.notices !== 'boolean' || typeof r.serif !== 'boolean') return null
  return {
    v: 1, preset: r.preset, order: r.order,
    sections: { review: sr.review as boolean, hearings: sr.hearings as boolean, figures: sr.figures as boolean, connection: sr.connection as boolean, next: sr.next as boolean },
    band: r.band, status: r.status, notices: r.notices, cards: r.cards, density: r.density, names: r.names, look: r.look, serif: r.serif, motion: r.motion,
  }
}

export function applyPreset(p: Prefs, name: PresetName): Prefs {
  return { ...p, preset: name, ...bundledOf(name) }
}

function sameBundle(p: Prefs, b: Bundled): boolean {
  return p.order === b.order && p.band === b.band && p.status === b.status && p.notices === b.notices && p.cards === b.cards
    && SECTION_KEYS.every(k => p.sections[k] === b.sections[k])
}

export function matchPreset(p: Prefs): PresetName | null {
  return PRESET_NAMES.find(name => sameBundle(p, PRESETS[name])) ?? null
}

export function toggle(p: Prefs, change: PrefsChange): Prefs {
  const next: Prefs = { ...p, ...change, sections: { ...p.sections, ...(change.sections ?? {}) } }
  const touchesBundle = ['order', 'sections', 'band', 'status', 'notices', 'cards'].some(k => k in change)
  return touchesBundle ? { ...next, preset: matchPreset(next) ?? 'custom' } : next
}

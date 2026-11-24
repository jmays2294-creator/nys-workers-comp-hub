// Counting a hearing checklist from the text Claude wrote, edited or read in this session.
// The layout is skills/hearing-prep-checklist/references/checklist-format.md. Pure: no $.
import type { ChecklistCounts, HearingRow } from '../types'
import { clean } from './clean'

const CHECKLIST_FILE = /(^|\/)hearing-checklist-(\d{4}-\d{2}-\d{2})(?:-v(\d+))?\.md$/
const TITLE = /^# Hearing checklist: (.+)$/
const HEARING = /^## (\d+)\. (.+)$/
const H2 = /^## /
const H3 = /^### (.+)$/
const OPEN = /^- \[ \] /
const DONE = /^- \[[xX]\] /
const BULLET = /^- /
const RULE_VERIFY = /^ {2}- Rule: .*\(verify\)\s*$/
// A bullet that says the section has nothing (the example's "- None found."): not a conflict, not a gap.
const NONE_LINE = /^- (?:None found|None|Nothing found)\.?\s*$/i
const ODD = '## Odd text in the files (not followed)'
const VERIFIED = /^>?\s*Verified by:(.*)$/
const LINE_NUMBER = /^\s*\d+[\t→]/

export function isChecklistPath(p: string): boolean {
  return CHECKLIST_FILE.test(p)
}

export function checklistBase(p: string): { base: string; version: number } | null {
  const m = CHECKLIST_FILE.exec(p)
  if (m === null || m[2] === undefined) return null
  const v = m[3] === undefined ? 1 : Number(m[3])
  return { base: m[2], version: Number.isFinite(v) && v > 0 ? v : 1 }
}

/** Drops the Read tool's line-number prefixes, when most non-empty lines carry one. */
export function stripLineNumbers(text: string): string {
  const lines = text.split(/\r?\n/)
  const full = lines.filter(l => l.trim() !== '')
  const numbered = full.filter(l => LINE_NUMBER.test(l)).length
  if (full.length === 0 || numbered * 2 < full.length) return text
  return lines.map(l => l.replace(LINE_NUMBER, '')).join('\n')
}

/** The Edit tool's replacement, replayed on the original text it reported. */
export function applyEdit(original: string, oldString: string, newString: string, replaceAll: boolean): string {
  if (oldString === '') return original
  return replaceAll ? original.split(oldString).join(newString) : original.replace(oldString, () => newString)
}

type Bucket = 'items' | 'conflicts' | 'notFound' | null

export function parseChecklist(text: string): ChecklistCounts {
  const lines = text.split(/\r?\n/)
  let dateLine: string | null = null
  const rows: HearingRow[] = []
  let current: HearingRow | null = null
  let bucket: Bucket = null
  let isPastHearings = false
  let isOdd = false
  let item: { isOpen: boolean; isVerify: boolean } | null = null
  let conflicts = 0
  let notFound = 0
  let odd = 0
  let signed: ChecklistCounts['signed'] = 'unknown'
  let isSignedSeen = false

  const closeItem = (): void => {
    if (item !== null && current !== null && item.isOpen && item.isVerify) current.verify += 1
    item = null
  }

  for (const line of lines) {
    if (!isSignedSeen) {
      const v = VERIFIED.exec(line)
      if (v !== null) {
        isSignedSeen = true
        signed = /_{3,}/.test(v[1] ?? '') ? 'no' : 'yes'
      }
    }
    if (dateLine === null) {
      const t = TITLE.exec(line)
      if (t !== null && t[1] !== undefined) { dateLine = clean(t[1]); continue }
    }
    const h = isPastHearings ? null : HEARING.exec(line)
    if (h !== null && h[1] !== undefined && h[2] !== undefined) {
      closeItem()
      const parts = clean(h[2]).split(' · ')
      current = { n: Number(h[1]), who: parts[0] ?? '', wcb: parts[1] ?? '', when: parts[2] ?? '', purpose: parts.slice(3).join(' · '), open: 0, verify: 0, done: 0 }
      rows.push(current)
      bucket = null
      continue
    }
    if (H2.test(line)) {
      closeItem()
      isPastHearings = true
      current = null
      bucket = null
      isOdd = line.trim() === ODD
      continue
    }
    if (isOdd) {
      if (BULLET.test(line)) odd += 1
      continue
    }
    if (current === null) continue
    const h3 = H3.exec(line)
    if (h3 !== null) {
      closeItem()
      const name = (h3[1] ?? '').trim()
      bucket = name === 'Conflicts to resolve' ? 'conflicts' : name === 'Not found in the files' ? 'notFound' : 'items'
      continue
    }
    if (bucket === 'conflicts' || bucket === 'notFound') {
      if (BULLET.test(line) && !NONE_LINE.test(line)) {
        if (bucket === 'conflicts') conflicts += 1
        else notFound += 1
      }
      continue
    }
    if (bucket !== 'items') continue
    if (line.trim() === '' || line.startsWith('#') || BULLET.test(line)) closeItem()
    if (OPEN.test(line)) { current.open += 1; item = { isOpen: true, isVerify: false }; continue }
    if (DONE.test(line)) { current.done += 1; item = { isOpen: false, isVerify: false }; continue }
    if (item !== null && RULE_VERIFY.test(line)) item.isVerify = true
  }
  closeItem()

  const sum = (k: 'open' | 'verify' | 'done'): number => rows.reduce((a, r) => a + r[k], 0)
  return {
    dateLine, hearings: rows.slice(0, 12), hearingCount: rows.length,
    open: sum('open'), done: sum('done'), verify: sum('verify'), conflicts, notFound, odd, signed,
  }
}

// ---- order on the desk ------------------------------------------------------------------------------------

const WHEN_DATE_US = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/
const WHEN_DATE_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/
const WHEN_TIME = /\b(\d{1,2}):(\d{2})\s*([AaPp])?\.?\s*[Mm]?\.?(?![0-9])/

/** A sortable number for a hearing's date and time as written, or null when neither can be read. Ordering only. */
export function whenKey(when: string): number | null {
  const us = WHEN_DATE_US.exec(when)
  const iso = us === null ? WHEN_DATE_ISO.exec(when) : null
  const day = us !== null ? Number(us[3]) * 10_000 + Number(us[1]) * 100 + Number(us[2])
    : iso !== null ? Number(iso[1]) * 10_000 + Number(iso[2]) * 100 + Number(iso[3]) : null
  const t = WHEN_TIME.exec(when)
  let minutes: number | null = null
  if (t !== null) {
    let h = Number(t[1]) % 24
    const half = (t[3] ?? '').toLowerCase()
    if (half === 'p' && h < 12) h += 12
    if (half === 'a' && h === 12) h = 0
    minutes = h * 60 + Number(t[2])
  }
  if (day === null && minutes === null) return null
  return (day ?? 0) * 10_000 + (minutes ?? 0)
}

/** A checklist's hearings in time order, each value as written; ones whose time cannot be read keep their place after. */
export function hearingOrder(rows: readonly HearingRow[]): HearingRow[] {
  const keyed = rows.map((r, i) => ({ r, i, k: whenKey(r.when) }))
  return keyed.sort((a, b) => (a.k ?? Infinity) - (b.k ?? Infinity) || a.i - b.i).map(x => x.r)
}

/** The local calendar day of a clock reading, as a checklist file names it: YYYY-MM-DD. */
export function localDay(now: number): string {
  const d = new Date(now)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

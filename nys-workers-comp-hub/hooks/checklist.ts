// Counting a hearing checklist from the text Claude wrote, edited or read in this session.
// The layout is skills/hearing-prep-checklist/references/checklist-format.md. Pure: no $.
import type { ChecklistCounts, HearingRow } from '../types'

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
      if (t !== null && t[1] !== undefined) { dateLine = t[1]; continue }
    }
    const h = isPastHearings ? null : HEARING.exec(line)
    if (h !== null && h[1] !== undefined && h[2] !== undefined) {
      closeItem()
      const parts = h[2].split(' · ')
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

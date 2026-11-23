// Which files and email drafts land on the desk, and the numbers the desk, band and status line show.
// Pure: no $.
import type { Draft, Figure } from '../types'

// The runtime twin of register.tsx's DOC_PATH matcher (that one stays matcher-only).
const DOC_FILE = /\.(?:md|markdown|txt|docx|doc|rtf|odt|html|htm|eml)$/i
const EXCLUDED_DIRS = ['/.claude/', '/node_modules/', '/.git/']
const EXCLUDED_NAMES = new Set(['CLAUDE.md', 'README.md', 'CHANGELOG.md', 'SKILL.md', 'MEMORY.md', 'LICENSE.md'])
const DRAFT_MARKER = /DRAFT for the attorney's review\.|Drafts only: the attorney reviews and signs everything|Anything drafted with these tools is a draft/

export const DRAFTING_SKILLS: ReadonlySet<string> = new Set([
  'hearing-prep-checklist', 'hearing-prep', 'explain-benefit-to-client', 'wc-appeals-rebuttals-summations',
  'wc-hearing-prep-calendar', 'wc-outreach-admin', 'wc-settlement-offers',
])

export const MAX_PARSE = 400_000

export function baseName(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i < 0 ? p : p.slice(i + 1)
}

export function extOf(p: string): string {
  const b = baseName(p)
  const i = b.lastIndexOf('.')
  return i <= 0 ? '' : b.slice(i + 1).toLowerCase()
}

export function isDocPath(p: string): boolean {
  return DOC_FILE.test(p)
}

export function isExcludedPath(p: string): boolean {
  const norm = p.replace(/\\/g, '/')
  return EXCLUDED_DIRS.some(d => norm.includes(d)) || EXCLUDED_NAMES.has(baseName(norm))
}

export function hasDraftMarker(text: string): boolean {
  const head = text.slice(0, 4000)
  const tail = text.length > 4000 ? text.slice(-4000) : ''
  return DRAFT_MARKER.test(head) || DRAFT_MARKER.test(tail)
}

export function skillKey(skill: string): string {
  return skill.slice(skill.lastIndexOf(':') + 1)
}

/** For each checklist date, the draft written last (a -v2 replaces v1 for the counts). Newest first. */
export function latestChecklists(drafts: readonly Draft[]): Draft[] {
  const byBase = new Map<string, Draft>()
  for (const d of drafts) {
    if (d.kind !== 'checklist' || d.base === null) continue
    const had = byBase.get(d.base)
    if (had === undefined || d.order > had.order) byBase.set(d.base, d)
  }
  return [...byBase.values()].sort((a, b) => b.order - a.order)
}

export type DeskNumbers = { review: number; verify: number; hearings: number; figuresDone: number; checklistsToVerify: number }

export function deskNumbers(drafts: readonly Draft[], figures: readonly Figure[]): DeskNumbers {
  const latest = latestChecklists(drafts)
  return {
    review: drafts.filter(d => d.review === 'waiting').length,
    verify: latest.reduce((a, d) => a + (d.checklist?.verify ?? 0), 0),
    hearings: latest.reduce((a, d) => a + (d.checklist?.hearingCount ?? 0), 0),
    figuresDone: figures.filter(f => f.status === 'done').length,
    checklistsToVerify: latest.filter(d => (d.checklist?.verify ?? 0) > 0).length,
  }
}

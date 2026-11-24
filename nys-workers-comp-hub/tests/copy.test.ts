import { expect, test } from 'claude-code/testing'
import type { ChecklistCounts, Prefs } from '../types'
import { COPY, DISPLAY_LABELS, INPUT_LABELS, SKILL_LABELS, TITLES } from '../hooks/copy'
import { DEFAULT_PREFS } from '../hooks/prefs'

const COUNTS: ChecklistCounts = { dateLine: 'Thursday, December 3, 2026', hearings: [], hearingCount: 2, open: 21, done: 1, verify: 8, conflicts: 1, notFound: 6, odd: 1, signed: 'no' }
const P: Prefs = { ...DEFAULT_PREFS, sections: { review: true, hearings: false, figures: true, connection: false, next: true } }
const PAIRS = [{ label: 'AWW', value: '1200' }, { label: 'Date of accident', value: '2024-03-15' }]

// One sample call for every function in COPY; the test fails if a new function is added without one.
const SAMPLES: Record<string, () => unknown> = {
  headline: () => [COPY.headline(0, 0, 0, 0), COPY.headline(0, 0, 1, 0), COPY.headline(1, 8, 1, 2), COPY.headline(2, 0, 0, 1), COPY.headline(0, 1, 0, 1)],
  gOldest: () => COPY.gOldest('4 min ago'), gToday: () => COPY.gToday('12/03/2026 9:30 AM'), todayLine: () => COPY.todayLine('Thursday, December 3, 2026'), gInLists: () => [COPY.gInLists(1), COPY.gInLists(2)], gNewest: () => COPY.gNewest('just now'), gFirst: () => COPY.gFirst('12/03/2026 9:30 AM'),
  glanceLine: () => [COPY.glanceLine(1, 8, 0, 2), COPY.glanceLine(0, 0, 1, 1)], more: () => COPY.more(6, 9),
  minutesAgo: () => COPY.minutesAgo(4), hoursAgo: () => [COPY.hoursAgo(1), COPY.hoursAgo(3)], daysAgo: () => [COPY.daysAgo(1), COPY.daysAgo(2)],
  maskedDraft: () => [COPY.maskedDraft(1, 'md'), COPY.maskedDraft(2, '')], maskedEmail: () => COPY.maskedEmail(1),
  checklistLine: () => [COPY.checklistLine(COUNTS), COPY.checklistLine({ ...COUNTS, signed: 'yes', conflicts: 0, notFound: 0 })],
  originWrite: () => COPY.originWrite('just now'), originEdit: () => COPY.originEdit('just now'), originRead: () => COPY.originRead('just now'), originConnector: () => COPY.originConnector('just now'),
  withSkill: () => COPY.withSkill('Settlement and offer responses'), reviewedLine: () => COPY.reviewedLine('just now'), moreReviewed: () => [COPY.moreReviewed(1), COPY.moreReviewed(3)],
  notesLine: () => [COPY.notesLine(3, 1), COPY.notesLine(1, 0), COPY.notesLine(0, 2)], importsReview: () => [COPY.importsReview(1), COPY.importsReview(2)],
  reviewEmpty: () => [COPY.reviewEmpty('sends'), COPY.reviewEmpty('hub-only')],
  hearingMasked: () => COPY.hearingMasked(1), hearingCounts: () => [COPY.hearingCounts(0, 0, 3), COPY.hearingCounts(10, 5, 1)], hearingsFrom: () => COPY.hearingsFrom('hearing-checklist-2026-12-03.md'),
  inputsLine: () => COPY.inputsLine(PAIRS), missingLine: () => COPY.missingLine(['AWW']), problemsLine: () => COPY.problemsLine(['Date of accident']),
  showAll: () => COPY.showAll(12), stepLine: () => COPY.stepLine('8. Award', 'the Hub display'), citationLine: () => COPY.citationLine({ name: 'SLU award (weeks)', citation: 'the cited section', status: 'Citation not yet attorney-reviewed.' }),
  hubListed: () => [COPY.hubListed(1), COPY.hubListed(32)], hubAnswered: () => COPY.hubAnswered('just now'), hubProblem: () => COPY.hubProblem('Too many requests right now.'),
  wsSignedIn: () => COPY.wsSignedIn('just now'),
  sentLine: () => [COPY.sentLine({ queued: 2, waiting: 1, inWorkspace: 1, refused: 1 }), COPY.sentLine({ queued: 0, waiting: 0, inWorkspace: 0, refused: 0 })],
  importLine: () => [COPY.importLine({ imported: 1, queued: 1, needsReview: 1, rejected: 1, notFound: 1 }), COPY.importLine({ imported: 0, queued: 0, needsReview: 0, rejected: 0, notFound: 0 })],
  notesWaiting: () => COPY.notesWaiting(3), sendsLine: () => [COPY.sendsLine('sends'), COPY.sendsLine('sends-and-writes'), COPY.sendsLine('hub-only')],
  fillVerify: () => COPY.fillVerify('hearing-checklist-2026-12-03.md'), fillRecount: () => COPY.fillRecount('hearing-checklist-2026-12-03.md'),
  fillSummarize: () => COPY.fillSummarize('letter.md'), fillHearingOpen: () => COPY.fillHearingOpen(1, 'hearing-checklist-2026-12-03.md'),
  fillAskFigure: () => [COPY.fillAskFigure('Schedule loss of use award'), COPY.fillAskFigure('Section 32 split')], fillMissing: () => COPY.fillMissing('Weekly benefit rate', ['AWW']),
  fillForm: () => COPY.fillForm('C-4.3'), fillDefine: () => COPY.fillDefine('AWW'),
  now: () => COPY.now('Desk'), shownHidden: () => [COPY.shownHidden('Hearings', true), COPY.shownHidden('Hearings', false)], onOff: () => [COPY.onOff('Status line', true), COPY.onOff('Status line', false)],
  cardCompact: () => COPY.cardCompact('Schedule loss of use award', 'Award', 'the Hub display'), cardRefused: () => COPY.cardRefused('Weekly benefit rate'),
  formulaLine: () => COPY.formulaLine('SLU award (weeks)', 'the cited section', 'Citation not yet attorney-reviewed.'),
  bandRefused: () => [COPY.bandRefused('Weekly benefit rate', ['AWW'], []), COPY.bandRefused('Weekly benefit rate', [], ['Date of accident'])], bandProblem: () => COPY.bandProblem('Too many requests right now.'),
  bandNeeds: () => [COPY.bandNeeds(1, 8), COPY.bandNeeds(2, 0)], bandNeedsShort: () => COPY.bandNeedsShort(1, 8),
  status: () => [COPY.status(0, 0, 0), COPY.status(0, 0, 1), COPY.status(0, 0, 2), COPY.status(1, 8, 1)],
  toastChecklist: () => COPY.toastChecklist(21, 8), toastSent: () => [COPY.toastSent(2, 0), COPY.toastSent(2, 1)],
  layoutList: () => COPY.layoutList(P), layoutDone: () => [COPY.layoutDone(P), COPY.layoutDone(DEFAULT_PREFS)], lookList: () => COPY.lookList(P),
  lookSet: () => (['app', 'paper', 'paper-light', 'paper-night'] as const).map(x => COPY.lookSet(x)),
  guardSend: () => COPY.guardSend('send_message'), guardWrite: () => COPY.guardWrite('create_record'), guardStraightOut: () => COPY.guardStraightOut('send_message'),
  menuForm: () => COPY.menuForm('C-4.3'), menuRate: () => COPY.menuRate('03/15/2024'),
}

function strings(v: unknown, out: string[]): string[] {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) for (const x of v) strings(x, out)
  else if (typeof v === 'object' && v !== null) for (const x of Object.values(v)) strings(x, out)
  return out
}

const ALLOWED_COMP = /The Comp Desk|Comp Desk|\/comp-desk[a-z-]*|nys-workers-comp-hub|https?:\/\/\S+/g
// Spelled in pieces so this file never holds the word itself.
const SCAN_TRAP = new RegExp(['p', 'a', 's', 's'].join(''), 'i')
const BANNED = /\b(expert|specialist|best|top|referral|referrals|refer|refers|referred|guarantee|guaranteed|guarantees|likely|instantly|unlock|magic)\b|will award|you should|AI-powered/i

function problems(s: string): string[] {
  const out: string[] = []
  if (/\bcomp\b/i.test(s.replace(ALLOWED_COMP, ''))) out.push('bare short word for workers\' compensation')
  if (BANNED.test(s)) out.push('banned word')
  if (/advice/i.test(s.replace(/not legal advice|nothing here is legal advice/gi, ''))) out.push('advice')
  if (SCAN_TRAP.test(s)) out.push('the four-letter word the credential scan misreads')
  if (s.includes('!')) out.push('exclamation mark')
  if (/\p{Extended_Pictographic}/u.test(s)) out.push('emoji')
  if (/\$\s?\d/.test(s)) out.push('money figure')
  if (/\b(NY|NYS|WC)\b/.test(s)) out.push('abbreviation')
  if (/[‘’“”]/.test(s)) out.push('curly quote')
  return out
}

test('76. every word the suite writes follows the copy rules', () => {
  const fnKeys = Object.entries(COPY).filter(([, v]) => typeof v === 'function').map(([k]) => k).sort()
  expect(fnKeys).toEqual(Object.keys(SAMPLES).sort())
  const all = [
    ...strings(Object.values(COPY).filter(v => typeof v !== 'function'), []),
    ...strings(Object.values(SAMPLES).map(f => f()), []),
    ...strings([TITLES, DISPLAY_LABELS, INPUT_LABELS, SKILL_LABELS], []),
  ]
  expect(all.length).toBeGreaterThan(300)
  for (const s of all) expect([s, problems(s)]).toEqual([s, []])
})

test('77. the disclaimer, exactly, and the conventions end with it', () => {
  expect(COPY.disclaimer).toBe('The Comp Desk is a software platform, not a law firm.')
  expect(COPY.conventions.endsWith('The Comp Desk is a software platform, not a law firm.')).toBe(true)
  expect(COPY.conventions.split('\n')).toHaveLength(8)
  expect(COPY.deskHelp.endsWith(COPY.disclaimer)).toBe(true)
})

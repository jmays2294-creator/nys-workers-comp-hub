// Final review fixes (F1-F6): escapes only in source, a draft word never hides a send, an organization's settings
// hook keeps its own rules, deploys and posts by name, reads about a send, and a hearings list that only counts
// hearings. F1-F3, F5 and F6 failed on 5356851; F4 pins the straight-out test that the guard's failure path now
// shares with its main path. Fictional data only.
// The whole-file check for format characters runs outside the kit, which reads no files:
// node tools/check-format-chars.mjs nys-workers-comp-hub (from the repository root).
import { expect, test } from 'claude-code/testing'
import * as actions from '../hooks/actions'
import * as band from '../hooks/band'
import * as cards from '../hooks/cards'
import * as checklist from '../hooks/checklist'
import * as cleanModule from '../hooks/clean'
import * as copy from '../hooks/copy'
import * as desk from '../hooks/desk'
import * as drafts from '../hooks/drafts'
import * as hub from '../hooks/hub'
import * as menu from '../hooks/menu'
import * as prefs from '../hooks/prefs'
import * as sends from '../hooks/sends'
import * as theme from '../hooks/theme.gen'
import { clean, UNSAFE } from '../hooks/clean'
import { COPY } from '../hooks/copy'
import { DEFAULT_PREFS } from '../hooks/prefs'
import { classify, guardVerdict, hookOwnerOf, isStraightOut } from '../hooks/sends'
import { engine, HUB, PANE, START, SURFACES } from './engine'
import { CHECKLIST } from './fixtures'

const TAB = String.fromCharCode(9)
const LF = String.fromCharCode(10)
const CR = String.fromCharCode(13)
const at = (n: number): string => String.fromCodePoint(n)
const hex = (n: number): string => `U+${n.toString(16).toUpperCase().padStart(4, '0')}`
const isOdd = (c: string): boolean => /\p{Cf}/u.test(c) || (/\p{Cc}/u.test(c) && c !== TAB && c !== LF)
// The bidi controls and zero-width characters clean() removes, by code point.
const INVISIBLE = [0x061C, 0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0x202A, 0x202B, 0x202C, 0x202D, 0x202E, 0x2066, 0x2067, 0x2068, 0x2069, 0xFEFF]

test('F1. the hooks write invisible characters as escapes, and clean() still removes each one', () => {
  expect([...UNSAFE.source].filter(c => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) > 0x7e).map(c => hex(c.charCodeAt(0)))).toEqual([])
  for (const n of INVISIBLE) expect([hex(n), clean(`a${at(n)}b`)]).toEqual([hex(n), 'ab'])
  for (const n of [0x00, 0x07, 0x0c, 0x1b, 0x7f, 0x9b]) expect([hex(n), clean(`a${at(n)}b`)]).toEqual([hex(n), 'ab'])
  const kept = `a${TAB}b${LF}c${CR}d`
  expect(clean(kept)).toBe(kept)

  // Every pattern and string the hooks modules export: no format character, no control character but tab and line feed.
  const modules = { actions, band, cards, checklist, cleanModule, copy, desk, drafts, hub, menu, prefs, sends, theme }
  const found: string[] = []
  const walk = (where: string, v: unknown, depth: number): void => {
    if (depth > 6) return
    if (v instanceof RegExp) { for (const c of v.source) if (isOdd(c)) found.push(`${where} ${hex(c.charCodeAt(0))}`); return }
    if (typeof v === 'string') { for (const c of v) if (isOdd(c)) found.push(`${where} ${hex(c.codePointAt(0) ?? 0)}`); return }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(`${where}[${i}]`, x, depth + 1)); return }
    if (v instanceof Set || v instanceof Map) { [...v.entries()].forEach((x, i) => walk(`${where}{${i}}`, x, depth + 1)); return }
    if (typeof v === 'object' && v !== null) for (const [k, x] of Object.entries(v)) walk(`${where}.${k}`, x, depth + 1)
  }
  for (const [name, m] of Object.entries(modules)) walk(name, m, 0)
  expect(found).toEqual([])
})

test('F2. a draft word never hides a send verb after it, nor a send after "and"; a reply or post after "draft" is a noun', () => {
  for (const tool of ['mcp__x__drafts_send', 'mcp__x__draft_and_send', 'mcp__x__draftSend', 'mcp__x__save_and_send_draft', 'mcp__x__draft_send_email',
    'mcp__x__draft_reply_send', 'mcp__x__send_message_draft', 'mcp__composio__GMAIL_SEND_DRAFT', 'mcp__x__create_draft_and_send', 'mcp__x__draft_submit']) {
    expect([tool, classify(tool)]).toEqual([tool, 'send'])
  }
  for (const tool of ['mcp__x__draft_reply', 'mcp__x__draft_post', 'mcp__x__draft_forward', 'mcp__outlook__create_reply_draft',
    'mcp__claude_ai_Slack__slack_send_message_draft', 'mcp__claude_ai_Gmail__create_draft', 'mcp__claude_ai_Gmail__update_draft', 'mcp__ms365__create-draft-email']) {
    expect([tool, classify(tool)]).toEqual([tool, 'draft'])
  }
})

test("F3. a settings hook's own send: the organization's hook keeps the verdict beneath; a person's, or one of unknown owner, is refused", () => {
  for (const kind of ['send', 'hub-write'] as const) {
    expect([kind, guardVerdict(kind, 'sends', false, true, 'organization')]).toEqual([kind, 'beneath'])
    expect([kind, guardVerdict(kind, 'sends', false, true, 'person')]).toEqual([kind, 'deny'])
    expect([kind, guardVerdict(kind, 'sends', false, true, 'unknown')]).toEqual([kind, 'deny'])
    expect([kind, guardVerdict(kind, 'sends', false, true, undefined)]).toEqual([kind, 'deny'])
    expect([kind, guardVerdict(kind, 'sends', false, false, 'organization')]).toEqual([kind, 'ask'])
    expect([kind, guardVerdict(kind, 'sends', false, false, 'person')]).toEqual([kind, 'ask'])
  }
  expect(guardVerdict('write', 'sends-and-writes', true, true, 'organization')).toBe('beneath')
  expect(guardVerdict('write', 'sends-and-writes', true, true, 'person')).toBe('ask')
  expect(guardVerdict('send', 'hub-only', false, true, 'person')).toBe('beneath')
  expect(guardVerdict('other', 'sends', true, true, 'person')).toBe('beneath')
  expect(hookOwnerOf({ hookOwner: 'person' })).toBe('person')
  expect(hookOwnerOf({ hookOwner: 'unknown' })).toBe('unknown')
  expect(hookOwnerOf({ hookOwner: 'organization' })).toBe('organization')
  expect(hookOwnerOf({ isOrganizations: true })).toBe('organization')
  expect(hookOwnerOf({})).toBeUndefined()
  expect(COPY.guardStraightOut('slack_send_message')).toMatch(/nobody here to approve it/)
})

test('F4. a call goes straight out only when a settings hook makes it with no call id and no approver', () => {
  expect(isStraightOut({}, { plugin: 'hook:Stop' })).toBe(true)
  expect(isStraightOut({}, { plugin: 'hook:PreToolUse' })).toBe(true)
  expect(isStraightOut({ tool_use_id: 't1' }, { plugin: 'hook:Stop' })).toBe(false)
  expect(isStraightOut({ approver: 'person' }, { plugin: 'hook:Stop' })).toBe(false)
  expect(isStraightOut({ approver: 'host' }, { plugin: 'hook:Stop' })).toBe(false)
  expect(isStraightOut({}, { plugin: 'engine' })).toBe(false)
  expect(isStraightOut({}, { plugin: 'nys-workers-comp-hub' })).toBe(false)
  // The failure path answers from the same facts: with isHubWork assumed, a straight-out send is still refused there.
  expect(guardVerdict(classify('mcp__slack__slack_send_message'), 'sends', true, isStraightOut({}, { plugin: 'hook:Stop' }), undefined)).toBe('deny')
})

// Real names from the Vercel, GitHub and Higgsfield connectors, and reads about a send.
const DEPLOYS_AND_POSTS = [
  'mcp__Vercel__create_deployment', 'mcp__Vercel__request_promote', 'mcp__Vercel__request_rollback', 'mcp__Vercel__start_rolling_release',
  'mcp__Vercel__approve_rolling_release_stage', 'mcp__Vercel__complete_rolling_release', 'mcp__Vercel__start_board_thread',
  'mcp__github__issue_write', 'mcp__github__pull_request_review_write', 'mcp__github__create_release', 'mcp__github__create_issue',
  'mcp__Higgsfield__confirm_project_publication_review', 'mcp__Higgsfield__deploy_website', 'mcp__mastodon__post_status',
  'mcp__x__send_logs', 'mcp__x__send_status', 'mcp__x__send_preview', 'mcp__x__send_history', 'mcp__x__send_and_get_status', 'mcp__x__prepare_and_send',
]
const LEFT_ALONE = [
  'mcp__Vercel__get_deployment', 'mcp__Vercel__list_deployments', 'mcp__Vercel__cancel_deployment', 'mcp__Vercel__get_rolling_release',
  'mcp__Vercel__update_rolling_release_config', 'mcp__Vercel__list_promote_aliases', 'mcp__Vercel__get_board_thread', 'mcp__Vercel__list_board_threads',
  'mcp__Vercel__open_deployments', 'mcp__github__issue_read', 'mcp__github__list_releases', 'mcp__github__get_latest_release',
  'mcp__github__resolve_review_thread', 'mcp__Higgsfield__get_project_publication', 'mcp__Higgsfield__cancel_project_publication_review',
  'mcp__Higgsfield__tiktok_publish_status', 'mcp__Higgsfield__tiktok_prepare_publish', 'mcp__x__push_status', 'mcp__x__deploy_logs',
]

test('F5. deploys, releases, new threads, issues and reviews ask; reads about them keep the verdict beneath; the copy says "named"', async ($, on) => {
  engine(on)
  on('tool.check', () => ({ decision: 'allow' }))
  for (const tool of DEPLOYS_AND_POSTS) expect([tool, (await $.tool.check({ tool, input: {} })).decision]).toEqual([tool, 'ask'])
  for (const tool of LEFT_ALONE) expect([tool, (await $.tool.check({ tool, input: {} })).decision]).toEqual([tool, 'allow'])
  expect(COPY.reviewEmpty('sends')).toContain('Before a connector tool named as a send (an email, a message, a post) runs, you approve it yourself.')
  expect(COPY.reviewEmpty('sends-and-writes').join(' ')).toMatch(/named as a send/)
})

const NO_HEARINGS = [
  "# Hearing checklist: a firm's own format (DEMO)",
  '',
  'FICTIONAL EXAMPLE. No numbered hearing headings here.',
  '- [ ] An item for the attorney to check',
  '',
].join(LF)

test('F6. checklists with no hearings in them add no rows to Hearings: one Recount for the one list of hearings', async ($, on) => {
  engine(on, { store: { prefs: { ...DEFAULT_PREFS, density: 'comfortable' } } })
  await $.session.start(START)
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: '/x/hearing-checklist-2026-12-01.md', content: CHECKLIST })
  for (let i = 2; i <= 30; i += 1) {
    await $.tool.call({ tool: 'Write', tool_use_id: `w${i}`, file_path: `/x/hearing-checklist-2026-12-${String(i).padStart(2, '0')}.md`, content: NO_HEARINGS })
  }
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: { ...PANE, bodyColumns: 80 } })
    const keys = (await ui.findAll({ type: 'Button' })).map(b => b.key ?? '')
    expect([surface, keys.filter(k => k.startsWith('hr-recount-'))]).toEqual([surface, ['hr-recount-2026-12-01']])
    // The lists with no hearings still wait under For your review.
    expect([surface, keys.includes('rv-mark-w30')]).toEqual([surface, true])
    await ui.unmount()
  }
})

import { expect, test } from 'claude-code/testing'
import { COPY } from '../hooks/copy'
import { classify, safeToolName } from '../hooks/sends'
import { engine } from './engine'

const ASK = [
  'mcp__plugin_nys-workers-comp-hub_nys-workers-comp-hub__add_workspace_cases', 'mcp__claude_ai_The_Comp_Desk__mark_hearing_note_posted',
  'mcp__claude_ai_Gmail__send_message', 'mcp__claude_ai_Gmail__send_draft', 'mcp__x__reply', 'mcp__x__forward', 'mcp__slack__slack_send_message',
  'mcp__x__sendMessage', 'mcp__x__postMessage', 'mcp__x__createPost',
  'mcp__drive__share_file', 'mcp__x__publish_project', 'mcp__x__reply_to_thread', 'mcp__x__submit_pending',
  // kebab-case, a read verb followed by a send, one word
  'mcp__resend__send-email', 'mcp__x__post-message', 'mcp__x__export_and_send', 'mcp__x__sendmail',
]
const KEEP = [
  'mcp__claude_ai_Gmail__create_draft', 'mcp__claude_ai_Gmail__update_draft', 'mcp__x__list_drafts',
  'mcp__x__get_thread', 'mcp__x__search_threads', 'mcp__x__get_post', 'mcp__x__getPost', 'mcp__x__list_posts', 'mcp__x__get_share_link', 'mcp__x__list_shared_drives',
  'mcp__plugin_nys-workers-comp-hub_nys-workers-comp-hub__calculate_slu_award', 'mcp__claude_ai_The_Comp_Desk__get_import_status',
  'mcp__x__create_record', 'Bash', 'Write', 'WebFetch',
]
const HUB_SLU = 'mcp__plugin_nys-workers-comp-hub_nys-workers-comp-hub__calculate_slu_award'

test('50. every send asks the person; drafts, reads and built-in tools keep the verdict beneath', async ($, on) => {
  engine(on)
  on('tool.check', () => ({ decision: 'allow' }))
  for (const tool of ASK) expect([tool, (await $.tool.check({ tool, input: {} })).decision]).toEqual([tool, 'ask'])
  for (const tool of KEEP) expect([tool, (await $.tool.check({ tool, input: {} })).decision]).toEqual([tool, 'allow'])
  expect(classify('mcp__claude_ai_Gmail__send_draft')).toBe('send')
  expect(classify('mcp__claude_ai_Gmail__create_draft')).toBe('draft')
  expect(classify('mcp__x__getPost')).toBe('other')
})

test('51. a deny beneath stays a deny', async ($, on) => {
  engine(on)
  on('tool.check', () => ({ decision: 'deny', reason: 'blocked by a rule' }))
  for (const tool of ['mcp__claude_ai_Gmail__send_message', 'mcp__claude_ai_The_Comp_Desk__add_workspace_cases']) {
    const r = await $.tool.check({ tool, input: {} })
    expect([r.decision, r.reason]).toEqual(['deny', 'blocked by a rule'])
  }
})

test('52. sends-and-writes: a connector write asks once the session works with the Hub', { options: { send_guard: 'sends-and-writes' } }, async ($, on) => {
  engine(on)
  on('tool.check', () => ({ decision: 'allow' }))
  expect((await $.tool.check({ tool: 'mcp__x__create_record', input: {} })).decision).toBe('allow')
  await $.tool.call({ tool: HUB_SLU, aww: 1200 })
  const r = await $.tool.check({ tool: 'mcp__x__create_record', input: {} })
  expect([r.decision, r.reason]).toEqual(['ask', COPY.guardWrite('create_record')])
})

test('53. hub-only: a mail send keeps its verdict; the Hub writes still ask', { options: { send_guard: 'hub-only' } }, async ($, on) => {
  engine(on)
  on('tool.check', () => ({ decision: 'allow' }))
  expect((await $.tool.check({ tool: 'mcp__claude_ai_Gmail__send_message', input: {} })).decision).toBe('allow')
  const r = await $.tool.check({ tool: 'mcp__claude_ai_The_Comp_Desk__add_workspace_cases', input: {} })
  expect([r.decision, r.reason]).toEqual(['ask', COPY.guardWorkspace])
  const p = await $.tool.check({ tool: 'mcp__claude_ai_The_Comp_Desk__mark_hearing_note_posted', input: {} })
  expect([p.decision, p.reason]).toEqual(['ask', COPY.guardPosted])
})

test('54. when the verdict beneath cannot be read, the guard asks', async ($, on) => {
  engine(on)
  on('tool.check', () => { throw new Error('beneath failed') })
  const r = await $.tool.check({ tool: 'mcp__claude_ai_Gmail__send_message', input: {} })
  expect([r.decision, r.reason]).toEqual(['ask', COPY.guardFallback])
})

test('55. a server-named tool is shown in letters, digits and underscores only', async ($, on) => {
  engine(on)
  on('tool.check', () => ({ decision: 'allow' }))
  const odd = `mcp__x__send_${'é<>'.repeat(3)}${'z'.repeat(100)}`
  const r = await $.tool.check({ tool: odd, input: {} })
  expect(r.decision).toBe('ask')
  const shown = /\(([^)]*)\)/.exec(r.reason ?? '')?.[1] ?? 'none'
  expect(shown).toMatch(/^[A-Za-z0-9_]{1,64}$/)
  expect(safeToolName('a(b)c d;e')).toBe('abcde')
})

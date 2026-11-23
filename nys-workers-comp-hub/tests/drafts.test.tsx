import { expect, test } from 'claude-code/testing'
import type { Draft } from '../types'
import { COPY } from '../hooks/copy'
import { engine, HUB, PANE, PEEK, peek, skillArgs, SURFACES } from './engine'
import type { ResultFor } from './engine'
import { CHECKLIST, CHECKLIST_FILE, LETTER, LETTER_FILE, PLUGIN, reply, SLU_OK } from './fixtures'

const SLU = `${PLUGIN}calculate_slu_award`
const DESK = { plugin: HUB, component: 'Pane', requestId: 'comp-desk', props: PANE } as const
const GMAIL = 'mcp__claude_ai_Gmail__create_draft'

async function draftsOf($: Parameters<typeof peek>[0]): Promise<Draft[]> {
  return (await peek<Draft[] | null>($, 'drafts')) ?? []
}

test('43. before any Hub work, an ordinary document is not a draft', { plugins: [PEEK] }, async ($, on) => {
  engine(on)
  await $.tool.call({ tool: 'Write', tool_use_id: 'a', file_path: '/x/README.md', content: 'Drafts only: the attorney reviews and signs everything.' })
  await $.tool.call({ tool: 'Write', tool_use_id: 'b', file_path: '/x/notes.md', content: 'notes' })
  expect(await draftsOf($)).toEqual([])
})

test('44. during a Hub drafting skill, a document written is a draft, with the skill named', { plugins: [PEEK] }, async ($, on) => {
  engine(on)
  await $.skill.prompt(skillArgs('wc-settlement-offers'))
  await $.tool.call({ tool: 'Write', tool_use_id: 'n1', file_path: '/x/notes.md', content: 'A response for the attorney to review.' })
  const list = await draftsOf($)
  expect(list.map(d => [d.kind, d.name, d.origin, d.review])).toEqual([['document', 'notes.md', 'write', 'waiting']])
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...DESK, surface })
    expect((await ui.find({ type: 'Text', text: /^Written by Claude/ }))?.text).toBe(COPY.originWrite(COPY.justNow) + COPY.withSkill('Settlement and offer responses'))
    expect(await ui.find({ type: 'Button', key: 'rv-sum-n1' })).toBeDefined()
    await ui.unmount()
  }
})

test('45. during Hub work without a drafting skill, only a marked draft lands', { plugins: [PEEK] }, async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  await $.tool.call({ tool: SLU, tool_use_id: 't1', aww: 1200 })
  await $.tool.call({ tool: 'Write', tool_use_id: 'l1', file_path: LETTER_FILE, content: LETTER })
  await $.tool.call({ tool: 'Write', tool_use_id: 'p1', file_path: '/x/plain.md', content: 'A plain note.' })
  expect((await draftsOf($)).map(d => d.name)).toEqual(['letter-to-client.md'])
})

test('46. project files and staged writes never land', { plugins: [PEEK] }, async ($, on) => {
  const results: Record<string, ResultFor> = {}
  engine(on, { results })
  await $.skill.prompt(skillArgs('hearing-prep-checklist'))
  await $.tool.call({ tool: 'Write', tool_use_id: 'c1', file_path: '/x/.claude/a.md', content: LETTER })
  await $.tool.call({ tool: 'Write', tool_use_id: 'c2', file_path: '/x/CLAUDE.md', content: LETTER })
  results.Write = e => ({ result: { type: 'create', filePath: e.file_path, content: e.content, structuredPatch: [], originalFile: null, staged: true } })
  await $.tool.call({ tool: 'Write', tool_use_id: 'c3', file_path: CHECKLIST_FILE, content: CHECKLIST })
  expect(await draftsOf($)).toEqual([])
})

test('47. an Edit recounts from the reported original; a changed proposal goes stale; a whole Read recounts', { plugins: [PEEK] }, async ($, on) => {
  const results: Record<string, ResultFor> = {}
  engine(on, { results })
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  const edit = { old_string: '- [ ] Have the OC-400.1 fee application ready', new_string: '- [x] Have the OC-400.1 fee application ready' }
  results.Edit = e => ({ result: { filePath: e.file_path, oldString: e.old_string, newString: e.new_string, originalFile: CHECKLIST, structuredPatch: [], userModified: false, replaceAll: false } })
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: CHECKLIST_FILE, ...edit })
  let d = (await draftsOf($))[0]
  expect([d?.checklist?.open, d?.checklist?.done, d?.checklist?.verify, d?.isStale, d?.origin]).toEqual([20, 1, 7, false, 'edit'])
  expect(d?.touches).toEqual(['w1', 'e1'])

  results.Edit = e => ({ result: { filePath: e.file_path, oldString: e.old_string, newString: e.new_string, originalFile: CHECKLIST, structuredPatch: [], userModified: true, replaceAll: false } })
  await $.tool.call({ tool: 'Edit', tool_use_id: 'e2', file_path: CHECKLIST_FILE, old_string: 'x', new_string: 'y' })
  d = (await draftsOf($))[0]
  expect([d?.checklist?.open, d?.isStale]).toEqual([20, true])
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...DESK, surface })
    expect(await ui.find({ type: 'Text', text: COPY.stale })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'rv-recount-w1' })).toBeDefined()
    await ui.unmount()
  }

  const lines = CHECKLIST.split('\n').length
  results.Read = e => ({ result: { type: 'text', file: { filePath: e.file_path, content: CHECKLIST, numLines: lines, startLine: 1, totalLines: lines } } })
  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: CHECKLIST_FILE })
  d = (await draftsOf($))[0]
  expect([d?.checklist?.open, d?.isStale, d?.origin]).toEqual([21, false, 'edit'])

  results.Read = e => ({ result: { type: 'text', file: { filePath: e.file_path, content: 'just a part', numLines: 5, startLine: 5, totalLines: lines } } })
  await $.tool.call({ tool: 'Read', tool_use_id: 'r2', file_path: CHECKLIST_FILE })
  d = (await draftsOf($))[0]
  expect([d?.checklist?.open, d?.isStale, d?.touches.includes('r2')]).toEqual([21, false, false])
})

test('48. a whole Read of a checklist not on the desk puts it there', { plugins: [PEEK] }, async ($, on) => {
  const lines = CHECKLIST.split('\n').length
  engine(on, { results: { Read: e => ({ result: { type: 'text', file: { filePath: e.file_path, content: CHECKLIST, numLines: lines, startLine: 1, totalLines: lines } } }) } })
  await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: CHECKLIST_FILE })
  const d = (await draftsOf($))[0]
  expect([d?.kind, d?.origin, d?.checklist?.verify]).toEqual(['checklist', 'read', 8])
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...DESK, surface })
    expect(await ui.find({ type: 'Text', text: COPY.originRead(COPY.justNow) })).toBeDefined()
    await ui.unmount()
  }
})

test('49. an email draft counts only during Hub work, once per draft id', { plugins: [PEEK] }, async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_OK), create_draft: { result: '{}', text: '{}' } } })
  await $.tool.call({ tool: GMAIL, tool_use_id: 'g0', subject: 'Hearing reminder (DEMO)', draft_id: 'd1' })
  expect(await draftsOf($)).toEqual([])
  await $.tool.call({ tool: SLU, tool_use_id: 't1', aww: 1200 })
  await $.tool.call({ tool: GMAIL, tool_use_id: 'g1', subject: 'Hearing reminder (DEMO)', draft_id: 'd1' })
  await $.tool.call({ tool: GMAIL, tool_use_id: 'g2', subject: 'Hearing reminder (DEMO)', draft_id: 'd1' })
  const list = await draftsOf($)
  expect(list.map(d => [d.kind, d.origin, d.key, d.touches])).toEqual([['email', 'connector', 'd1', ['g1', 'g2']]])
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...DESK, surface })
    expect(await ui.find({ type: 'Text', text: 'Email draft, unsent · Hearing reminder (DEMO)' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Unsent, in your mailbox/ })).toBeDefined()
    await ui.unmount()
  }
})

test('49b. /clear empties the desk and the new conversation starts without Hub work', { plugins: [PEEK] }, async ($, on) => {
  const log = engine(on, { results: { calculate_slu_award: reply(SLU_OK), create_draft: { result: '{}', text: '{}' } } })
  await $.tool.call({ tool: SLU, tool_use_id: 't1', aww: 1200 })
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  expect(await draftsOf($)).toHaveLength(1)
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: {} } as never)
  expect(await draftsOf($)).toEqual([])
  expect(await peek($, 'figures')).toEqual([])
  expect(log.statuses[log.statuses.length - 1]).toBeUndefined()
  await $.tool.call({ tool: GMAIL, tool_use_id: 'g1', subject: 'Hearing reminder (DEMO)', draft_id: 'd1' })
  expect(await draftsOf($)).toEqual([])
})

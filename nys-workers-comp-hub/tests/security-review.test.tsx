// Security and privacy: the suite reaches nothing outside the session on its own, fills the prompt only when
// the person presses, keeps preferences alone in the store, never loosens a verdict, never stands between the
// person and the Hub's read-only tools or a mail draft, and lets no send through where nobody can be asked.
// Every name, number and address here is fictional.
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import { COPY } from '../hooks/copy'
import { HUB_NAMES, HUB_WRITE_NAMES } from '../hooks/hub'
import { DEFAULT_PREFS } from '../hooks/prefs'
import { BAND, COMPOSE, engine, HUB, PANE, RUN, skillArgs, START, toolRow } from './engine'
import { CHECKLIST, CHECKLIST_FILE, CONNECTOR, LETTER, LETTER_FILE, NOTE_ID, NOTE_ONE, NOTES_LIST, PLUGIN, RATE_MISSING, reply, SLU_OK, WS_SENT, WS_STATUS } from './fixtures'

const SLU = `${PLUGIN}calculate_slu_award`
const GMAIL = 'mcp__claude_ai_Gmail__'
const GUARDS = ['sends', 'sends-and-writes', 'hub-only'] as const
const HUB_READS = [...HUB_NAMES].filter(n => !HUB_WRITE_NAMES.has(n))
const MAIL_KEEPS = ['create_draft', 'update_draft', 'delete_draft', 'get_draft', 'list_drafts', 'get_message', 'get_thread', 'search_threads', 'list_labels']
const PREF_KEYS = Object.keys(DEFAULT_PREFS).sort()

// The $ calls that would reach past this session's own display: the network, the person's files, processes,
// a model, an agent, the transcript, the environment and settings. The suite must make none of them.
const OUTBOUND = [
  'http.fetch', 'mcp.call', 'mcp.connect', 'process.run', 'fs.read', 'fs.write', 'fs.list', 'fs.stat', 'fs.exists', 'fs.ancestors',
  'model.complete', 'model.classify', 'model.fork', 'agent.call', 'session.messages', 'env.get', 'env.set', 'settings.read',
  'audio.speak', 'ui.notify', 'tool.register', 'agent.register',
] as const

function watchOutbound(on: On): string[] {
  const hits: string[] = []
  for (const name of OUTBOUND) on(name as never, ((_: unknown, e: unknown, next: (x: unknown) => unknown) => { hits.push(name); return next(e) }) as never)
  return hits
}

async function fullSession($: Engine): Promise<void> {
  await $.session.start(START)
  await $.skill.prompt(skillArgs('hearing-prep-checklist'))
  await $.skill.prompt(skillArgs('explain-benefit-to-client'))
  await $.tool.call({ tool: SLU, tool_use_id: 't1', aww: 1200, date_of_accident: '2024-03-15', body_parts: [{ body_part: 'arm', loss_percent: 25 }], prior_payments: 0 })
  await $.tool.call({ tool: `${PLUGIN}calculate_weekly_rate`, tool_use_id: 't2', kind: 'total' })
  await $.tool.call({ tool: `${PLUGIN}list_hearing_notes`, tool_use_id: 't3' })
  await $.tool.call({ tool: `${PLUGIN}get_hearing_note`, tool_use_id: 't4', id: NOTE_ID })
  await $.tool.call({ tool: `${PLUGIN}add_workspace_cases`, tool_use_id: 't5', format: 'cdw-cases', version: 1, cases: [{ label: 'A. Garcia (DEMO)', wcb: 'DEMO-0001' }] })
  await $.tool.call({ tool: `${PLUGIN}get_import_status`, tool_use_id: 't6', keys: ['DEMO-0001:2026-12-03'] })
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  await $.tool.call({ tool: 'Write', tool_use_id: 'w2', file_path: LETTER_FILE, content: LETTER })
  await $.tool.call({ tool: `${GMAIL}create_draft`, tool_use_id: 'g1', subject: 'Hearing reminder (DEMO) for A. Garcia', draft_id: 'd1' })
}

const RESULTS = {
  calculate_slu_award: reply(SLU_OK), calculate_weekly_rate: reply(RATE_MISSING), list_hearing_notes: reply(NOTES_LIST), get_hearing_note: reply(NOTE_ONE),
  add_workspace_cases: reply(WS_SENT), get_import_status: reply(WS_STATUS), create_draft: { result: '{"id":"d1"}', text: '{"id":"d1"}' },
}

test('SR1. nothing outside the session: no network, file, process, model, agent or transcript call, whatever is pressed', { options: { open_desk: 'on-hub-work', look: 'paper' } }, async ($, on) => {
  const hits = watchOutbound(on)
  const log = engine(on, { results: RESULTS })
  await fullSession($)
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const desk = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: { ...PANE, bodyColumns: 80 } })
    await desk.press({ key: 'customize' })
    await desk.press({ key: 'd-comfortable' })
    await desk.press({ key: 'done' })
    for (const b of await desk.findAll({ type: 'Button' })) {
      const key = String(b.key ?? '')
      if (key === '' || key === 'close' || key === 'customize' || key.startsWith('fig-') || key.startsWith('rv-mark-')) continue
      await desk.press({ key })
    }
    await desk.unmount()
    const card = await $.ui.mount({ plugin: HUB, surface, component: 'ToolUse', props: toolRow(SLU, 't1', { aww: 1200 }) })
    for (const b of await card.findAll({ type: 'Button' })) if (b.key !== undefined) await card.press({ key: String(b.key) })
    await card.unmount()
    const band = await $.ui.mount({ plugin: HUB, surface, component: 'AbovePrompt', props: BAND })
    await band.unmount()
  }
  const menu = await $.ui.mount({ plugin: HUB, surface: 'desktop', component: 'ContextMenu', props: { row: { component: 'ToolUse', requestId: 't1' }, selection: { text: 'C-4.3 on 03/15/2024' } } })
  for (const b of await menu.findAll({ type: 'Button' })) if (b.key !== undefined) await menu.press({ key: String(b.key) })
  await menu.unmount()
  for (const [command, args] of [['comp-desk', ''], ['comp-desk', 'help'], ['comp-desk-layout', 'focus compact'], ['comp-desk-look', 'paper-night serif'], ['comp-desk-look', 'app'], ['comp-desk', 'reset'], ['comp-desk', 'clear']] as const) {
    await $.command.run({ ...RUN, command, args })
  }
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: {} } as never)
  expect(log.fills.length).toBeGreaterThan(3)
  expect(log.copies.length).toBeGreaterThan(0)
  expect(hits).toEqual([])
})

test('SR2. the prompt is filled only by a press, never sent; the store keeps the layout choices and nothing else', async ($, on) => {
  const log = engine(on, { results: RESULTS })
  await fullSession($)
  const desk = await $.ui.mount({ plugin: HUB, surface: 'desktop', component: 'Pane', requestId: 'comp-desk', props: { ...PANE, bodyColumns: 80 } })
  await desk.unmount()
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: HUB, surface, component: 'AbovePrompt', props: BAND })
    await band.unmount()
  }
  expect(log.fills).toEqual([])
  expect(log.copies).toEqual([])
  // Odd words to the commands change nothing they do not name.
  for (const args of ['hide __proto__', 'show constructor', 'cards __proto__', 'toString', 'desk hide review cards off']) await $.command.run({ ...RUN, command: 'comp-desk-layout', args })
  for (const args of ['__proto__', 'paper __proto__', 'paper-light no-serif']) await $.command.run({ ...RUN, command: 'comp-desk-look', args })
  expect(log.submits).toEqual([])
  expect(log.stored.length).toBeGreaterThan(0)
  for (const value of log.stored) {
    expect(Object.keys(value as Record<string, unknown>).sort()).toEqual(PREF_KEYS)
    expect(JSON.stringify(value)).not.toMatch(/Garcia|DEMO|hearing-checklist|letter-to-client|\/x\/|Hearing reminder|1200|2024-03-15/)
  }
})

for (const guard of GUARDS) {
  test(`SR3. ${guard}: the Hub's reads and mail drafts keep the verdict beneath under both spellings; the two Hub writes ask`, { options: { send_guard: guard } }, async ($, on) => {
    engine(on, { results: RESULTS })
    on('tool.check', () => ({ decision: 'allow' }))
    await $.tool.call({ tool: SLU, tool_use_id: 'h1', aww: 1200 })
    expect(HUB_READS).toHaveLength(30)
    for (const prefix of [PLUGIN, CONNECTOR]) {
      for (const name of HUB_READS) expect([name, (await $.tool.check({ tool: prefix + name, input: {} })).decision]).toEqual([name, 'allow'])
      for (const name of HUB_WRITE_NAMES) expect([name, (await $.tool.check({ tool: prefix + name, input: {} })).decision]).toEqual([name, 'ask'])
    }
    for (const name of MAIL_KEEPS) expect([name, (await $.tool.check({ tool: GMAIL + name, input: {} })).decision]).toEqual([name, 'allow'])
    for (const tool of ['Read', 'Write', 'Edit', 'Grep', 'WebFetch']) expect([tool, (await $.tool.check({ tool, input: {} })).decision]).toEqual([tool, 'allow'])
  })
}

test('SR4. the guard never loosens: an ask or a deny beneath stands, with its own reason, for every name it matches', async ($, on) => {
  engine(on)
  let beneath: 'ask' | 'deny' = 'deny'
  on('tool.check', () => ({ decision: beneath, reason: 'beneath' }))
  const names = [
    ...['send_message', 'reply', 'forward', ...MAIL_KEEPS].map(n => GMAIL + n), ...[...HUB_NAMES].map(n => PLUGIN + n),
    'mcp__x__create_record', 'mcp__x__update_record', 'mcp__x__delete_record', 'mcp__x__publish_project', 'mcp__x__share_file',
  ]
  for (const tool of names) {
    const r = await $.tool.check({ tool, input: {} })
    expect([tool, r.decision, r.reason]).toEqual([tool, 'deny', 'beneath'])
  }
  beneath = 'ask'
  for (const tool of names) expect([tool, (await $.tool.check({ tool, input: {} })).decision]).toEqual([tool, 'ask'])
})

const SENDER = {
  name: 'tcd-test-sender',
  register(on: On) {
    on('command.run', { command: 'tcd-test-send' }, async ($) => {
      const r = await $.tool.call({ tool: 'mcp__claude_ai_Gmail__send_message', to: 'someone@example.com', body: 'hello' } as never)
      return { text: JSON.stringify({ isDenied: typeof (r as { deny?: unknown }).deny === 'string' }) }
    })
  },
}

test('SR5. where nobody can be asked, a send does not run, even when it comes from another plugin with an allow beneath', { plugins: [SENDER] }, async ($, on) => {
  const sent: string[] = []
  engine(on, { results: { send_message: e => { sent.push(String(e.to)); return { result: '{"id":"m1"}', text: '{"id":"m1"}' } } } })
  on('tool.check', () => ({ decision: 'allow' }))
  const r = await $.command.run({ ...RUN, command: 'tcd-test-send', args: '' })
  expect(JSON.parse(r.text ?? '{}')).toEqual({ isDenied: true })
  expect(sent).toEqual([])
})

test("SR6. Claude's instructions get one constant section; nothing from the session reaches them", async ($, on) => {
  engine(on, { results: RESULTS })
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'engine intro', scope: 'shared' }] }))
  const before = (await $.prompt.compose(COMPOSE)).sections.map(s => [s.id, s.text, s.scope])
  await fullSession($)
  const after = (await $.prompt.compose(COMPOSE)).sections
  expect(after.map(s => [s.id, s.text, s.scope])).toEqual(before)
  expect(after[after.length - 1]?.text).toBe(COPY.conventions)
  for (const s of after) expect(s.text).not.toMatch(/Garcia|DEMO-|hearing-checklist|letter-to-client|Hearing reminder|\$\d/)
})

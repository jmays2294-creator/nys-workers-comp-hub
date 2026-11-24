// Engine review: the suite hooks the person's own session, so a failure in the suite must never change what
// the session does. These tests make every engine noun the suite calls fail and check that each hook still
// hands on what is beneath it, unchanged; they also check the caps on what the suite keeps, the one minute
// tick a loaded module runs, and what a second session.start (a reload's) keeps. Fictional data only.
import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import { COPY } from '../hooks/copy'
import { DEFAULT_PREFS } from '../hooks/prefs'
import { BAND, COMPOSE, engine, HUB, PANE, PEEK, peek, RUN, skillArgs, START, SURFACES, toolRow } from './engine'
import { CHECKLIST, CHECKLIST_FILE, PLUGIN, reply, SLU_OK } from './fixtures'

const SLU = `${PLUGIN}calculate_slu_award`
const NOTE = `${PLUGIN}get_hearing_note`
const GMAIL_DRAFT = 'mcp__claude_ai_Gmail__create_draft'
const GMAIL_SEND = 'mcp__claude_ai_Gmail__send_message'
const SLU_ARGS = { aww: 1200, date_of_accident: '2024-03-15', body_parts: [{ body_part: 'arm', loss_percent: 25 }], prior_payments: 0 }

const BROKEN = new Error('the engine is having a bad day (test)')
function fail(): never {
  throw BROKEN
}

// The engine beneath, with every noun the suite calls failing. The events the suite only passes on answer.
function brokenEngine(on: On, answers: Record<string, unknown>): void {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('skill.prompt', (_, e) => ({ text: e.text }))
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'engine intro', scope: 'shared' }] }))
  on('tool.check', () => ({ decision: 'allow' }))
  on('tool.call', (_, e) => {
    const tool = String((e as unknown as Record<string, unknown>).tool)
    return (answers[tool] ?? { result: '{}', text: '{}' }) as never
  })
  on('command.register', fail)
  on('store.get', fail)
  on('store.set', fail)
  on('store.delete', fail)
  on('theme.set', fail)
  on('theme.clear', fail)
  on('tool.list', fail)
  on('ui.open', fail)
  on('ui.close', fail)
  on('ui.status', fail)
  on('ui.toast', fail)
  on('ui.copy', fail)
  on('prompt.read', fail)
  on('prompt.fill', fail)
  on('clock.now', fail)
  on('clock.every', fail)
}

test('E1. with every engine noun failing, each hook hands on what is beneath, unchanged', { options: { open_desk: 'on-hub-work', look: 'paper' } }, async ($, on) => {
  const slu = reply(SLU_OK)
  const write = { result: { type: 'create', filePath: CHECKLIST_FILE, content: CHECKLIST, structuredPatch: [], originalFile: null } }
  const edit = { result: { filePath: CHECKLIST_FILE, oldString: '- [ ] ', newString: '- [x] ', originalFile: CHECKLIST, structuredPatch: [], userModified: false, replaceAll: false } }
  const read = { result: { type: 'text', file: { filePath: CHECKLIST_FILE, content: CHECKLIST, numLines: 10, startLine: 1, totalLines: 10 } } }
  const draft = { result: '{"id":"d1"}', text: '{"id":"d1"}' }
  brokenEngine(on, { [SLU]: slu, Write: write, Edit: edit, Read: read, [GMAIL_DRAFT]: draft })

  expect(await $.session.start(START)).toEqual({ cwd: START.cwd })
  expect((await $.skill.prompt(skillArgs('hearing-prep-checklist'))).text).toBe('skill text')

  const ran = await $.tool.call({ tool: SLU, tool_use_id: 't1', ...SLU_ARGS })
  expect([ran.result, ran.text, ran.isError]).toEqual([slu.result, slu.text, undefined])
  const wrote = await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  expect(wrote.result).toEqual(write.result)
  const edited = await $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: CHECKLIST_FILE, old_string: '- [ ] ', new_string: '- [x] ' })
  expect(edited.result).toEqual(edit.result)
  const readBack = await $.tool.call({ tool: 'Read', tool_use_id: 'r1', file_path: CHECKLIST_FILE })
  expect(readBack.result).toEqual(read.result)
  const drafted = await $.tool.call({ tool: GMAIL_DRAFT, tool_use_id: 'g1', subject: 'Hearing reminder (DEMO)', draft_id: 'd1' })
  expect([drafted.result, drafted.text]).toEqual([draft.result, draft.text])

  // The send guard still asks; nothing it asked of the engine was needed for that.
  expect((await $.tool.check({ tool: GMAIL_SEND, input: {} })).decision).toBe('ask')
  expect((await $.tool.check({ tool: SLU, input: {} })).decision).toBe('allow')

  const composed = await $.prompt.compose(COMPOSE)
  expect(composed.sections.map(s => s.id)).toEqual(['intro', 'nys-workers-comp-hub:conventions'])

  // The commands answer in words, never with a throw.
  for (const args of ['', 'close', 'clear', 'reset', 'help']) {
    const r = await $.command.run({ ...RUN, command: 'comp-desk', args })
    expect(typeof r.text).toBe('string')
  }
  expect(typeof (await $.command.run({ ...RUN, command: 'comp-desk-layout', args: 'focus compact' })).text).toBe('string')
  expect(typeof (await $.command.run({ ...RUN, command: 'comp-desk-look', args: 'paper-night' })).text).toBe('string')

  // Every drawing still keeps the engine's row, or draws a tree the surface takes.
  for (const surface of SURFACES) {
    const card = await $.ui.mount({ plugin: HUB, surface, component: 'ToolUse', requestId: 't1', props: toolRow(SLU, 't1', SLU_ARGS, { output: slu.text }) })
    expect([surface, await card.keepsBeneath()]).toEqual([surface, true])
    await card.unmount()
    const pane = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: PANE })
    expect([surface, ['Box', 'Text'].includes((await pane.drawn()).type)]).toEqual([surface, true])
    await pane.unmount()
    const band = await $.ui.mount({ plugin: HUB, surface, component: 'AbovePrompt', props: BAND })
    expect([surface, typeof (await band.drawn()).type]).toEqual([surface, 'string'])
    await band.unmount()
  }

  const ended = await $.session.end({ reason: 'clear', sessionId: 's1', resume: {} } as never)
  expect(ended).toEqual({ sessionId: 's1' })
})

test('E2. what the suite keeps stays capped: 30 drafts, 10 touches a draft, 25 notes ready', { plugins: [PEEK] }, async ($, on) => {
  engine(on, { results: { get_hearing_note: (e: Record<string, unknown>) => reply({ ok: true, tool: 'get_hearing_note', note: { id: e.id, label: 'DEMO' }, notice: { figures: 'DEMO' } }) } })
  await $.session.start(START)
  for (let i = 1; i <= 40; i += 1) {
    const day = `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`
    await $.tool.call({ tool: 'Write', tool_use_id: `w${i}`, file_path: `/x/hearing-checklist-${day}-v${i}.md`, content: CHECKLIST })
  }
  for (let i = 0; i < 12; i += 1) await $.tool.call({ tool: 'Write', tool_use_id: `same${i}`, file_path: '/x/hearing-checklist-2027-01-01.md', content: CHECKLIST })
  for (let i = 0; i < 30; i += 1) await $.tool.call({ tool: NOTE, tool_use_id: `n${i}`, id: `00000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}` })
  const drafts = await peek<{ touches: string[] }[]>($, 'drafts')
  const link = await peek<{ notesReady: string[] }>($, 'link')
  expect(drafts.length).toBe(30)
  expect(Math.max(...drafts.map(d => d.touches.length))).toBe(10)
  expect(link.notesReady.length).toBe(25)
  // The newest are kept.
  expect(drafts[drafts.length - 1]?.touches[9]).toBe('same11')
})

// A reader of the minute tick and the desk flag, standing beside the suite as any plugin may.
const TICK = {
  name: 'tcd-tick',
  register(on: On) {
    on('command.run', { command: 'tcd-tick' }, async ($) => {
      const t = await $.state.get({ plugin: 'nys-workers-comp-hub', key: 'tick' })
      const o = await $.state.get({ plugin: 'nys-workers-comp-hub', key: 'isDeskOpen' })
      return { text: JSON.stringify([t.value ?? 0, o.value ?? false]) }
    })
  },
}

test('E3. the minute tick runs only while the desk is up: one interval, however often it opens or session.start runs', { plugins: [TICK] }, async ($, on) => {
  let periods = 0
  on('clock.every', { ms: 60_000 }, (_, e, next) => { periods += 1; return next(e) })
  const log = engine(on, {})
  const tick = async (): Promise<unknown> => JSON.parse((await $.command.run({ ...RUN, command: 'tcd-tick', args: '' })).text ?? 'null')
  await $.session.start(START)
  await $.session.start(START)
  await log.clock.advance(5 * 60_000)
  // No desk, no interval: the worker is not woken.
  expect(periods).toBe(0)
  expect(await tick()).toEqual([0, false])
  await $.command.run({ ...RUN, command: 'comp-desk', args: '' })
  await $.command.run({ ...RUN, command: 'comp-desk', args: '' })
  await $.session.start(START)
  await log.clock.advance(2 * 60_000)
  expect(await tick()).toEqual([2, true])
  // One interval: its first period, then one more each minute.
  expect(periods).toBe(3)
  await $.command.run({ ...RUN, command: 'comp-desk', args: 'close' })
  await log.clock.advance(3 * 60_000)
  expect(await tick()).toEqual([2, false])
  expect(periods).toBe(3)
})

test('E4. session.start again, as a reload raises it, keeps the session desk and the person\'s choices', { plugins: [PEEK] }, async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  await $.session.start(START)
  await $.tool.call({ tool: SLU, tool_use_id: 't1', ...SLU_ARGS })
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  await $.command.run({ ...RUN, command: 'comp-desk-layout', args: 'focus compact' })
  await $.session.start(START)
  expect((await peek<{ id: string; status: string }[]>($, 'figures')).map(f => [f.id, f.status])).toEqual([['t1', 'done']])
  expect((await peek<{ id: string }[]>($, 'drafts')).map(d => d.id)).toEqual(['w1'])
  const prefs = await peek<{ preset: string; density: string }>($, 'prefs')
  expect([prefs.preset, prefs.density]).toEqual(['focus', 'compact'])
  expect((await $.command.run({ ...RUN, command: 'comp-desk', args: 'help' })).text).toBe(COPY.deskHelp)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: PANE })
    expect(await ui.find({ type: 'Text', text: COPY.deskFailed })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: COPY.disclaimer })).toBeDefined()
    await ui.unmount()
  }
})

test('E5. a model-written checklist that numbers two hearings alike still draws the desk', async ($, on) => {
  engine(on, { store: { prefs: { ...DEFAULT_PREFS, density: 'comfortable' } } })
  await $.session.start(START)
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST.replace('## 2. ', '## 1. ') })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: { ...PANE, bodyColumns: 60 } })
    expect([surface, (await ui.drawn()).type]).toEqual([surface, 'Box'])
    expect([surface, await ui.find({ type: 'Text', text: COPY.deskFailed })]).toEqual([surface, undefined])
    await ui.unmount()
  }
})

test('E6. with nothing to add, the band, the menu and the cards hand on the engine\'s own drawing on every surface', async ($, on) => {
  engine(on, {})
  await $.session.start(START)
  const untracked = [
    toolRow('Read', 'r9', { file_path: '/x/README.md' }, { output: {} }),
    toolRow('Write', 'w9', { file_path: '/x/notes.md', content: 'x' }, { output: {} }),
    toolRow(GMAIL_DRAFT, 'g9', { subject: 'x' }, { output: '{}' }),
    toolRow(`${PLUGIN}define_term`, 'd9', { term: 'AWW' }, { output: 'not json' }),
  ]
  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: HUB, surface, component: 'AbovePrompt', props: BAND })
    expect([surface, 'band', await band.keepsBeneath(), await band.find({ type: 'Button' })]).toEqual([surface, 'band', true, undefined])
    await band.unmount()
    const menu = await $.ui.mount({ plugin: HUB, surface, component: 'ContextMenu', props: {} })
    expect([surface, 'menu', await menu.find({ type: 'Button' })]).toEqual([surface, 'menu', undefined])
    await menu.unmount()
    for (const props of untracked) {
      const row = await $.ui.mount({ plugin: HUB, surface, component: 'ToolUse', requestId: props.tool_use_id, props })
      expect([surface, props.tool, await row.keepsBeneath(), await row.find({ type: 'Button' })]).toEqual([surface, props.tool, true, undefined])
      await row.unmount()
    }
  }
})

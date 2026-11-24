// Engine review fixes: each test states the behaviour the engine review asked for (X1-X8). Every one failed on
// the first 1.3.0 product code. Fictional data only.
import { expect, test } from 'claude-code/testing'
import { COPY } from '../hooks/copy'
import { DEFAULT_PREFS } from '../hooks/prefs'
import { BAND, engine, HUB, PANE, PEEK, peek, RUN, skillArgs, START, SURFACES, toolRow } from './engine'
import { CHECKLIST, CHECKLIST_FILE, LETTER, LETTER_FILE } from './fixtures'

const HUB_DEFINE = 'mcp__plugin_nys-workers-comp-hub_nys-workers-comp-hub__define_term'

test('X1. the desk\'s own Close button closes it for the band and the minute tick too', { plugins: [PEEK] }, async ($, on) => {
  engine(on, {})
  await $.session.start(START)
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  await $.command.run({ ...RUN, command: 'comp-desk', args: '' })
  const pane = await $.ui.mount({ plugin: HUB, surface: 'desktop', component: 'Pane', requestId: 'comp-desk', props: PANE })
  await pane.press({ key: 'close' })
  await pane.unmount()
  expect(await peek($, 'isDeskOpen')).toBe(false)
  await $.skill.prompt(skillArgs('wc-settlement-offers'))
  await $.tool.call({ tool: 'Write', tool_use_id: 'l1', file_path: LETTER_FILE, content: LETTER })
  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: HUB, surface, component: 'AbovePrompt', props: BAND })
    expect([surface, await band.find({ type: 'Button', key: 'band-open' }) !== undefined]).toEqual([surface, true])
    await band.unmount()
  }
})

test('X2. on-start opens the desk once a session: a reload does not reopen what the person closed', { options: { open_desk: 'on-start' } }, async ($, on) => {
  const log = engine(on, {})
  await $.session.start(START)
  await $.command.run({ ...RUN, command: 'comp-desk', args: 'close' })
  await $.session.start(START)
  expect(log.opened).toEqual(['comp-desk'])
})

test('X3. a document path whose file link passes 2,048 characters still draws the desk on the terminal', async ($, on) => {
  engine(on, { store: { prefs: { ...DEFAULT_PREFS, density: 'comfortable' } } })
  await $.session.start(START)
  await $.skill.prompt(skillArgs('wc-settlement-offers'))
  const long = '/x/' + 'a-very-long-folder-name-for-a-fictional-matter/'.repeat(45) + 'letter-DEMO.md'
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: long, content: "DRAFT for the attorney's review." })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: { ...PANE, bodyColumns: 60 } })
    expect([surface, await ui.find({ type: 'Text', text: COPY.deskFailed })]).toEqual([surface, undefined])
    await ui.unmount()
  }
})

test('X4. thirty checklists: the hearings section stays capped, its per-list rows included', async ($, on) => {
  engine(on, { store: { prefs: { ...DEFAULT_PREFS, density: 'comfortable' } } })
  await $.session.start(START)
  for (let i = 1; i <= 30; i += 1) {
    await $.tool.call({ tool: 'Write', tool_use_id: `w${i}`, file_path: `/x/hearing-checklist-2026-12-${String(i).padStart(2, '0')}.md`, content: CHECKLIST })
  }
  const ui = await $.ui.mount({ plugin: HUB, surface: 'desktop', component: 'Pane', requestId: 'comp-desk', props: { ...PANE, bodyColumns: 60 } })
  const recount = (await ui.findAll({ type: 'Button' })).filter(b => (b.key ?? '').startsWith('hr-recount-')).length
  expect(recount).toBeLessThanOrEqual(6)
})

test('X5. kebab-case and snake_camel send tools, and comment, push and deploy tools, ask the person', async ($, on) => {
  engine(on, {})
  on('tool.check', () => ({ decision: 'allow' }))
  const sends = ['mcp__mail__send-email', 'mcp__chat__post-message', 'mcp__x__share-file', 'mcp__slack__chat_postMessage', 'mcp__mail__email_sendMessage',
    'mcp__github__add_issue_comment', 'mcp__github__push_files', 'mcp__Higgsfield__deploy_website']
  for (const tool of sends) expect([tool, (await $.tool.check({ tool, input: {} })).decision]).toEqual([tool, 'ask'])
  for (const tool of ['mcp__x__get-post', 'mcp__x__list-messages', 'mcp__x__sender_info', 'mcp__claude_ai_Gmail__create_draft', 'mcp__x__list_comments']) {
    expect([tool, (await $.tool.check({ tool, input: {} })).decision]).toEqual([tool, 'allow'])
  }
})

test('X6. a desk opened from the band rechecks the Hub listing instead of keeping the start-up miss', async ($, on) => {
  const tools: string[] = []
  engine(on, { tools })
  await $.session.start(START)
  tools.push(HUB_DEFINE)
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  const band = await $.ui.mount({ plugin: HUB, surface: 'desktop', component: 'AbovePrompt', props: BAND })
  await band.press({ key: 'band-open' })
  await band.unmount()
  const ui = await $.ui.mount({ plugin: HUB, surface: 'desktop', component: 'Pane', requestId: 'comp-desk', props: PANE })
  expect(await ui.find({ type: 'Text', text: COPY.hubNotListed })).toBeUndefined()
})

test('X7. a refused or failed checklist Write gets no checklist card: nothing was written', async ($, on) => {
  on('tool.call', { tool: 'Write' }, () => ({ deny: 'The person refused this write.' }))
  engine(on, {})
  await $.session.start(START)
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  for (const surface of SURFACES) {
    for (const flags of [{ isErrored: true }, { isInterrupted: true }]) {
      const ui = await $.ui.mount({ plugin: HUB, surface, component: 'ToolUse', requestId: 'w1', props: toolRow('Write', 'w1', { file_path: CHECKLIST_FILE, content: CHECKLIST }, { ...flags, output: 'The person refused this write.' }) })
      expect([surface, flags, await ui.find({ type: 'Text', text: COPY.checklistCardTitle })]).toEqual([surface, flags, undefined])
      expect([surface, flags, await ui.find({ type: 'Button' })]).toEqual([surface, flags, undefined])
      await ui.unmount()
    }
  }
})

test('X8. a resume into another conversation starts its desk empty, as /clear does', { plugins: [PEEK] }, async ($, on) => {
  engine(on, {})
  await $.session.start(START)
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  await $.session.end({ reason: 'resume', sessionId: 's1', resume: {} } as never)
  expect(await peek<unknown[]>($, 'drafts')).toEqual([])
})

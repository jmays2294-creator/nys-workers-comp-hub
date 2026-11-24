import { expect, test } from 'claude-code/testing'
import { DEFAULT_PREFS } from '../hooks/prefs'
import { BAND, engine, HUB, PANE, RUN, skillArgs, START } from './engine'
import type { ResultFor } from './engine'
import { CHECKLIST, CHECKLIST_FILE, LETTER, LETTER_FILE, NOTE_ID, NOTE_ONE, NOTE_POSTED, NOTES_LIST, PLUGIN, RATE_MISSING, reply, SLU_INVALID, SLU_OK, WS_SENT, WS_STATUS } from './fixtures'

const CASE_DATA = /Garcia|Baptiste|DEMO-|hearing-checklist|\/x\/|\$\d|Arm|aww|subject/i
const ON_SCREEN = /Garcia|Baptiste|DEMO-0001|\.md|Hearing reminder/
const PREF_KEYS = Object.keys(DEFAULT_PREFS).sort()
const CUSTOMIZE = [
  'p-focus', 'p-figures', 'p-glance', 'p-quiet', 'p-desk', 'd-comfortable', 'd-compact', 'd-fit',
  's-review', 's-review', 's-hearings', 's-hearings', 's-figures', 's-figures', 's-connection', 's-connection', 's-next', 's-next',
  'b-band', 'b-band', 'b-status', 'b-status', 'b-notices', 'b-notices', 'c-compact', 'c-off', 'c-full', 'n-hide', 'n-show',
  'l-paper', 'l-paper-light', 'l-paper-night', 'l-app', 'serif-off', 'serif-on', 'm-off', 'm-subtle', 'reset',
]

test('75. a full session keeps case data out of the store, the status line, notices and the band', async ($, on) => {
  const keys: string[] = []
  on('store.set', { key: /./ }, (_, e, next) => { keys.push(e.key); return next(e) })
  const results: Record<string, ResultFor> = {
    calculate_slu_award: reply(SLU_OK), calculate_weekly_rate: reply(RATE_MISSING), list_hearing_notes: reply(NOTES_LIST),
    get_hearing_note: reply(NOTE_ONE), mark_hearing_note_posted: reply(NOTE_POSTED), add_workspace_cases: reply(WS_SENT),
    get_import_status: reply(WS_STATUS), create_draft: { result: '{"id":"d1"}', text: '{"id":"d1"}' },
  }
  const log = engine(on, { results })
  const bandTexts: string[] = []
  const readBand = async (): Promise<void> => {
    const ui = await $.ui.mount({ plugin: HUB, surface: 'desktop', component: 'AbovePrompt', props: BAND })
    for (const t of await ui.findAll({ type: 'Text' })) bandTexts.push(t.text)
    await ui.unmount()
  }
  await $.session.start(START)
  await $.skill.prompt(skillArgs('hearing-prep-checklist'))
  await $.tool.call({ tool: `${PLUGIN}calculate_slu_award`, tool_use_id: 't1', aww: 1200, date_of_accident: '2024-03-15' })
  await readBand()
  await $.tool.call({ tool: `${PLUGIN}calculate_weekly_rate`, tool_use_id: 't2', kind: 'total' })
  await readBand()
  results.calculate_slu_award = reply(SLU_INVALID)
  await $.tool.call({ tool: `${PLUGIN}calculate_slu_award`, tool_use_id: 't3', aww: 1200, claimant_name: 'A. Garcia (DEMO)' })
  await $.tool.call({ tool: `${PLUGIN}list_hearing_notes`, tool_use_id: 't4' })
  await $.tool.call({ tool: `${PLUGIN}get_hearing_note`, tool_use_id: 't5', id: NOTE_ID })
  await $.tool.call({ tool: `${PLUGIN}mark_hearing_note_posted`, tool_use_id: 't6', id: NOTE_ID, system: 'demo' })
  await $.tool.call({ tool: `${PLUGIN}add_workspace_cases`, tool_use_id: 't7', format: 'cdw-cases', version: 1, cases: [{ label: 'A. Garcia (DEMO)', wcb: 'DEMO-0001' }] })
  await $.tool.call({ tool: `${PLUGIN}get_import_status`, tool_use_id: 't8', keys: ['DEMO-0001:2026-12-03'] })
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  await readBand()
  await $.tool.call({ tool: 'Write', tool_use_id: 'w2', file_path: LETTER_FILE, content: LETTER })
  await $.tool.call({ tool: 'mcp__claude_ai_Gmail__create_draft', tool_use_id: 'g1', subject: 'Hearing reminder (DEMO) for A. Garcia', draft_id: 'd1' })
  await readBand()

  const desk = await $.ui.mount({ plugin: HUB, surface: 'desktop', component: 'Pane', requestId: 'comp-desk', props: PANE })
  await desk.press({ key: 'names' })
  await desk.press({ key: 'names' })
  await desk.press({ key: 'customize' })
  for (const key of CUSTOMIZE) await desk.press({ key })
  await desk.press({ key: 'done' })
  await desk.unmount()

  for (const [command, args] of [['comp-desk', ''], ['comp-desk', 'help'], ['comp-desk', 'close'], ['comp-desk-layout', ''], ['comp-desk-layout', 'focus compact'],
    ['comp-desk-layout', 'hide figures cards off'], ['comp-desk-layout', 'desk fit'], ['comp-desk-look', ''], ['comp-desk-look', 'paper serif'],
    ['comp-desk-look', 'app'], ['comp-desk', 'reset'], ['comp-desk', 'clear']] as const) {
    await $.command.run({ ...RUN, command, args })
  }
  await readBand()

  expect(keys.length).toBeGreaterThan(10)
  expect([...new Set(keys)]).toEqual(['prefs'])
  for (const value of log.stored) {
    expect(Object.keys(value as Record<string, unknown>).sort()).toEqual(PREF_KEYS)
    expect(JSON.stringify(value)).not.toMatch(CASE_DATA)
  }
  for (const s of log.statuses) if (s !== undefined) expect(s).not.toMatch(ON_SCREEN)
  for (const s of log.toasts) expect(s).not.toMatch(ON_SCREEN)
  expect(bandTexts.length).toBeGreaterThan(2)
  for (const s of bandTexts) expect(s).not.toMatch(ON_SCREEN)
  expect(log.submits).toEqual([])
})

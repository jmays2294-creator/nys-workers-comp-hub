// Engine review, views: every layout preset on every surface and seat, the desk with names hidden for screen
// sharing on every surface and density, and the Pane and band flags the engine may hand over (focused, prompt
// covered, a widget's anchored edges, a collapsed band). Each check is that the surface takes the tree with no
// fallback, keeps the disclaimer and the Close button, and, with names hidden, shows no claimant, WCB number,
// file name or email subject. Fictional data only.
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { COPY } from '../hooks/copy'
import { DEFAULT_PREFS } from '../hooks/prefs'
import { BAND, engine, HUB, PANE, RUN, skillArgs, START, SURFACES } from './engine'
import { CHECKLIST, CHECKLIST_FILE, LETTER, LETTER_FILE, PLUGIN, RATE_MISSING, reply, SLU_OK } from './fixtures'

const SLU = `${PLUGIN}calculate_slu_award`
const RATE = `${PLUGIN}calculate_weekly_rate`
const GMAIL = 'mcp__claude_ai_Gmail__create_draft'
const SUBJECT = 'Hearing reminder for Ms. Example (DEMO)'
const SLU_ARGS = { aww: 1200, date_of_accident: '2024-03-15', body_parts: [{ body_part: 'arm', loss_percent: 25 }], prior_payments: 0 }
const PRIVATE = ['Garcia', 'Baptiste', 'DEMO-0001', 'DEMO-0002', 'letter-to-client', 'Ms. Example', SUBJECT]

function results() {
  return { calculate_slu_award: reply(SLU_OK), calculate_weekly_rate: reply(RATE_MISSING), create_draft: { result: '{}', text: '{}' } }
}

async function fill($: Engine): Promise<void> {
  await $.session.start(START)
  await $.skill.prompt(skillArgs('hearing-prep-checklist'))
  await $.tool.call({ tool: SLU, tool_use_id: 't1', ...SLU_ARGS })
  await $.tool.call({ tool: RATE, tool_use_id: 't2', kind: 'total' })
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  await $.skill.prompt(skillArgs('wc-settlement-offers'))
  await $.tool.call({ tool: 'Write', tool_use_id: 'w2', file_path: LETTER_FILE, content: LETTER })
  await $.tool.call({ tool: GMAIL, tool_use_id: 'g1', subject: SUBJECT, draft_id: 'd1' })
}

const PRESETS = ['desk', 'focus', 'figures', 'glance', 'quiet'] as const

test('V1. every layout preset draws on every surface, narrow to wide, docked and inline, full', async ($, on) => {
  engine(on, { results: results() })
  await fill($)
  for (const preset of PRESETS) {
    await $.command.run({ ...RUN, command: 'comp-desk-layout', args: preset })
    for (const surface of SURFACES) {
      for (const bodyColumns of [24, 47, 60, 140]) {
        for (const placement of ['dock', 'inline'] as const) {
          const where = `${preset} ${surface} ${bodyColumns} ${placement}`
          const ui = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: { ...PANE, bodyColumns, placement } })
          expect([where, (await ui.drawn()).type]).toEqual([where, 'Box'])
          expect([where, (await ui.find({ type: 'Text', text: COPY.deskFailed })) === undefined]).toEqual([where, true])
          expect([where, (await ui.find({ type: 'Text', text: COPY.disclaimer })) !== undefined]).toEqual([where, true])
          expect([where, (await ui.find({ type: 'Button', key: 'close' })) !== undefined]).toEqual([where, true])
          await ui.unmount()
        }
      }
    }
  }
})

for (const density of ['fit', 'comfortable', 'compact'] as const) {
  test(`V2. names hidden (${density}): no claimant, WCB number, file name or subject on any surface, view or width`, async ($, on) => {
    engine(on, { results: results(), store: { prefs: { ...DEFAULT_PREFS, names: 'hide', density } } })
    await fill($)
    for (const surface of SURFACES) {
      for (const bodyColumns of [24, 60, 140]) {
        for (const placement of ['dock', 'inline', 'widget'] as const) {
          const where = `${surface} ${bodyColumns} ${placement}`
          const ui = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: { ...PANE, bodyColumns, placement } })
          const shown = [...await ui.findAll({ type: 'Text' }), ...await ui.findAll({ type: 'Button' })]
            .map(x => `${x.text} ${typeof x.props.label === 'string' ? x.props.label : ''}`)
          for (const word of PRIVATE) expect([where, word, shown.some(t => t.includes(word))]).toEqual([where, word, false])
          if (placement !== 'widget') {
            expect([where, (await ui.find({ type: 'Text', text: COPY.disclaimer })) !== undefined]).toEqual([where, true])
            if (bodyColumns >= 60) {
              await ui.press({ key: 'fig-t1' })
              const figure = (await ui.findAll({ type: 'Text' })).map(x => x.text)
              for (const word of PRIVATE) expect([where, 'figure', word, figure.some(t => t.includes(word))]).toEqual([where, 'figure', word, false])
              await ui.press({ key: 'back' })
            }
          }
          await ui.unmount()
        }
      }
    }
  })
}

test('V3. the flags the engine may hand over: focused, prompt covered, a widget\'s edges, a collapsed band', async ($, on) => {
  engine(on, { results: results() })
  await fill($)
  for (const surface of SURFACES) {
    for (const props of [
      { ...PANE, isFocused: true },
      { ...PANE, isPromptCovered: true as const },
      { ...PANE, placement: 'widget' as const, anchoredEdges: ['bottom', 'right'] as const },
      { ...PANE, placement: 'widget' as const, anchoredEdges: [] as const },
      { ...PANE, bodyColumns: 1 },
      { ...PANE, scroll: { offset: 40, bodyRows: 1 } },
    ]) {
      const where = `${surface} ${JSON.stringify(props).slice(0, 80)}`
      const ui = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props })
      expect([where, ['Box', 'Text'].includes((await ui.drawn()).type)]).toEqual([where, true])
      expect([where, (await ui.find({ type: 'Text', text: COPY.deskFailed })) === undefined]).toEqual([where, true])
      await ui.unmount()
    }
    for (const props of [{ ...BAND, isCollapsed: true }, { ...BAND, maxRows: 1, scroll: { offset: 0, bodyRows: 0 } }, { ...BAND, bodyColumns: 1 }]) {
      const b = await $.ui.mount({ plugin: HUB, surface, component: 'AbovePrompt', props })
      expect([surface, (await b.drawn()).type]).toEqual([surface, 'Box'])
      await b.unmount()
    }
  }
})

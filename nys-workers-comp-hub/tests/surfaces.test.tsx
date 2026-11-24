// Engine review: every view on every surface, from the narrowest dock to a wide one, inline and docked, with
// small and large viewports, empty and full, and with long strings everywhere a person's or the Hub's words land.
// Fictional data only. Each check is that the surface accepts the tree (no fallback), keeps the engine's row
// where there is one, and keeps the lists capped.
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { RenderViewport } from 'claude-code'
import { COPY } from '../hooks/copy'
import { DEFAULT_PREFS } from '../hooks/prefs'
import { BAND, borderOf, engine, HUB, PANE, skillArgs, SURFACES, toolRow } from './engine'
import { CHECKLIST, PLUGIN, RATE_MISSING, reply, SLU_OK } from './fixtures'

const SLU = `${PLUGIN}calculate_slu_award`
const RATE = `${PLUGIN}calculate_weekly_rate`
const GMAIL = 'mcp__claude_ai_Gmail__create_draft'
const SLU_ARGS = { aww: 1200, date_of_accident: '2024-03-15', body_parts: [{ body_part: 'arm', loss_percent: 25 }], prior_payments: 0 }

const WIDTHS = [24, 35, 36, 47, 48, 55, 56, 140] as const
const VIEWPORTS: readonly (RenderViewport | undefined)[] = [
  undefined,
  { columns: 40, rows: 12, isFullscreen: false },
  { columns: 320, rows: 90, isFullscreen: true },
]

// Long, fictional words in every place the desk shows a person's or the Hub's text.
const LONG_NAME = 'A. ' + 'Fictional-Claimant-With-A-Very-Long-Hyphenated-Name '.repeat(4).trim() + ' (DEMO)'
const LONG_PURPOSE = 'Permanency (SLU) ' + 'and a long description of what the hearing is for '.repeat(3).trim()
const LONG_SUBJECT = 'Hearing reminder (DEMO) ' + 'with a subject line that keeps going '.repeat(10)
const LONG_DOC = '/x/' + 'matter-folder-with-a-long-name/'.repeat(6) + 'response-to-the-settlement-offer-for-the-attorney-to-review-DEMO.md'
const LONG_MESSAGE = 'A required input is missing. ' + 'The Hub explains in plain words which input it needs and why it needs it. '.repeat(12)

function longChecklist(): string {
  const extra: string[] = []
  for (let n = 3; n <= 14; n += 1) {
    extra.push(`## ${n}. ${LONG_NAME} · WCB DEMO-00${String(n).padStart(2, '0')} · 12/03/2026 ${n}:00 PM · ${LONG_PURPOSE}`, '',
      '### Forms and filings', '- [ ] A fictional item to prepare.', '  - Source: `demo.md` line 1: "fictional"', '  - Rule: a fictional rule (verify)', '')
  }
  return CHECKLIST.replace('A. Garcia (DEMO)', LONG_NAME).replace('## Odd text in the files', `${extra.join('\n')}\n## Odd text in the files`)
}

const CHECKLIST_LONG = longChecklist()
const CHECKLIST_LONG_FILE = '/x/hearing-checklist-2026-12-03.md'
const RATE_LONG = { ...RATE_MISSING, message: LONG_MESSAGE }

async function fill($: Engine): Promise<void> {
  await $.skill.prompt(skillArgs('hearing-prep-checklist'))
  await $.tool.call({ tool: SLU, tool_use_id: 't1', ...SLU_ARGS })
  await $.tool.call({ tool: RATE, tool_use_id: 't2', kind: 'total' })
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_LONG_FILE, content: CHECKLIST_LONG })
  await $.tool.call({ tool: 'Write', tool_use_id: 'w2', file_path: LONG_DOC, content: 'A fictional response for the attorney to review.' })
  await $.tool.call({ tool: GMAIL, tool_use_id: 'g1', subject: LONG_SUBJECT, draft_id: 'd1' })
}

function results() {
  return { calculate_slu_award: reply(SLU_OK), calculate_weekly_rate: reply(RATE_LONG), create_draft: { result: '{}', text: '{}' } }
}

for (const isFull of [false, true]) {
  for (const density of ['fit', 'comfortable', 'compact'] as const) {
    test(`S1. the desk, ${isFull ? 'full, long strings' : 'empty'}, ${density}: every surface, width, seat and viewport`, async ($, on) => {
      engine(on, { results: results(), store: { prefs: { ...DEFAULT_PREFS, density } } })
      if (isFull) await fill($)
      for (const surface of SURFACES) {
        for (const bodyColumns of WIDTHS) {
          for (const placement of ['dock', 'inline'] as const) {
            for (const viewport of VIEWPORTS) {
              const ui = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: { ...PANE, bodyColumns, placement }, ...(viewport === undefined ? {} : { viewport }) })
              const where = `${surface} ${bodyColumns} ${placement} ${viewport?.columns ?? '-'}`
              expect([where, (await ui.drawn()).type]).toEqual([where, 'Box'])
              expect([where, (await ui.find({ type: 'Text', text: COPY.disclaimer }))?.text]).toEqual([where, COPY.disclaimer])
              expect([where, 'close', (await ui.find({ type: 'Button', key: 'close' })) !== undefined]).toEqual([where, 'close', true])
              const texts = await ui.findAll({ type: 'Text' })
              expect([where, 'fallback', texts.some(t => t.text === COPY.deskFailed)]).toEqual([where, 'fallback', false])
              if (isFull) {
                // Hearings stay capped: at most 12 drawn.
                const hearingLines = texts.filter(t => !t.text.startsWith('First ') && t.text.includes('12/03/2026') && /\d:\d\d [AP]M/.test(t.text))
                expect([where, 'hearings shown', hearingLines.length <= 12]).toEqual([where, 'hearings shown', true])
                // The email subject is cut to 120 on the desk.
                for (const t of texts) expect([where, 'subject cut', t.text.includes(LONG_SUBJECT.slice(0, 121))]).toEqual([where, 'subject cut', false])
              }
              await ui.unmount()
            }
          }
        }
        const w = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: { ...PANE, placement: 'widget' } })
        expect((await w.findAll({ type: 'Text' })).length).toBe(1)
        expect(await w.find({ type: 'Button' })).toBeUndefined()
        await w.unmount()
      }
    })
  }
}

test('S2. the figure and customize views, narrowest and widest, long Hub text, every surface', async ($, on) => {
  engine(on, { results: results() })
  await fill($)
  for (const surface of SURFACES) {
    for (const bodyColumns of [24, 140]) {
      const ui = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: { ...PANE, bodyColumns } })
      await ui.press({ key: 'customize' })
      expect((await ui.drawn()).type).toBe('Box')
      expect(await ui.find({ type: 'Text', text: COPY.cHeading })).toBeDefined()
      expect((await ui.findAll({ type: 'Button' })).length).toBeGreaterThan(20)
      await ui.press({ key: 'done' })
      await ui.press({ key: 'fig-t1' })
      expect((await ui.drawn()).type).toBe('Box')
      expect(await ui.find({ type: 'Text', text: COPY.headInputs })).toBeDefined()
      await ui.press({ key: 'back' })
      expect(await ui.find({ type: 'Text', text: COPY.disclaimer })).toBeDefined()
      await ui.unmount()
    }
  }
})

test('S3. the band, narrow to wide, and silent while a survey or a turn holds it', async ($, on) => {
  engine(on, { results: results() })
  await fill($)
  for (const surface of SURFACES) {
    for (const bodyColumns of [12, 20, 49, 50, 200]) {
      const b = await $.ui.mount({ plugin: HUB, surface, component: 'AbovePrompt', props: { ...BAND, bodyColumns } })
      expect((await b.drawn()).type).toBe('Box')
      expect(await b.find({ type: 'Button', key: 'band-hide' })).toBeDefined()
      for (const t of await b.findAll({ type: 'Text' })) expect(t.props.wrap).toBe('truncate-end')
      await b.unmount()
    }
    for (const quiet of [{ hasSurvey: true }, { isWorking: true }]) {
      const b = await $.ui.mount({ plugin: HUB, surface, component: 'AbovePrompt', props: { ...BAND, ...quiet } })
      expect(await b.find({ type: 'Button' })).toBeUndefined()
      await b.unmount()
    }
  }
})

for (const cards of ['full', 'compact'] as const) {
  test(`S4. cards (${cards}) with long Hub text keep the row on every surface; expanded and running rows are left alone`, async ($, on) => {
    engine(on, { results: results() })
    await fill($)
    if (cards === 'compact') await $.command.run({ origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 }, command: 'comp-desk-layout', args: 'cards compact' })
    const rows = [
      { tool: SLU, id: 't1', input: SLU_ARGS, output: reply(SLU_OK).text },
      { tool: RATE, id: 't2', input: { kind: 'total' }, output: reply(RATE_LONG).text },
      { tool: 'Write', id: 'w1', input: { file_path: CHECKLIST_LONG_FILE, content: CHECKLIST_LONG }, output: {} },
      { tool: 'Write', id: 'w2', input: { file_path: LONG_DOC, content: 'x' }, output: {} },
      { tool: GMAIL, id: 'g1', input: { subject: LONG_SUBJECT }, output: '{}' },
    ]
    for (const surface of SURFACES) {
      for (const r of rows) {
        const ui = await $.ui.mount({ plugin: HUB, surface, component: 'ToolUse', requestId: r.id, props: toolRow(r.tool, r.id, r.input, { output: r.output }) })
        expect([surface, r.id, await ui.keepsBeneath()]).toEqual([surface, r.id, true])
        const root = await ui.drawn()
        expect([surface, r.id, root.type]).toEqual([surface, r.id, 'Box'])
        // A card never shows a file name, a path, a subject or a claimant name.
        for (const t of await ui.findAll({ type: 'Text' })) {
          expect([surface, r.id, /Fictional-Claimant|matter-folder|with a subject line|hearing-checklist-/.test(t.text)]).toEqual([surface, r.id, false])
        }
        if (cards === 'compact') expect([surface, r.id, borderOf(root)]).toEqual([surface, r.id, undefined])
        await ui.unmount()
        for (const extra of [{ isExpanded: true, output: r.output }, { isRunning: true }]) {
          const quiet = await $.ui.mount({ plugin: HUB, surface, component: 'ToolUse', requestId: r.id, props: toolRow(r.tool, r.id, r.input, extra) })
          expect(await quiet.keepsBeneath()).toBe(true)
          expect(borderOf(await quiet.drawn())).toBeUndefined()
          expect(await quiet.find({ type: 'Button' })).toBeUndefined()
          await quiet.unmount()
        }
      }
    }
  })
}

test('S5. the right-click rows with an 80-character selection and a Hub figure row', async ($, on) => {
  engine(on, { results: results() })
  await fill($)
  for (const [selection, keys] of [['x'.repeat(80), ['menu-copy', 'menu-ask', 'menu-define']], ['C-4.3', ['menu-copy', 'menu-ask', 'menu-form']]] as const) {
    const ui = await $.ui.mount({ plugin: HUB, surface: 'desktop', component: 'ContextMenu', props: { row: { component: 'ToolUse', requestId: 't1' }, selection: { text: selection } } })
    const buttons = await ui.findAll({ type: 'Button' })
    expect(buttons.length).toBeLessThanOrEqual(3)
    expect(buttons.map(b => b.key)).toEqual([...keys])
    await ui.unmount()
  }
})

import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { COPY } from '../hooks/copy'
import { BAND, engine, HUB, PANE, skillArgs, SURFACES, toolRow } from './engine'
import { CHECKLIST, CHECKLIST_FILE, LETTER, LETTER_FILE, NOTE_ID, NOTE_ONE, NOTES_LIST, PLUGIN, RATE_MISSING, reply, SLU_OK, WS_STATUS } from './fixtures'

const SLU = `${PLUGIN}calculate_slu_award`
const RATE = `${PLUGIN}calculate_weekly_rate`
const GMAIL = 'mcp__claude_ai_Gmail__create_draft'
const SLU_ARGS = { aww: 1200, date_of_accident: '2024-03-15', body_parts: [{ body_part: 'arm', loss_percent: 25 }], prior_payments: 0 }
const WIDTHS = [60, 48, 30]

async function fill($: Engine): Promise<void> {
  await $.skill.prompt(skillArgs('hearing-prep-checklist'))
  await $.tool.call({ tool: SLU, tool_use_id: 't1', ...SLU_ARGS })
  await $.tool.call({ tool: RATE, tool_use_id: 't2', kind: 'total' })
  await $.tool.call({ tool: `${PLUGIN}list_hearing_notes`, tool_use_id: 't3' })
  await $.tool.call({ tool: `${PLUGIN}get_hearing_note`, tool_use_id: 't4', id: NOTE_ID })
  await $.tool.call({ tool: `${PLUGIN}get_import_status`, tool_use_id: 't5', keys: [] })
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  await $.tool.call({ tool: 'Write', tool_use_id: 'w2', file_path: LETTER_FILE, content: LETTER })
  await $.tool.call({ tool: GMAIL, tool_use_id: 'g1', subject: 'Hearing reminder (DEMO)', draft_id: 'd1' })
}

for (const isFull of [false, true]) {
  test(`every view draws on all four surfaces, ${isFull ? 'full' : 'empty'}`, async ($, on) => {
    engine(on, {
      results: {
        calculate_slu_award: reply(SLU_OK), calculate_weekly_rate: reply(RATE_MISSING), list_hearing_notes: reply(NOTES_LIST),
        get_hearing_note: reply(NOTE_ONE), get_import_status: reply(WS_STATUS), create_draft: { result: '{}', text: '{}' },
      },
    })
    if (isFull) await fill($)
    for (const surface of SURFACES) {
      for (const bodyColumns of WIDTHS) {
        const ui = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: { ...PANE, bodyColumns } })
        expect((await ui.drawn()).type).toBe('Box')
        expect(await ui.find({ type: 'Text', text: COPY.disclaimer })).toBeDefined()
        if (isFull) {
          expect(await ui.find({ type: 'Text', text: COPY.headline(0, 0, 0, 0) })).toBeUndefined()
          if (bodyColumns >= 36) {
            expect(await ui.find({ type: 'Text', text: COPY.notesLine(3, 1) })).toBeDefined()
            expect(await ui.find({ type: 'Text', text: COPY.importsReview(1) })).toBeDefined()
          }
        }
        await ui.press({ key: 'customize' })
        expect(await ui.find({ type: 'Text', text: COPY.cHeading })).toBeDefined()
        await ui.press({ key: 'done' })
        if (isFull) {
          await ui.press({ key: 'fig-t1' })
          expect(await ui.find({ type: 'Text', text: COPY.headCitations })).toBeDefined()
          expect(await ui.find({ type: 'Text', text: COPY.headNotes })).toBeDefined()
          await ui.press({ key: 'back' })
        }
        await ui.unmount()
      }
      const w = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: { ...PANE, placement: 'widget' } })
      expect((await w.findAll({ type: 'Text' })).length).toBe(1)
      await w.unmount()
      for (const bodyColumns of [80, 40]) {
        const b = await $.ui.mount({ plugin: HUB, surface, component: 'AbovePrompt', props: { ...BAND, bodyColumns } })
        expect(await b.find({ type: 'Button' }) !== undefined).toBe(isFull)
        await b.unmount()
      }
      const rows = [
        { tool: SLU, id: 't1', input: SLU_ARGS, output: reply(SLU_OK).text, text: COPY.cardEyebrow },
        { tool: RATE, id: 't2', input: { kind: 'total' }, output: reply(RATE_MISSING).text, text: COPY.nothingCalculated },
        { tool: `${PLUGIN}get_hearing_note`, id: 't4', input: { id: NOTE_ID }, output: reply(NOTE_ONE).text, text: COPY.noteReadyCard },
        { tool: 'Write', id: 'w1', input: { file_path: CHECKLIST_FILE, content: CHECKLIST }, output: {}, text: COPY.checklistCardTitle },
        { tool: 'Write', id: 'w2', input: { file_path: LETTER_FILE, content: LETTER }, output: {}, text: COPY.documentCard },
        { tool: GMAIL, id: 'g1', input: { subject: 'x' }, output: '{}', text: COPY.emailCard },
      ]
      for (const r of rows) {
        const ui = await $.ui.mount({ plugin: HUB, surface, component: 'ToolUse', requestId: r.id, props: toolRow(r.tool, r.id, r.input, { output: r.output }) })
        expect(await ui.keepsBeneath()).toBe(true)
        const found = await ui.find({ type: 'Text', text: r.text })
        // Calculator and checklist cards read the row's own output too; the rest need this session's record.
        const isFromOutput = r.tool !== GMAIL && r.id !== 'w2'
        expect(found !== undefined).toBe(isFull || isFromOutput)
        await ui.unmount()
      }
    }
  })
}

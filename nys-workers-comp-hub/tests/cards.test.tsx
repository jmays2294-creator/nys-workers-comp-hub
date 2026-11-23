import { expect, test } from 'claude-code/testing'
import { COPY } from '../hooks/copy'
import { borderOf, engine, HUB, RUN, skillArgs, START, SURFACES, toolRow } from './engine'
import { CASELAW_NOTFOUND, CHECKLIST, CHECKLIST_FILE, LETTER, LETTER_FILE, PLUGIN, RATE_MISSING, reply, SLU_OK } from './fixtures'

const SLU = `${PLUGIN}calculate_slu_award`
const SLU_ARGS = { aww: 1200, date_of_accident: '2024-03-15', body_parts: [{ body_part: 'arm', loss_percent: 25 }], prior_payments: 0 }
const FIGURES_NOTICE = (SLU_OK.notice as Record<string, string>).figures ?? ''
const SECRET = /Garcia|Baptiste|DEMO-0001|hearing-checklist-/

function card(surface: (typeof SURFACES)[number], tool: string, id: string, input: unknown, extra: Record<string, unknown> = {}) {
  return { plugin: HUB, surface, component: 'ToolUse', requestId: id, props: toolRow(tool, id, input, extra) } as const
}

test('18. the full card under an SLU call keeps the row and shows the figure with its inputs', async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  await $.tool.call({ tool: SLU, tool_use_id: 't1', ...SLU_ARGS })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(card(surface, SLU, 't1', SLU_ARGS, { output: reply(SLU_OK).text }))
    expect(await ui.keepsBeneath()).toBe(true)
    const root = await ui.drawn()
    expect(root.type).toBe('Box')
    expect(borderOf(root)).toBe('round')
    expect(await ui.find({ type: 'Text', text: COPY.cardEyebrow })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Schedule loss of use award' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\$62,400\.00/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Inputs: AWW 1200/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: FIGURES_NOTICE })).toBeDefined()
    await ui.unmount()
  }
})

test('19. an expanded or running row is left as the engine draws it', async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  await $.tool.call({ tool: SLU, tool_use_id: 't1', ...SLU_ARGS })
  for (const surface of SURFACES) {
    for (const extra of [{ isExpanded: true, output: reply(SLU_OK).text }, { isRunning: true }]) {
      const ui = await $.ui.mount(card(surface, SLU, 't1', SLU_ARGS, extra))
      expect(await ui.keepsBeneath()).toBe(true)
      expect(await ui.find({ type: 'Text', text: COPY.cardEyebrow })).toBeUndefined()
      expect(borderOf(await ui.drawn())).toBeUndefined()
      await ui.unmount()
    }
  }
})

test('20. How it was made opens the Hub steps and closes them again', async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  await $.tool.call({ tool: SLU, tool_use_id: 't1', ...SLU_ARGS })
  const step = '8. Award: total weeks × weekly rate, to the cent: $62,400.00'
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(card(surface, SLU, 't1', SLU_ARGS, { output: reply(SLU_OK).text }))
    expect(await ui.find({ type: 'Text', text: step })).toBeUndefined()
    await ui.press({ key: 'card-steps-t1' })
    expect((await ui.find({ type: 'Text', text: step }))?.text).toBe(step)
    expect((await ui.find({ type: 'Button', key: 'card-steps-t1' }))?.props.label).toBe(COPY.hideHow)
    await ui.press({ key: 'card-steps-t1' })
    expect(await ui.find({ type: 'Text', text: step })).toBeUndefined()
    await ui.unmount()
  }
})

test('21. after a resume, the card is read from the row stored output in each shape', async ($, on) => {
  engine(on)
  const text = reply(SLU_OK).text
  const outputs: unknown[] = [text, [{ type: 'text', text }], { structuredContent: SLU_OK }]
  for (const surface of SURFACES) {
    for (const [i, output] of outputs.entries()) {
      const ui = await $.ui.mount(card(surface, SLU, `old-${i}`, SLU_ARGS, { output }))
      expect(await ui.find({ type: 'Text', text: COPY.cardEyebrow })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /\$62,400\.00/ })).toBeDefined()
      await ui.unmount()
    }
  }
})

test('22. compact cards: one quiet line with the first figure, no border', async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  await $.session.start(START)
  await $.command.run({ ...RUN, command: 'comp-desk-layout', args: 'cards compact' })
  await $.tool.call({ tool: SLU, tool_use_id: 't1', ...SLU_ARGS })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(card(surface, SLU, 't1', SLU_ARGS, { output: reply(SLU_OK).text }))
    expect(borderOf(await ui.drawn())).toBeUndefined()
    expect((await ui.find({ type: 'Text', text: /Hub estimate/ }))?.text).toBe('Schedule loss of use award: Award $62,400.00 (Hub estimate)')
    await ui.unmount()
  }
})

test('23. cards off: the row only', async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  await $.session.start(START)
  await $.command.run({ ...RUN, command: 'comp-desk-layout', args: 'cards off' })
  await $.tool.call({ tool: SLU, tool_use_id: 't1', ...SLU_ARGS })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(card(surface, SLU, 't1', SLU_ARGS, { output: reply(SLU_OK).text }))
    expect(await ui.keepsBeneath()).toBe(true)
    expect(await ui.find({ type: 'Text', text: /Hub estimate|calculator/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('24. a reference tool that found nothing: the Hub message as one quiet line', async ($, on) => {
  engine(on)
  const tool = `${PLUGIN}search_case_law`
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(card(surface, tool, 'q1', { query: 'x' }, { isErrored: true, output: reply(CASELAW_NOTFOUND).text }))
    expect((await ui.find({ type: 'Text', text: /^No case/ }))?.text).toBe(CASELAW_NOTFOUND.message)
    expect(borderOf(await ui.drawn())).toBeUndefined()
    await ui.unmount()
  }
})

test('24b. a refused calculator: the full card says nothing was calculated and offers the missing input', async ($, on) => {
  const log = engine(on, { results: { calculate_weekly_rate: reply(RATE_MISSING) } })
  const tool = `${PLUGIN}calculate_weekly_rate`
  await $.tool.call({ tool, tool_use_id: 'm1', kind: 'total' })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(card(surface, tool, 'm1', { kind: 'total' }, { isErrored: true, output: reply(RATE_MISSING).text }))
    expect(await ui.find({ type: 'Text', text: COPY.nothingCalculated })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Missing: AWW' })).toBeDefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount(card('desktop', tool, 'm1', { kind: 'total' }, { output: reply(RATE_MISSING).text }))
  await ui.press({ key: 'card-missing-m1' })
  expect(log.fills).toEqual([{ text: 'Calculate the weekly benefit rate again with AWW: ', mode: 'replace' }])
  await ui.unmount()
})

test('25. a checklist Write: a bordered card with counts only, and Open the desk', async ($, on) => {
  const log = engine(on)
  const input = { file_path: CHECKLIST_FILE, content: CHECKLIST }
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', ...input })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(card(surface, 'Write', 'w1', input, { output: {} }))
    expect(borderOf(await ui.drawn())).toBe('round')
    expect(await ui.find({ type: 'Text', text: COPY.checklistCardTitle })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /2 hearings · 21 open · 8 to verify/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: COPY.draftsOnlyLine })).toBeDefined()
    for (const t of await ui.findAll({ type: 'Text' })) expect(t.text).not.toMatch(SECRET)
    await ui.unmount()
  }
  const ui = await $.ui.mount(card('terminal', 'Write', 'w1', input, { output: {} }))
  await ui.press({ key: 'dc-open-w1' })
  expect(log.opened).toEqual(['comp-desk'])
  expect(log.focused).toEqual([true])
  await ui.unmount()
})

test('26. a letter written during a drafting skill: a quiet note, never its file name', async ($, on) => {
  engine(on)
  await $.skill.prompt(skillArgs('wc-settlement-offers'))
  const input = { file_path: LETTER_FILE, content: LETTER }
  await $.tool.call({ tool: 'Write', tool_use_id: 'w2', ...input })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(card(surface, 'Write', 'w2', input, { output: {} }))
    expect((await ui.find({ type: 'Text', text: COPY.documentCard }))?.text).toBe(COPY.documentCard)
    for (const t of await ui.findAll({ type: 'Text' })) expect(t.text).not.toContain('letter-to-client')
    await ui.unmount()
  }
})

test('27. an email draft during Hub work: an unsent note, never its subject', async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_OK), create_draft: { result: '{"id":"d1"}', text: '{"id":"d1"}' } } })
  await $.tool.call({ tool: SLU, tool_use_id: 't1', ...SLU_ARGS })
  const tool = 'mcp__claude_ai_Gmail__create_draft'
  const input = { subject: 'Hearing reminder (DEMO)', body: 'x' }
  await $.tool.call({ tool, tool_use_id: 'e1', ...input })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(card(surface, tool, 'e1', input, { output: '{"id":"d1"}' }))
    expect((await ui.find({ type: 'Text', text: COPY.emailCard }))?.text).toBe(COPY.emailCard)
    for (const t of await ui.findAll({ type: 'Text' })) expect(t.text).not.toContain('Hearing reminder')
    await ui.unmount()
  }
})

test('28. a Write that is no draft: the row only', async ($, on) => {
  engine(on)
  await $.skill.prompt(skillArgs('wc-settlement-offers'))
  const input = { file_path: '/x/a.ts', content: 'export {}' }
  await $.tool.call({ tool: 'Write', tool_use_id: 'w3', ...input })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(card(surface, 'Write', 'w3', input, { output: {} }))
    expect(await ui.keepsBeneath()).toBe(true)
    expect(await ui.find({ type: 'Text', text: COPY.documentCard })).toBeUndefined()
    await ui.unmount()
  }
})

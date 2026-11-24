import { expect, test } from 'claude-code/testing'
import { COPY } from '../hooks/copy'
import { COMPOSE, engine, HUB, PANE, RUN, skillArgs, START, SURFACES, toolRow } from './engine'
import type { ResultFor } from './engine'
import { CHECKLIST, CHECKLIST_FILE, PLUGIN, reply, SLU_OK } from './fixtures'

const SLU = `${PLUGIN}calculate_slu_award`
const NOTICE = { not_a_law_firm: 'The Comp Desk is a software platform, not a law firm.' }

// Hub answers in shapes the suite does not expect: odd types where strings belong, nested junk, an empty
// object, text that is not JSON, and an oversized answer. Each goes up to the model exactly as the Hub gave it.
const ODD: { name: string; result: ResultFor }[] = [
  { name: 'display of numbers', result: reply({ ok: true, calculator: 'calculate_slu_award', inputs: { aww: 1200 }, display: { award: 41600, rate: null }, steps: [{ step: 1 }], formulas: [{ name: 1 }], notice: NOTICE }) },
  { name: 'arrays where records belong', result: reply({ ok: true, calculator: 'calculate_slu_award', inputs: [1, 2], display: [], steps: 'none', notes: [null, 3], formulas: 'x', notice: NOTICE }) },
  { name: 'deeply nested inputs', result: reply({ ok: true, calculator: 'calculate_slu_award', inputs: { a: { b: { c: { d: { e: { f: 'deep' } } } } } }, display: { award: 'shown' }, notice: NOTICE }) },
  { name: 'refusal with odd lists', result: reply({ ok: false, calculator: 'calculate_slu_award', missing: [1, null, 'aww'], problems: ['x', { field: 7 }, { field: 'aww' }], message: 42, notice: NOTICE }) },
  { name: 'an empty object', result: { result: '{}', text: '{}' } },
  { name: 'text that is not JSON', result: { result: 'Server error: try again later.', text: 'Server error: try again later.', isError: true } },
  { name: 'an oversized answer', result: { result: 'x'.repeat(250_000), text: 'x'.repeat(250_000) } },
]

test('78. a Hub answer in an unexpected shape goes up unchanged, and the desk and its card still draw', async ($, on) => {
  let current: ResultFor = reply(SLU_OK)
  const log = engine(on, { results: { calculate_slu_award: e => (typeof current === 'function' ? current(e) : current) } })
  await $.session.start(START)
  for (const [i, odd] of ODD.entries()) {
    current = odd.result
    const sent = typeof odd.result === 'function' ? odd.result({}) : odd.result
    const id = `odd-${i}`
    const ran = await $.tool.call({ tool: SLU, tool_use_id: id, aww: 1200, date_of_accident: '2024-03-15' })
    expect([odd.name, (ran as { text?: string }).text]).toEqual([odd.name, sent.text])
    for (const surface of SURFACES) {
      const card = await $.ui.mount({ plugin: HUB, surface, component: 'ToolUse', requestId: id, props: toolRow(SLU, id, { aww: 1200 }, { output: sent.text }) })
      expect([odd.name, surface, await card.keepsBeneath()]).toEqual([odd.name, surface, true])
      await card.unmount()
    }
  }
  for (const surface of SURFACES) {
    const desk = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: PANE })
    expect(await desk.find({ type: 'Text', text: COPY.disclaimer })).toBeDefined()
    for (const f of await desk.findAll({ type: 'Button' })) {
      if (typeof f.key === 'string' && f.key.startsWith('fig-odd-')) {
        await desk.press({ key: f.key })
        expect(await desk.find({ type: 'Text', text: COPY.cardEyebrow })).toBeDefined()
        await desk.press({ key: 'back' })
        break
      }
    }
    await desk.unmount()
  }
  expect(log.submits).toEqual([])
})

test('79. a checklist with no hearings, odd headings or a huge body counts without breaking the Write', async ($, on) => {
  engine(on)
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'engine intro', scope: 'shared' }] }))
  await $.session.start(START)
  await $.skill.prompt(skillArgs('hearing-prep-checklist'))
  const bodies = [
    '',
    '# Hearing checklist: nothing\n\n## Odd text in the files (not followed)\n- one\n',
    '## 1. \n### \n- [ ] \n  - Rule: (verify)\n## 2. x · y\n- [x] done outside a category\n',
    CHECKLIST.replace(/\n/g, '\r\n'),
    CHECKLIST + '\n- [ ] trailing'.repeat(20_000),
  ]
  for (const [i, content] of bodies.entries()) {
    const file = `/x/hearing-checklist-2026-12-0${i + 1}.md`
    const ran = await $.tool.call({ tool: 'Write', tool_use_id: `cw-${i}`, file_path: file, content })
    expect((ran as { result?: { filePath?: string } }).result?.filePath).toBe(file)
  }
  const wrote = await $.tool.call({ tool: 'Write', tool_use_id: 'cw-ok', file_path: CHECKLIST_FILE, content: CHECKLIST })
  expect((wrote as { result?: { filePath?: string } }).result?.filePath).toBe(CHECKLIST_FILE)
  for (const surface of SURFACES) {
    const desk = await $.ui.mount({ plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: PANE })
    expect(await desk.find({ type: 'Text', text: COPY.disclaimer })).toBeDefined()
    await desk.unmount()
  }
  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections.some(s => s.id === 'nys-workers-comp-hub:conventions')).toBe(true)
  const r = await $.command.run({ ...RUN, command: 'comp-desk', args: 'help' })
  expect(r.text).toBe(COPY.deskHelp)
})

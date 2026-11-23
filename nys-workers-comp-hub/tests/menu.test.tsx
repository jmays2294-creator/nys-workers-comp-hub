import { expect, test } from 'claude-code/testing'
import type { Figure } from '../types'
import { COPY } from '../hooks/copy'
import { copyText } from '../hooks/hub'
import { engine, HUB, PEEK, peek, SURFACES } from './engine'
import { PLUGIN, reply, SLU_OK } from './fixtures'

const MENU = { plugin: HUB, surface: 'desktop', component: 'ContextMenu' } as const

test('70. a selected WCB form: look it up, or define it', async ($, on) => {
  const log = engine(on)
  const ui = await $.ui.mount({ ...MENU, props: { selection: { text: ' C-4.3 ' } } })
  expect((await ui.findAll({ type: 'Button' })).map(b => b.key)).toEqual(['menu-form', 'menu-define'])
  await ui.press({ key: 'menu-form' })
  expect(log.fills).toEqual([{ text: COPY.fillForm('C-4.3'), mode: 'insert' }])
  await ui.unmount()
})

test('71. a selected date: the maximum and minimum rate for it', async ($, on) => {
  const log = engine(on)
  const ui = await $.ui.mount({ ...MENU, props: { selection: { text: 'DOA 03/15/2024' } } })
  expect((await ui.findAll({ type: 'Button' })).map(b => b.key)).toEqual(['menu-rate', 'menu-define'])
  await ui.press({ key: 'menu-rate' })
  expect(log.fills).toEqual([{ text: '/nys-workers-comp-hub:max-rate 03/15/2024', mode: 'insert' }])
  await ui.unmount()
})

test('72. a Hub figure row: copy it with its inputs, or ask about it', { plugins: [PEEK] }, async ($, on) => {
  const log = engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  await $.tool.call({ tool: `${PLUGIN}calculate_slu_award`, tool_use_id: 't1', aww: 1200 })
  const f = (await peek<Figure[]>($, 'figures'))[0]
  if (f === undefined) throw new Error('no figure')
  const ui = await $.ui.mount({ ...MENU, props: { row: { component: 'ToolUse', requestId: 't1' } } })
  expect((await ui.findAll({ type: 'Button' })).map(b => b.key)).toEqual(['menu-copy', 'menu-ask'])
  await ui.press({ key: 'menu-copy' })
  expect(log.copies).toEqual([copyText(f)])
  await ui.press({ key: 'menu-ask' })
  expect(log.fills).toEqual([{ text: COPY.fillAskFigure('Schedule loss of use award'), mode: 'insert' }])
  await ui.unmount()
})

test('73. rows off in /config, a long selection, or another surface: none', { options: { menu_rows: false } }, async ($, on) => {
  engine(on)
  const ui = await $.ui.mount({ ...MENU, props: { selection: { text: 'AWW' } } })
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  await ui.unmount()
})

test('73b. a long or multi-line selection gets no row; other surfaces get none', async ($, on) => {
  engine(on)
  for (const text of ['x'.repeat(200), 'one\ntwo']) {
    const ui = await $.ui.mount({ ...MENU, props: { selection: { text } } })
    expect(await ui.find({ type: 'Button' })).toBeUndefined()
    await ui.unmount()
  }
  for (const surface of SURFACES.filter(s => s !== 'desktop')) {
    const ui = await $.ui.mount({ ...MENU, surface, props: { selection: { text: 'AWW' } } })
    expect(await ui.find({ type: 'Button' })).toBeUndefined()
    await ui.unmount()
  }
})

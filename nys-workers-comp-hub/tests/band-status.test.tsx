import { expect, test } from 'claude-code/testing'
import { COPY } from '../hooks/copy'
import { BAND, engine, HUB, RUN, START, SURFACES } from './engine'
import { CHECKLIST, CHECKLIST_FILE, LETTER, LETTER_FILE, PLUGIN, RATE_MISSING, reply, SLU_OK } from './fixtures'

const SLU = `${PLUGIN}calculate_slu_award`
type Surface = (typeof SURFACES)[number]

function band(surface: Surface, props: Record<string, unknown> = {}) {
  return { plugin: HUB, surface, component: 'AbovePrompt', props: { ...BAND, ...props } } as const
}

test('56. no activity: no row', async ($, on) => {
  engine(on)
  await $.session.start(START)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(band(surface))
    expect(await ui.find({ type: 'Button' })).toBeUndefined()
    expect(await ui.keepsBeneath()).toBe(true)
    await ui.unmount()
  }
})

test('57. after a checklist: counts, Open the desk and Hide; a new draft brings the row back', async ($, on) => {
  engine(on)
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(band(surface))
    expect((await ui.find({ type: 'Text' }))?.text).toBe('1 draft for your review · 8 items to verify')
    expect(await ui.find({ type: 'Button', key: 'band-open' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'band-hide' })).toBeDefined()
    await ui.unmount()
    const narrow = await $.ui.mount(band(surface, { bodyColumns: 40 }))
    expect((await narrow.find({ type: 'Text' }))?.text).toBe('1 for review · 8 to verify')
    await narrow.unmount()
  }
  const ui = await $.ui.mount(band('terminal'))
  await ui.press({ key: 'band-hide' })
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  await ui.unmount()
  await $.tool.call({ tool: 'Write', tool_use_id: 'l1', file_path: LETTER_FILE, content: LETTER })
  for (const surface of SURFACES) {
    const again = await $.ui.mount(band(surface))
    expect((await again.find({ type: 'Text' }))?.text).toBe('2 drafts for your review · 8 items to verify')
    await again.unmount()
  }
})

test('58. quiet while a turn runs, under a survey, with the desk open, and in the Quiet layout', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  for (const surface of SURFACES) {
    for (const props of [{ isWorking: true }, { hasSurvey: true }]) {
      const ui = await $.ui.mount(band(surface, props))
      expect(await ui.find({ type: 'Button' })).toBeUndefined()
      await ui.unmount()
    }
  }
  await $.command.run({ ...RUN, command: 'comp-desk', args: '' })
  const open = await $.ui.mount(band('desktop'))
  expect(await open.find({ type: 'Button' })).toBeUndefined()
  await open.unmount()
  await $.command.run({ ...RUN, command: 'comp-desk', args: 'close' })
  const closed = await $.ui.mount(band('desktop'))
  expect(await closed.find({ type: 'Button', key: 'band-open' })).toBeDefined()
  await closed.unmount()
  await $.command.run({ ...RUN, command: 'comp-desk-layout', args: 'quiet' })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(band(surface))
    expect(await ui.find({ type: 'Button' })).toBeUndefined()
    await ui.unmount()
  }
})

test('59. a refused calculation comes first, and Add it fills the request', async ($, on) => {
  const log = engine(on, { results: { calculate_weekly_rate: reply(RATE_MISSING) } })
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  await $.tool.call({ tool: `${PLUGIN}calculate_weekly_rate`, tool_use_id: 'm1', kind: 'total' })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(band(surface))
    expect((await ui.find({ type: 'Text' }))?.text).toBe(COPY.bandRefused('Weekly benefit rate', ['AWW'], []))
    await ui.press({ key: 'band-missing' })
    await ui.unmount()
  }
  expect(log.fills.map(f => f.text)).toEqual(SURFACES.map(() => 'Calculate the weekly benefit rate again with AWW: '))
})

test('60. the offer: once per session, Not now keeps it away', async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  await $.session.start(START)
  await $.tool.call({ tool: SLU, tool_use_id: 't1', aww: 1200 })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(band(surface))
    expect((await ui.find({ type: 'Text' }))?.text).toBe(COPY.bandOffer)
    expect(await ui.find({ type: 'Button', key: 'band-open' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'band-not-now' })).toBeDefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount(band('mobile'))
  await ui.press({ key: 'band-not-now' })
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  await ui.unmount()
  await $.tool.call({ tool: SLU, tool_use_id: 't2', aww: 1200 })
  const after = await $.ui.mount(band('mobile'))
  expect(await after.find({ type: 'Button' })).toBeUndefined()
  await after.unmount()
})

test('60b. open on Hub work: no offer; the desk opens once, unasked, without the keyboard', { options: { open_desk: 'on-hub-work' } }, async ($, on) => {
  const log = engine(on, { results: { calculate_slu_award: reply(SLU_OK) }, uiOpen: { isPlaced: false, reason: 'narrow' } })
  await $.session.start(START)
  await $.tool.call({ tool: SLU, tool_use_id: 't1', aww: 1200 })
  await $.tool.call({ tool: SLU, tool_use_id: 't2', aww: 1200 })
  expect(log.opened).toEqual(['comp-desk'])
  expect(log.focused).toEqual([false])
  const ui = await $.ui.mount(band('desktop'))
  expect(await ui.find({ type: 'Button', key: 'band-not-now' })).toBeUndefined()
  await ui.unmount()
})

test('61. the status line: nothing before Hub work, counts after, gone in Quiet', async ($, on) => {
  const log = engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  await $.session.start(START)
  expect(log.statuses.every(s => s === undefined)).toBe(true)
  await $.tool.call({ tool: SLU, tool_use_id: 't1', aww: 1200 })
  expect(log.statuses[log.statuses.length - 1]).toBe('The Comp Desk · 1 Hub figure')
  await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
  expect(log.statuses[log.statuses.length - 1]).toBe('The Comp Desk · 1 for review · 8 to verify')
  await $.command.run({ ...RUN, command: 'comp-desk-layout', args: 'quiet' })
  expect(log.statuses[log.statuses.length - 1]).toBeUndefined()
})

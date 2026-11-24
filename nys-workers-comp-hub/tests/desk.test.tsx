import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { Draft, Figure, Prefs } from '../types'
import { COPY } from '../hooks/copy'
import { copyText } from '../hooks/hub'
import { DEFAULT_PREFS } from '../hooks/prefs'
import { engine, HUB, PANE, PEEK, peek, START, SURFACES } from './engine'
import { CHECKLIST, CHECKLIST_FILE, CHECKLIST_FILE_V2, CHECKLIST_TICKED, PLUGIN, reply, SLU_OK } from './fixtures'

const SLU = `${PLUGIN}calculate_slu_award`
const SLU_ARGS = { aww: 1200, date_of_accident: '2024-03-15', body_parts: [{ body_part: 'arm', loss_percent: 25 }], prior_payments: 0 }
const NAMES = /Garcia|Baptiste|DEMO-0001/
type Surface = (typeof SURFACES)[number]

function desk(surface: Surface, props: Record<string, unknown> = {}) {
  return { plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: { ...PANE, ...props } } as const
}

async function writeChecklist($: Engine, id = 'w1', path = CHECKLIST_FILE, content = CHECKLIST): Promise<void> {
  await $.tool.call({ tool: 'Write', tool_use_id: id, file_path: path, content })
}

async function headings(ui: { findAll: (q: { type: string }) => Promise<{ text: string; props: Record<string, unknown> }[]> }): Promise<string[]> {
  return (await ui.findAll({ type: 'Text' })).filter(t => t.props.weight === 'semibold' && Object.values(COPY.sectionName).includes(t.text)).map(t => t.text)
}

test('29. the empty desk explains itself on every surface', async ($, on) => {
  engine(on)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    expect(await ui.find({ type: 'Text', text: COPY.headline(0, 0, 0, 0) })).toBeDefined()
    for (const line of [COPY.reviewEmpty('sends')[0], COPY.hearingsEmpty[0], COPY.figuresEmpty[0], COPY.disclaimer]) {
      expect((await ui.find({ type: 'Text', text: line ?? '' }))?.text).toBe(line)
    }
    expect((await ui.find({ type: 'Link' }))?.props.href).toBe('https://thecompdesk.com/claude')
    // Connection stays out of the way until something needs the person.
    expect(await headings(ui)).toEqual(['For your review', 'Hearings', 'Hub figures', 'Next steps'])
    await ui.unmount()
  }
})

test('30. after a checklist: the headline and the four counts', async ($, on) => {
  engine(on)
  await writeChecklist($)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    expect(await ui.find({ type: 'Text', text: '1 draft needs your review. 8 items to verify.' })).toBeDefined()
    const numbers = (await ui.findAll({ type: 'Text' })).filter(t => t.props.size === 'title').map(t => t.text)
    expect(numbers).toEqual(['1', '8', '0', '2'])
    await ui.unmount()
  }
})

test('31. Hide names hides every claimant and WCB number, and is kept as a preference', async ($, on) => {
  const log = engine(on)
  await writeChecklist($)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    expect(await ui.find({ type: 'Text', text: /A\. Garcia \(DEMO\) · WCB DEMO-0001/ })).toBeDefined()
    await ui.press({ key: 'names' })
    for (const t of await ui.findAll({ type: 'Text' })) expect(t.text).not.toMatch(NAMES)
    expect(await ui.find({ type: 'Text', text: 'Hearing 1' })).toBeDefined()
    expect((log.stored[log.stored.length - 1] as Prefs).names).toBe('hide')
    await ui.press({ key: 'names' })
    expect(await ui.find({ type: 'Text', text: /A\. Garcia \(DEMO\)/ })).toBeDefined()
    await ui.unmount()
  }
})

test('32. as a widget, and narrow: the one-line glance', async ($, on) => {
  engine(on)
  await writeChecklist($)
  const line = '1 for review · 8 to verify · 0 figures · 2 hearings'
  const w = await $.ui.mount(desk('desktop', { placement: 'widget' }))
  const texts = await w.findAll({ type: 'Text' })
  expect(texts.map(t => t.text)).toEqual([line])
  expect(await w.find({ type: 'Button' })).toBeUndefined()
  await w.unmount()
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface, { bodyColumns: 30 }))
    const all = (await ui.findAll({ type: 'Text' })).map(t => t.text)
    expect(all.indexOf(line)).toBeGreaterThan(-1)
    expect(all.indexOf(line)).toBeLessThan(all.indexOf('For your review'))
    expect((await ui.findAll({ type: 'Text' })).filter(t => t.props.size === 'title')).toHaveLength(0)
    await ui.unmount()
  }
})

test('33. presets change the sections and their order', async ($, on) => {
  engine(on)
  await $.tool.call({ tool: SLU, tool_use_id: 't1', ...SLU_ARGS })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    const pick = async (key: string): Promise<void> => {
      await ui.press({ key: 'customize' })
      await ui.press({ key })
      await ui.press({ key: 'done' })
    }
    await pick('p-glance')
    // Glance is the four counts by design: no note that sections are off.
    expect(await ui.find({ type: 'Text', text: COPY.sectionsOff })).toBeUndefined()
    expect(await headings(ui)).toEqual([])
    expect(await ui.find({ type: 'Button', key: 'customize' })).toBeDefined()
    await pick('b-band')
    expect(await ui.find({ type: 'Text', text: COPY.sectionsOff })).toBeDefined()
    await pick('p-focus')
    expect(await headings(ui)).toEqual(['For your review', 'Hearings'])
    await pick('p-figures')
    expect((await headings(ui)).slice(0, 2)).toEqual(['Hub figures', 'For your review'])
    await ui.press({ key: 'customize' })
    await ui.press({ key: 'p-desk' })
    await ui.press({ key: 's-figures' })
    expect(await ui.find({ type: 'Text', text: COPY.now('Custom') })).toBeDefined()
    await ui.press({ key: 'p-desk' })
    await ui.press({ key: 'done' })
    await ui.unmount()
  }
})

test('34. compact density: two buttons on the review row and one-line inputs', async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  await writeChecklist($)
  await $.tool.call({ tool: SLU, tool_use_id: 't1', ...SLU_ARGS })
  const id = 'w1'
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    expect(await ui.find({ type: 'Button', key: `rv-recount-${id}` })).toBeUndefined()
    await ui.press({ key: 'customize' })
    await ui.press({ key: 'd-compact' })
    await ui.press({ key: 'done' })
    const review = (await ui.findAll({ type: 'Button' })).filter(b => (b.key ?? '').startsWith('rv-'))
    expect(review.map(b => b.key)).toEqual([`rv-verify-${id}`, `rv-mark-${id}`])
    expect((await ui.find({ type: 'Text', text: /^Inputs: AWW/ }))?.props.maxLines).toBe(1)
    await ui.press({ key: 'customize' })
    await ui.press({ key: 'd-fit' })
    await ui.press({ key: 'done' })
    await ui.unmount()
  }
})

test('35. Mark reviewed tidies the list and the status line; Undo puts it back', async ($, on) => {
  const log = engine(on)
  await writeChecklist($)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    await ui.press({ key: 'rv-mark-w1' })
    expect(await ui.find({ type: 'Text', text: '8 items to verify.' })).toBeDefined()
    expect(log.statuses[log.statuses.length - 1]).toBe('The Comp Desk · 8 to verify')
    expect(await ui.find({ type: 'Text', text: /^Marked reviewed by you/ })).toBeDefined()
    await ui.press({ key: 'rv-mark-w1' })
    expect(await ui.find({ type: 'Text', text: '1 draft needs your review. 8 items to verify.' })).toBeDefined()
    expect(log.statuses[log.statuses.length - 1]).toBe('The Comp Desk · 1 for review · 8 to verify')
    await ui.unmount()
  }
})

test('36. a next step fills an empty prompt and never overwrites one', async ($, on) => {
  const log = engine(on)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    await ui.press({ key: 'qa-prep' })
    await ui.unmount()
  }
  expect(log.fills).toEqual(SURFACES.map(() => ({ text: COPY.fillPrep, mode: 'replace' })))
  expect(log.submits).toEqual([])
})

test('36b. a busy prompt is left alone, with a note', async ($, on) => {
  const log = engine(on, { prompt: 'my own words' })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    await ui.press({ key: 'qa-prep' })
    await ui.unmount()
  }
  expect(log.fills).toEqual([])
  expect(log.toasts).toEqual(SURFACES.map(() => COPY.promptBusy))
})

test('37. Details, Copy with inputs and Back', { plugins: [PEEK] }, async ($, on) => {
  const log = engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  await $.tool.call({ tool: SLU, tool_use_id: 't1', ...SLU_ARGS })
  const f = (await peek<Figure[]>($, 'figures'))[0]
  if (f === undefined) throw new Error('no figure')
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    await ui.press({ key: 'fig-t1' })
    expect(await ui.find({ type: 'Text', text: COPY.headSteps })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '8. Award: total weeks × weekly rate, to the cent: $62,400.00' })).toBeDefined()
    await ui.press({ key: 'fv-copy' })
    expect(log.copies[log.copies.length - 1]).toBe(copyText(f))
    expect((await ui.find({ type: 'Button', key: 'fv-copy' }))?.props.label).toBe(COPY.copied)
    await ui.press({ key: 'back' })
    expect(await ui.find({ type: 'Text', text: 'For your review' })).toBeDefined()
    await ui.unmount()
  }
  const text = copyText(f)
  expect(text).toContain('Inputs: AWW 1200')
  expect(text).toContain((SLU_OK.notice as Record<string, string>).figures ?? 'x')
  expect(text.split('\n')[0]).toBe('Schedule loss of use award (Hub estimate)')
})

test('38. Customize: the Paper look, the app look and Back to the starting layout', async ($, on) => {
  const log = engine(on)
  await $.session.start(START)
  const ui = await $.ui.mount(desk('desktop'))
  await ui.press({ key: 'customize' })
  await ui.press({ key: 'l-paper' })
  const set = log.themes[log.themes.length - 1] as { colors: { label: string }; style?: { Heading?: { fontFamily?: string[] } } }
  expect(set.colors.label).toBe('The Comp Desk Paper')
  expect(set.style?.Heading?.fontFamily).toEqual(['serif'])
  expect(log.toasts).toContain(COPY.lookNotDrawn.trim())
  await ui.press({ key: 'l-app' })
  expect(log.clears).toBe(1)
  await ui.press({ key: 'reset' })
  expect(log.deleted).toContain('prefs')
  await ui.press({ key: 'done' })
  await ui.unmount()
  for (const surface of SURFACES) {
    const c = await $.ui.mount(desk(surface))
    await c.press({ key: 'customize' })
    for (const key of ['p-desk', 'd-fit', 's-review', 'b-band', 'c-full', 'n-show', 'l-app', 'serif-on', 'm-subtle', 'reset', 'clear', 'done']) {
      expect(await c.find({ type: 'Button', key })).toBeDefined()
    }
    await c.press({ key: 'done' })
    await c.unmount()
  }
})

test('39. Clear this session\'s desk asks twice, then empties it', { plugins: [PEEK] }, async ($, on) => {
  const log = engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  await writeChecklist($)
  await $.tool.call({ tool: SLU, tool_use_id: 't1', ...SLU_ARGS })
  const ui = await $.ui.mount(desk('mobile'))
  await ui.press({ key: 'customize' })
  await ui.press({ key: 'clear' })
  expect((await ui.find({ type: 'Button', key: 'clear' }))?.props.label).toBe(COPY.clearArmed)
  expect(await peek<Draft[]>($, 'drafts')).toHaveLength(1)
  await ui.press({ key: 'clear' })
  expect(await peek<Draft[]>($, 'drafts')).toEqual([])
  expect(await peek<Figure[]>($, 'figures')).toEqual([])
  expect(log.toasts[log.toasts.length - 1]).toBe(COPY.cleared)
  expect(await ui.find({ type: 'Text', text: COPY.headline(0, 0, 0, 0) })).toBeDefined()
  await ui.unmount()
})

test('40. the file: Copy path on every surface, never a file link; none while names are hidden', async ($, on) => {
  const log = engine(on)
  await writeChecklist($)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    expect((await ui.findAll({ type: 'Link' })).filter(l => !String(l.props.href).startsWith('https://'))).toEqual([])
    await ui.press({ key: 'rv-path-w1' })
    expect(log.copies[log.copies.length - 1]).toBe(CHECKLIST_FILE)
    expect((await ui.find({ type: 'Button', key: 'rv-path-w1' }))?.props.label).toBe(COPY.copied)
    await ui.press({ key: 'names' })
    expect(await ui.find({ type: 'Button', key: 'rv-path-w1' })).toBeUndefined()
    await ui.press({ key: 'names' })
    await ui.unmount()
  }
})

async function withRunningFigure($: Engine, on: Parameters<typeof engine>[0], check: () => Promise<void>, prefs?: Prefs): Promise<void> {
  let release: () => void = () => undefined
  const gate = new Promise<void>(r => { release = r })
  on('tool.call', { tool: SLU }, async () => { await gate; return reply(SLU_OK) as never })
  engine(on, prefs === undefined ? {} : { store: { prefs } })
  await $.session.start(START)
  const call = $.tool.call({ tool: SLU, tool_use_id: 't-run', ...SLU_ARGS })
  for (let i = 0; i < 50; i += 1) {
    if (((await peek<Figure[] | null>($, 'figures')) ?? []).some(f => f.status === 'running')) break
  }
  await check()
  release()
  await call
}

test('41. while the Hub calculates: a soft dot off the terminal, words everywhere', { plugins: [PEEK] }, async ($, on) => {
  await withRunningFigure($, on, async () => {
    for (const surface of SURFACES) {
      const ui = await $.ui.mount(desk(surface))
      expect(await ui.find({ type: 'Text', text: COPY.working })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: COPY.calculating })).toBeDefined()
      const svg = await ui.find({ type: 'Svg' })
      if (surface === 'terminal') expect(svg).toBeUndefined()
      else expect(svg?.props.alt).toBe(COPY.workingAlt)
      await ui.unmount()
    }
  })
})

test('41b. motion off: no dot anywhere', { plugins: [PEEK] }, async ($, on) => {
  await withRunningFigure($, on, async () => {
    for (const surface of SURFACES) {
      const ui = await $.ui.mount(desk(surface))
      expect(await ui.find({ type: 'Text', text: COPY.working })).toBeDefined()
      expect(await ui.find({ type: 'Svg' })).toBeUndefined()
      await ui.unmount()
    }
  }, { ...DEFAULT_PREFS, motion: 'off' })
})

test('42. a -v2 checklist replaces v1 in Hearings; both wait for review', { plugins: [PEEK] }, async ($, on) => {
  engine(on)
  await writeChecklist($, 'w1', CHECKLIST_FILE, CHECKLIST)
  await writeChecklist($, 'w2', CHECKLIST_FILE_V2, CHECKLIST_TICKED)
  expect((await peek<Draft[]>($, 'drafts')).map(d => [d.name, d.review])).toEqual([['hearing-checklist-2026-12-03.md', 'waiting'], ['hearing-checklist-2026-12-03-v2.md', 'waiting']])
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    expect(await ui.find({ type: 'Text', text: '2 drafts need your review. 7 items to verify.' })).toBeDefined()
    const open = (await ui.findAll({ type: 'Button' })).filter(b => (b.key ?? '').startsWith('hr-open-'))
    expect(open.map(b => b.key)).toEqual(['hr-open-2026-12-03-1', 'hr-open-2026-12-03-2'])
    expect(await ui.find({ type: 'Text', text: 'From hearing-checklist-2026-12-03-v2.md' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'From hearing-checklist-2026-12-03.md' })).toBeUndefined()
    await ui.unmount()
  }
})

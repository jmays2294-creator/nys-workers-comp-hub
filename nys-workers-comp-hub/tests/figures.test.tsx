import { expect, test } from 'claude-code/testing'
import type { Figure, HubLink } from '../types'
import { COPY } from '../hooks/copy'
import { inputPairs } from '../hooks/hub'
import { engine, PANE, PEEK, peek, START, SURFACES } from './engine'
import { CONNECTOR, PLUGIN, RATE_LIMITED, RATE_MISSING, reply, SLU_INVALID, SLU_OK, WEEKS_OK } from './fixtures'

const SLU_ARGS = { aww: 1200, date_of_accident: '2024-03-15', body_parts: [{ body_part: 'arm', loss_percent: 25 }], prior_payments: 0 }
const DESK = { plugin: 'nys-workers-comp-hub', component: 'Pane', requestId: 'comp-desk', props: PANE } as const

test('7. an SLU call through the plugin records one done figure with the Hub display strings', { plugins: [PEEK] }, async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  await $.session.start(START)
  await $.tool.call({ tool: `${PLUGIN}calculate_slu_award`, tool_use_id: 't-slu', ...SLU_ARGS })
  const list = await peek<Figure[]>($, 'figures')
  expect(list).toHaveLength(1)
  const f = list[0]
  expect(f?.status).toBe('done')
  expect(f?.title).toBe('Schedule loss of use award')
  expect(f?.headline).toEqual([{ label: 'Award', value: '$62,400.00' }, { label: 'Net to the claimant', value: '$53,040.00' }, { label: 'Weekly rate', value: '$800.00' }])
  expect(COPY.inputsLine(f?.inputs ?? [])).toBe('Inputs: AWW 1200 · Date of accident 2024-03-15 · Body parts Arm 25% · Prior payments 0')
  expect(f?.steps).toHaveLength(11)
  expect(f?.steps[7]).toEqual({ label: '8. Award: total weeks × weekly rate, to the cent', value: '$62,400.00' })
  expect(f?.citations).toHaveLength(5)
  for (const c of f?.citations ?? []) expect(c.status).toBe('Citation not yet attorney-reviewed.')
  expect(f?.notice.figures).toBe((SLU_OK.notice as Record<string, string>).figures)
})

test('8. the same call through a claude.ai connector records the same figure', { plugins: [PEEK] }, async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  await $.tool.call({ tool: `${CONNECTOR}calculate_slu_award`, tool_use_id: 't-c', ...SLU_ARGS })
  const f = (await peek<Figure[]>($, 'figures'))[0]
  expect(f?.status).toBe('done')
  expect(f?.headline[0]).toEqual({ label: 'Award', value: '$62,400.00' })
})

test('9. a missing input: refused, the Hub message verbatim, no figure counted', { plugins: [PEEK] }, async ($, on) => {
  engine(on, { results: { calculate_weekly_rate: reply(RATE_MISSING) } })
  await $.tool.call({ tool: `${PLUGIN}calculate_weekly_rate`, tool_use_id: 't-m', kind: 'total', date_of_accident: '2024-03-15' })
  const f = (await peek<Figure[]>($, 'figures'))[0]
  expect(f?.status).toBe('refused')
  expect(f?.message).toBe(RATE_MISSING.message)
  expect(f?.missing).toEqual(['AWW'])
  const ui = await $.ui.mount({ ...DESK, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^Your desk|^Nothing needs/ }))?.text).toBe(COPY.headline(0, 0, 0, 0))
  await ui.unmount()
})

test('10. invalid inputs: refused, with each problem field labelled', { plugins: [PEEK] }, async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_INVALID) } })
  await $.tool.call({ tool: `${PLUGIN}calculate_slu_award`, tool_use_id: 't-i', aww: 1200 })
  const f = (await peek<Figure[]>($, 'figures'))[0]
  expect(f?.status).toBe('refused')
  expect(f?.problems).toEqual(['Claimant name', 'Date of accident'])
})

test('11. an answer that is not a Hub payload: error, and the desk says nothing was calculated', { plugins: [PEEK] }, async ($, on) => {
  engine(on, { results: { calculate_slu_award: { result: 'upstream trouble', text: 'upstream trouble', isError: true } } })
  await $.tool.call({ tool: `${PLUGIN}calculate_slu_award`, tool_use_id: 't-e', aww: 1200 })
  expect((await peek<Figure[]>($, 'figures'))[0]?.status).toBe('error')
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...DESK, surface })
    expect((await ui.find({ type: 'Text', text: COPY.noAnswer }))?.text).toBe(COPY.noAnswer)
    await ui.unmount()
  }
})

test('12. a denied call: error', { plugins: [PEEK] }, async ($, on) => {
  engine(on, { results: { calculate_slu_award: { deny: 'not now' } as never } })
  await $.tool.call({ tool: `${PLUGIN}calculate_slu_award`, tool_use_id: 't-d', aww: 1200 })
  expect((await peek<Figure[]>($, 'figures'))[0]?.status).toBe('error')
})

test('13. a rate limit: refused with the Hub message, and the connection shows the problem', { plugins: [PEEK] }, async ($, on) => {
  engine(on, { results: { calculate_aww: reply(RATE_LIMITED) } })
  await $.tool.call({ tool: `${PLUGIN}calculate_aww`, tool_use_id: 't-r', earnings_method: 'steady', total_earnings: 52000 })
  const f = (await peek<Figure[]>($, 'figures'))[0]
  expect(f?.status).toBe('refused')
  expect(f?.message).toBe(RATE_LIMITED.message)
  expect((await peek<HubLink>($, 'link')).problem).toBe(RATE_LIMITED.message)
})

test('14. the hook hands the answer up unchanged', { plugins: [PEEK] }, async ($, on) => {
  const answers = { ok: reply(SLU_OK), refused: reply(RATE_MISSING), plain: { result: 'x', text: 'x' }, deny: { deny: 'not now' } }
  const results: Record<string, unknown> = {}
  engine(on, { results: results as never })
  for (const [k, answer] of Object.entries(answers)) {
    results.calculate_slu_award = answer
    const ran = await $.tool.call({ tool: `${PLUGIN}calculate_slu_award`, tool_use_id: `t-${k}`, aww: 1200 })
    if (k === 'deny') expect(ran.deny).toBe('not now')
    else expect(ran).toEqual(answer)
  }
})

test('15. 51 calls keep the newest 50, and the figures-first desk says so', { plugins: [PEEK] }, async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_OK) } })
  for (let i = 0; i < 51; i += 1) await $.tool.call({ tool: `${PLUGIN}calculate_slu_award`, tool_use_id: `t-${i}`, ...SLU_ARGS })
  const list = await peek<Figure[]>($, 'figures')
  expect(list).toHaveLength(50)
  expect(list[0]?.id).toBe('t-1')
  expect(list[49]?.id).toBe('t-50')
  await $.command.run({ origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 }, command: 'comp-desk-layout', args: 'figures' })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...DESK, surface })
    expect((await ui.find({ type: 'Text', text: COPY.figuresCap }))?.text).toBe(COPY.figuresCap)
    expect(await ui.find({ type: 'Button', key: 'fig-all' })).toBeDefined()
    await ui.unmount()
  }
})

test('16. benefit weeks: the weeks of each period, as the Hub wrote them', { plugins: [PEEK] }, async ($, on) => {
  engine(on, { results: { calculate_benefit_weeks: reply(WEEKS_OK) } })
  await $.tool.call({ tool: `${PLUGIN}calculate_benefit_weeks`, tool_use_id: 't-w', periods: [] })
  const f = (await peek<Figure[]>($, 'figures'))[0]
  expect(f?.headline).toEqual([{ label: 'Weeks', value: '15.7, 8.7' }])
  expect(f?.more[0]).toEqual({ label: '2025-01-11 to 2025-04-30', value: '15.7' })
})

test('17. a running figure shows only the known inputs of the call, never a name', { plugins: [PEEK] }, async ($, on) => {
  engine(on, { results: { calculate_slu_award: { result: 'not json', text: 'not json' } } })
  await $.tool.call({ tool: `${PLUGIN}calculate_slu_award`, tool_use_id: 't-n', claimant_name: 'X', aww: 1200 })
  const f = (await peek<Figure[]>($, 'figures'))[0]
  expect(f?.status).toBe('error')
  expect(f?.inputs).toEqual([{ label: 'AWW', value: '1200' }])
  expect(inputPairs({ claimant_name: 'X', aww: 1200 }, true)).toEqual([{ label: 'AWW', value: '1200' }])
  const nested = { body_parts: [{ body_part: 'Arm', loss_percent: 25, note: 'A. Garcia (DEMO)' }], cases: [{ label: 'T. Baptiste (DEMO)', aww: 900 }] }
  expect(inputPairs(nested, true)).toEqual([{ label: 'Body parts', value: 'Arm 25%' }, { label: 'Claims', value: 'Aww 900' }])
})

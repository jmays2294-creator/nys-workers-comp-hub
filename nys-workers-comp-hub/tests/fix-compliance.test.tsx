// Compliance review fixes: a calm desk, one home for layout choices, the Pro Workspace only for its users, the
// hearing day first, and copy that says what the guard does. Fictional data only.
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { Prefs } from '../types'
import { hearingOrder, localDay, parseChecklist } from '../hooks/checklist'
import { COPY, INPUT_LABELS } from '../hooks/copy'
import { DEFAULT_PREFS } from '../hooks/prefs'
import { classify, guardVerdict } from '../hooks/sends'
import { describeTool, engine, HUB, PANE, PEEK, peek, skillArgs, START, SURFACES } from './engine'
import { CHECKLIST, CHECKLIST_FILE, CONNECTOR, PLUGIN, RATE_LIMITED, reply, SLU_OK, WS_STATUS } from './fixtures'

const SLU = `${PLUGIN}calculate_slu_award`
const NOW = 1_700_000_000_000
type Surface = (typeof SURFACES)[number]

function desk(surface: Surface, props: Record<string, unknown> = {}) {
  return { plugin: HUB, surface, component: 'Pane', requestId: 'comp-desk', props: { ...PANE, ...props } } as const
}

async function texts(ui: { findAll: (q: { type: string }) => Promise<{ text: string }[]> }): Promise<string[]> {
  return (await ui.findAll({ type: 'Text' })).map(t => t.text)
}

async function keys(ui: { findAll: (q: { type: string }) => Promise<{ key?: string }[]> }): Promise<string[]> {
  return (await ui.findAll({ type: 'Button' })).map(b => b.key ?? '')
}

test('C1. the conventions let the Pro Workspace tools take the claimant label, and keep names away from the calculators', () => {
  const lines = COPY.conventions.split('\n')
  expect(lines.some(l => l.includes('add_workspace_cases') && l.includes('claimant label') && l.includes("attorney's yes"))).toBe(true)
  expect(lines.some(l => /^- Give the Hub numbers and dates only/.test(l))).toBe(false)
  expect(lines.some(l => l.includes("calculators") && l.includes("never a client's name"))).toBe(true)
})

test('C2. the guard says what it does: connector tools named as sends, in every session; drafts and reads are left alone', () => {
  for (const tool of ['mcp__resend__send-email', 'mcp__x__post-message', 'mcp__x__export_and_send', 'mcp__x__sendmail']) expect([tool, classify(tool)]).toEqual([tool, 'send'])
  expect(COPY.strip).toBe('Agents draft; you approve. The desk itself sends nothing.')
  expect(COPY.sendsLine('sends')).toBe('Connector tools named as sends: you approve each one yourself.')
  expect(COPY.reviewEmpty('sends')).toContain('Before a connector tool sends an email, a message or a post, you approve it yourself.')
})

test('C3. a working Hub leaves Connection as one dim line; a problem brings the block back with Check again', async ($, on) => {
  engine(on, { results: { calculate_slu_award: reply(SLU_OK), calculate_aww: reply(RATE_LIMITED) } })
  await $.tool.call({ tool: SLU, tool_use_id: 't1', aww: 1200 })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    expect(await texts(ui)).toContain(COPY.hubConnected)
    expect(await texts(ui)).not.toContain(COPY.secConnection)
    expect(await keys(ui)).not.toContain('check')
    await ui.unmount()
  }
  await $.tool.call({ tool: `${PLUGIN}calculate_aww`, tool_use_id: 't2', aww: 1200 })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    expect(await texts(ui)).toContain(COPY.secConnection)
    expect(await texts(ui)).toContain(COPY.hubProblem(String(RATE_LIMITED.message)))
    expect(await keys(ui)).toContain('check')
    await ui.unmount()
  }
})

test('C3b. hearing notes and imports show once: one notes line in review, no second import line', async ($, on) => {
  engine(on, {
    results: {
      list_hearing_notes: reply({ ok: true, tool: 'list_hearing_notes', count: 3, notes: [], notice: { figures: 'DEMO' } }),
      get_import_status: reply(WS_STATUS),
    },
  })
  await $.tool.call({ tool: `${PLUGIN}list_hearing_notes`, tool_use_id: 'n1' })
  await $.tool.call({ tool: `${PLUGIN}get_import_status`, tool_use_id: 'i1', keys: [] })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    const all = await texts(ui)
    expect(all.filter(t => /hearing notes? waiting/i.test(t))).toEqual([COPY.notesLine(3, 0)])
    expect(all).toContain(COPY.importsReview(1))
    expect(all.filter(t => t.startsWith('Import status:'))).toEqual([])
    await ui.unmount()
  }
})

test('C3c. the footer is the disclaimer and one line, beside the buttons', async ($, on) => {
  engine(on)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    const all = await texts(ui)
    expect(all).toContain(COPY.disclaimer)
    expect(all).toContain(COPY.draftedByAgent)
    expect(all.indexOf(COPY.draftedByAgent)).toBe(all.indexOf(COPY.disclaimer) + 1)
    await ui.unmount()
  }
})

test('C4. layout, density, names, look and motion live on the desk only: /config offers none of them', async ($, on) => {
  const log = engine(on)
  await $.session.start(START)
  const ui = await $.ui.mount(desk('desktop'))
  await ui.press({ key: 'customize' })
  await ui.press({ key: 'd-compact' })
  await ui.press({ key: 'n-hide' })
  await ui.press({ key: 'm-off' })
  await ui.unmount()
  const stored = log.stored[log.stored.length - 1] as Prefs
  expect([stored.density, stored.names, stored.motion]).toEqual(['compact', 'hide', 'off'])
  expect(Object.keys(stored)).not.toContain('stamp')
})

for (const density of ['compact', 'comfortable'] as const) {
  test(`C6. a stale checklist always offers the Recount its line asks for (${density})`, async ($, on) => {
    engine(on, { store: { prefs: { ...DEFAULT_PREFS, density } } })
    await $.session.start(START)
    await $.tool.call({ tool: 'Write', tool_use_id: 'w1', file_path: CHECKLIST_FILE, content: CHECKLIST })
    // The engine reports no original text, so the edit cannot be replayed: the counts may be out of date.
    await $.tool.call({ tool: 'Edit', tool_use_id: 'e1', file_path: CHECKLIST_FILE, old_string: '- [ ] Have the OC-400.1', new_string: '- [x] Have the OC-400.1' })
    for (const surface of SURFACES) {
      const ui = await $.ui.mount(desk(surface))
      expect([surface, (await texts(ui)).includes(COPY.stale), (await keys(ui)).includes('rv-recount-w1')]).toEqual([surface, true, true])
      await ui.unmount()
    }
  })
}

test('C7. a send that goes straight out, with nobody to ask, is refused; asked and queried ones ask', () => {
  expect(guardVerdict('send', 'sends', false, true)).toBe('deny')
  expect(guardVerdict('hub-write', 'hub-only', false, true)).toBe('deny')
  expect(guardVerdict('send', 'sends', false, false)).toBe('ask')
  expect(guardVerdict('send', 'hub-only', false, true)).toBe('beneath')
  expect(guardVerdict('write', 'sends-and-writes', true, true)).toBe('ask')
  expect(guardVerdict('other', 'sends', true, true)).toBe('beneath')
  expect(COPY.guardStraightOut('send_message')).toMatch(/nobody here to approve it/)
})

test('C7b. a query about a send, with no call behind it, still asks: it is not a call that goes straight out', async ($, on) => {
  engine(on)
  on('tool.check', () => ({ decision: 'allow' }))
  expect((await $.tool.check({ tool: 'mcp__claude_ai_Gmail__send_message', input: {} })).decision).toBe('ask')
})

test('C8. the Pro Workspace steps wait until the person uses the Pro Workspace', async ($, on) => {
  engine(on, { results: { get_import_status: reply(WS_STATUS) } })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    expect([surface, (await keys(ui)).filter(k => k === 'qa-ws' || k === 'check-ws')]).toEqual([surface, []])
    await ui.unmount()
  }
  await $.tool.call({ tool: `${PLUGIN}get_import_status`, tool_use_id: 'i1', keys: [] })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    expect([surface, (await keys(ui)).includes('qa-ws')]).toEqual([surface, true])
    await ui.unmount()
  }
})

test('C8b. the prep-to-workspace skill counts as using the Pro Workspace', async ($, on) => {
  engine(on)
  await $.skill.prompt(skillArgs('prep-to-workspace'))
  const ui = await $.ui.mount(desk('desktop'))
  expect(await keys(ui)).toContain('qa-ws')
  await ui.unmount()
})

test('C10-13. plain American wording, a labelled weekly-rate input, action labels and a footer for any desk', () => {
  expect(COPY.hearingCounts(0, 0, 3)).toBe('Every item is checked off')
  expect(COPY.hearingsNote).toContain('Check marks you add in your editor')
  expect(INPUT_LABELS.kind).toBe('Disability')
  expect([COPY.qaSlu, COPY.qaRate]).toEqual(['Calculate a schedule loss of use award', 'Look up the maximum and minimum rate'])
  expect(COPY.draftedByAgent).toBe('What an agent drafts here is for you to review and decide. Nothing here is legal advice.')
})

test('C14. right-click: a form only when it is the whole selection; no glossary row for a claimant label', async ($, on) => {
  engine(on)
  const menu = async (text: string): Promise<string[]> => {
    const ui = await $.ui.mount({ plugin: HUB, surface: 'desktop', component: 'ContextMenu', props: { selection: { text } } })
    const k = await keys(ui)
    await ui.unmount()
    return k
  }
  expect(await menu('EC2 instance')).toEqual(['menu-define'])
  expect(await menu('C-4.3')).toEqual(['menu-form', 'menu-define'])
  expect(await menu('A. Garcia')).toEqual([])
  expect(await menu('Section 32 offer')).toEqual(['menu-define'])
  expect(await menu('the claimant was seen again last week')).toEqual([])
})

test('C15. a list_skills call on another server is not Hub work: no status line, no write guard', { options: { send_guard: 'sends-and-writes' } }, async ($, on) => {
  const log = engine(on)
  on('tool.check', () => ({ decision: 'allow' }))
  await $.session.start(START)
  await $.tool.call({ tool: 'mcp__other__list_skills', tool_use_id: 'o1' })
  expect((await $.tool.check({ tool: 'mcp__x__create_record', input: {} })).decision).toBe('allow')
  expect(log.statuses.filter(s => s !== undefined)).toEqual([])
  await describeTool($, `${CONNECTOR}list_skills`)
  await $.tool.call({ tool: `${CONNECTOR}list_skills`, tool_use_id: 'o2' })
  expect((await $.tool.check({ tool: 'mcp__x__create_record', input: {} })).decision).toBe('ask')
})

const TODAY = localDay(NOW)
const TODAY_FILE = `/x/hearing-checklist-${TODAY}.md`
// Hearing 1 later in the day than hearing 2, as a checklist can list them.
const OUT_OF_ORDER = CHECKLIST.replace('12/03/2026 9:30 AM · Permanency', '12/03/2026 2:00 PM · Permanency')

test('C18. on a hearing day: the day is titled Today, hearings run in time order, and the glance shows the first with open items', async ($, on) => {
  engine(on)
  await writeAt($, 'w1', TODAY_FILE, OUT_OF_ORDER)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount(desk(surface))
    const all = await texts(ui)
    expect(all).toContain(COPY.todayLine('Thursday, December 3, 2026'))
    expect(all).toContain(COPY.gToday('12/03/2026 11:00 AM'))
    const open = (await keys(ui)).filter(k => k.startsWith('hr-open-'))
    expect(open).toEqual([`hr-open-${TODAY}-2`, `hr-open-${TODAY}-1`])
    await ui.unmount()
  }
})

test('C18b. ordering reads times as written and keeps unreadable ones in place, after', () => {
  const rows = parseChecklist(OUT_OF_ORDER).hearings
  expect(hearingOrder(rows).map(r => r.n)).toEqual([2, 1])
  const odd = rows.map((r, i) => i === 0 ? { ...r, when: 'to be set' } : r)
  expect(hearingOrder(odd).map(r => r.n)).toEqual([2, 1])
  expect(hearingOrder(rows.map(r => ({ ...r, when: '' }))).map(r => r.n)).toEqual([1, 2])
  expect(rows.map(r => r.when)).toEqual(['12/03/2026 2:00 PM', '12/03/2026 11:00 AM'])
})

test('C18c. another day keeps the newest checklist first, without the Today title', { plugins: [PEEK] }, async ($, on) => {
  engine(on)
  await writeAt($, 'w1', CHECKLIST_FILE, CHECKLIST)
  expect((await peek<unknown[]>($, 'drafts')).length).toBe(1)
  const ui = await $.ui.mount(desk('desktop'))
  expect((await texts(ui)).some(t => t.startsWith('Today'))).toBe(false)
  expect(await texts(ui)).toContain(COPY.gFirst('12/03/2026 9:30 AM'))
  await ui.unmount()
})

async function writeAt($: Engine, id: string, file_path: string, content: string): Promise<void> {
  await $.tool.call({ tool: 'Write', tool_use_id: id, file_path, content })
}

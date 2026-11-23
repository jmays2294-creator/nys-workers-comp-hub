import { expect, test } from 'claude-code/testing'
import type { Prefs } from '../types'
import { COPY } from '../hooks/copy'
import { prefsFrom, stampOf } from '../hooks/prefs'
import { engine, PEEK, peek, RUN, START } from './engine'

const run = (command: string, args = '') => ({ ...RUN, command, args })

test('62. /comp-desk opens the desk, asked, with the keyboard', async ($, on) => {
  const log = engine(on)
  await $.session.start(START)
  const r = await $.command.run(run('comp-desk'))
  expect(log.opened).toEqual(['comp-desk'])
  expect(log.focused).toEqual([true])
  expect(r.text).toBe(COPY.deskOpened)
  expect(r.isTextDisplayOnly).toBe(true)
})

test('62b. /comp-desk where no pane can be placed says so', async ($, on) => {
  engine(on, { uiOpen: { isPlaced: false, reason: 'no-surface' } })
  await $.session.start(START)
  expect((await $.command.run(run('comp-desk', 'open'))).text).toBe(COPY.deskWaits)
})

test('63. /comp-desk close, clear, reset, help and anything else', async ($, on) => {
  const log = engine(on)
  await $.session.start(START)
  expect((await $.command.run(run('comp-desk', 'close'))).text).toBe(COPY.deskClosed)
  expect(log.closed).toEqual(['comp-desk'])
  expect((await $.command.run(run('comp-desk', 'clear'))).text).toBe(COPY.cleared)
  expect((await $.command.run(run('comp-desk', 'reset'))).text).toBe(COPY.resetDone)
  expect(log.deleted).toEqual(['prefs'])
  expect((await $.command.run(run('comp-desk', 'help'))).text).toBe(COPY.deskHelp)
  expect((await $.command.run(run('comp-desk', 'xyz'))).text).toBe(COPY.deskUnknown)
})

test('64. /comp-desk-layout reads its words in order and saves the choices only', async ($, on) => {
  const log = engine(on)
  await $.session.start(START)
  const r = await $.command.run(run('comp-desk-layout', 'figures compact hide hearings cards off'))
  const p = log.stored[log.stored.length - 1] as Prefs
  expect([p.preset, p.order, p.density, p.cards, p.sections.hearings]).toEqual(['custom', 'figures-first', 'compact', 'off', false])
  expect(r.text).toBe(COPY.layoutDone(p))
  expect(r.text).toBe('Desk layout: Custom, Compact, cards off. Hidden: Hearings.')
  const before = log.stored.length
  expect((await $.command.run(run('comp-desk-layout', 'nonsense'))).text).toBe(COPY.layoutHelp)
  expect(log.stored.length).toBe(before)
  expect((await $.command.run(run('comp-desk-layout'))).text).toBe(COPY.layoutList(p))
})

test('65. /comp-desk-look paper-night no-serif', async ($, on) => {
  const log = engine(on)
  await $.session.start(START)
  const r = await $.command.run(run('comp-desk-look', 'paper-night no-serif'))
  const set = log.themes[log.themes.length - 1] ?? {}
  expect(set.overrideColorScheme).toBe('dark')
  expect(set.style).toBeUndefined()
  expect(r.text).toBe('Look set to Paper, night.' + COPY.lookNotDrawn)
})

test('66. /comp-desk-look app clears only a look this plugin set', async ($, on) => {
  const log = engine(on)
  await $.session.start(START)
  expect((await $.command.run(run('comp-desk-look', 'app'))).text).toBe(COPY.lookNone)
  expect(log.clears).toBe(0)
  await $.command.run(run('comp-desk-look', 'paper'))
  expect((await $.command.run(run('comp-desk-look', 'app'))).text).toBe(COPY.lookOff)
  expect(log.clears).toBe(1)
})

test('66b. /comp-desk-look serif with the app look saves the choice and says what stands', async ($, on) => {
  const log = engine(on)
  await $.session.start(START)
  const r = await $.command.run(run('comp-desk-look', 'no-serif'))
  expect(r.text).toBe("Look: App's own, serif headings off. Looks: app, paper, paper-light, paper-night.")
  expect(log.themes).toHaveLength(0)
  expect((log.stored[log.stored.length - 1] as Prefs).serif).toBe(false)
})

test('67. an older build without styles: the look is set again without the serif', async ($, on) => {
  const log = engine(on, { themeThrowsOnStyle: true })
  await $.session.start(START)
  const r = await $.command.run(run('comp-desk-look', 'paper'))
  expect(log.themes).toHaveLength(2)
  expect(log.themes[0]?.style).toBeDefined()
  expect(log.themes[1]?.style).toBeUndefined()
  expect(r.text).toBe(COPY.lookSet('paper') + COPY.lookNotDrawn)
})

test('68. by default the app keeps its own look at start', async ($, on) => {
  const log = engine(on)
  await $.session.start(START)
  expect(log.themes).toHaveLength(0)
  expect(log.clears).toBe(0)
})

test('68b. with the paper look chosen in /config, it is set once at start', { options: { look: 'paper' } }, async ($, on) => {
  const log = engine(on)
  await $.session.start(START)
  expect(log.themes).toHaveLength(1)
  expect((log.themes[0]?.colors as { label?: string } | undefined)?.label).toBe('The Comp Desk Paper')
})

test('69. stored choices made under the same /config values are kept', { plugins: [PEEK] }, async ($, on) => {
  const stored: Prefs = { ...prefsFrom({}), look: 'paper-light', preset: 'custom', cards: 'off' }
  const log = engine(on, { store: { prefs: stored } })
  await $.session.start(START)
  expect(log.themes).toHaveLength(1)
  expect(log.themes[0]?.overrideColorScheme).toBe('light')
  expect(log.deleted).toEqual([])
  expect((await peek<Prefs>($, 'prefs')).cards).toBe('off')
})

test('69b. a /config change wins over choices stored under other values', { plugins: [PEEK], options: { desk_layout: 'focus' } }, async ($, on) => {
  const stored: Prefs = { ...prefsFrom({}), look: 'paper-light' }
  expect(stored.stamp).not.toBe(stampOf({ desk_layout: 'focus' }))
  const log = engine(on, { store: { prefs: stored } })
  await $.session.start(START)
  expect(log.deleted).toEqual(['prefs'])
  expect(log.themes).toHaveLength(0)
  expect(await peek<Prefs>($, 'prefs')).toEqual(prefsFrom({ desk_layout: 'focus' }))
})

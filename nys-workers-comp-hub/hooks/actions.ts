// What a hook or a press does beyond drawing. Each helper is a function declaration with its own atoms.
// None of them reaches the network, a file, a process or a model: the suite only shows, fills the prompt
// for the person to send, copies, and asks.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, RenderSurface, ThemeResult, ThemeSetArgs, ThemeStyle, Timer, UiOpenResult } from 'claude-code'
import type { Look, Prefs } from '../types'
import { COPY } from './copy'
import { deskNumbers } from './drafts'
import { isHubTool, lastSegment } from './hub'
import { DEFAULT_PREFS, freshPrefs } from './prefs'
import { COLORS } from './theme.gen'

const figures = atom({ plugin: 'nys-workers-comp-hub', key: 'figures' } as const, [], { shape: 'figures-1' })
const drafts = atom({ plugin: 'nys-workers-comp-hub', key: 'drafts' } as const, [], { shape: 'drafts-1' })
const link = atom({ plugin: 'nys-workers-comp-hub', key: 'link' } as const, { tools: null, checkedAt: null, lastAnswerAt: null, problem: null, workspace: 'unknown', workspaceAt: null, sent: null, imports: null, notesWaiting: null, notesReady: [] }, { shape: 'link-1' })
const work = atom({ plugin: 'nys-workers-comp-hub', key: 'work' } as const, { isHubWork: false, skill: null, isDraftingSkill: false, didAutoOpen: false, didOpenDesk: false, didDeclineOffer: false, isLookApplied: false, writes: 0 }, { shape: 'work-1' })
const band = atom({ plugin: 'nys-workers-comp-hub', key: 'band' } as const, { version: 0, hiddenVersion: 0 }, { shape: 'band-1' })
const prefs = atom({ plugin: 'nys-workers-comp-hub', key: 'prefs' } as const, DEFAULT_PREFS, { shape: 'prefs-2' })
const view = atom({ plugin: 'nys-workers-comp-hub', key: 'view' } as const, { name: 'desk', figureId: null, copiedId: null, isAllFigures: false, clearArmed: false }, { shape: 'view-1' })
const isDeskOpen = atom({ plugin: 'nys-workers-comp-hub', key: 'isDeskOpen' } as const, false)
const tick = atom({ plugin: 'nys-workers-comp-hub', key: 'tick' } as const, 0)
const hubTools = atom({ plugin: 'nys-workers-comp-hub', key: 'hubTools' } as const, [], { shape: 'hub-tools-1' })

export const PANE_ID = 'comp-desk'

// The minute tick that redraws the desk's ages runs only while the desk is up. A reload stops it with the old
// module; session.start starts it again when the desk is still up.
let ticker: Timer | null = null
const SERIF: ThemeStyle = { Heading: { fontFamily: ['serif'] } }

export type LookOutcome = 'set' | 'not-drawn' | 'refused' | 'cleared' | 'none'

function lookArgs(look: Look, serif: boolean, withStyle: boolean): ThemeSetArgs {
  return {
    colors: COLORS,
    ...(look === 'paper-light' ? { overrideColorScheme: 'light' as const } : look === 'paper-night' ? { overrideColorScheme: 'dark' as const } : {}),
    ...(serif && withStyle ? { style: SERIF } : {}),
  }
}

/** A toast that answers the person's own press: always shown. */
export async function say($: EngineInterface, text: string): Promise<void> {
  try { $.ui.toast(text) } catch { /* a toast never breaks the session */ }
}

/** An unasked notice: shown only while the layout keeps notices on. Never a name, a path or a subject. */
export async function notify($: EngineInterface, text: string): Promise<void> {
  const p = await read($, prefs).catch(() => DEFAULT_PREFS)
  if (!p.notices) return
  try { $.ui.toast(text) } catch { /* ignore */ }
}

export async function syncStatus($: EngineInterface): Promise<void> {
  try {
    const p = await read($, prefs)
    const w = await read($, work)
    if (!p.status || !w.isHubWork) { $.ui.status(undefined); return }
    const n = deskNumbers(await read($, drafts), await read($, figures))
    $.ui.status(COPY.status(n.review, n.verify, n.figuresDone))
  } catch { /* the status line is a nicety */ }
}

export async function bumpBand($: EngineInterface): Promise<void> {
  await update($, band, b => ({ ...b, version: b.version + 1 })).catch(() => undefined)
}

export function startTick($: EngineInterface): void {
  if (ticker !== null) return
  try {
    ticker = $.clock.every(60_000, async () => { await update($, tick, n => n + 1).catch(() => undefined) })
  } catch { ticker = null /* ages still show; they redraw at the next change */ }
}

export function stopTick(): void {
  try { ticker?.cancel() } catch { /* already stopped */ }
  ticker = null
}

/** Whether the desk is drawn and in front on a surface now, from the engine's own record. */
export async function isDeskShown($: EngineInterface): Promise<boolean> {
  try { return (await $.ui.panes()).some(x => x.id === PANE_ID && x.isPlaced && x.isShown) } catch { return false }
}

/** Opens the desk. `isEarly`: at session start, when a connector may not be listed yet. */
export async function openDesk($: EngineInterface, isAsked: boolean, isEarly = false): Promise<UiOpenResult> {
  try {
    const opened = await $.ui.open({ id: PANE_ID, title: COPY.paneTitle, columns: 48, rows: 18, closeOnEscape: true, ...(isAsked ? { focus: true as const } : {}) })
    await update($, isDeskOpen, () => opened.isPlaced).catch(() => undefined)
    if (opened.isPlaced) {
      await update($, work, w => ({ ...w, didOpenDesk: true })).catch(() => undefined)
      await recheckTools($, isEarly)
      startTick($)
    }
    return opened
  } catch {
    return { isPlaced: false, reason: 'unavailable' }
  }
}

/** Closes the desk from the suite's own Close button or /comp-desk close, and marks it closed for the band. */
export async function closeDesk($: EngineInterface): Promise<void> {
  try { await $.ui.close({ id: PANE_ID }) } catch { /* already closed */ }
  await markDeskClosed($)
}

/** The desk is gone (any close): the band may offer it again, the tick stops, the view goes back to the desk. */
export async function markDeskClosed($: EngineInterface): Promise<void> {
  stopTick()
  await update($, isDeskOpen, () => false).catch(() => undefined)
  await update($, view, v => ({ ...v, name: 'desk' as const, figureId: null, clearArmed: false })).catch(() => undefined)
}

export async function autoOpen($: EngineInterface, options: PluginOptions): Promise<void> {
  if (options.open_desk !== 'on-hub-work') return
  const w = await read($, work).catch(() => null)
  if (w === null || w.didAutoOpen) return
  await update($, work, x => ({ ...x, didAutoOpen: true })).catch(() => undefined)
  await openDesk($, false)
}

/** Counts the Hub's tools in this session's listing. `isEarly`: none listed yet reads as not checked. */
export async function recheckTools($: EngineInterface, isEarly = false): Promise<void> {
  try {
    const list = await $.tool.list()
    const described = await read($, hubTools).catch((): string[] => [])
    const names = new Set(list.filter(t => isHubTool(t.name, described)).map(t => lastSegment(t.name)))
    const now = await $.clock.now()
    await update($, link, l => ({ ...l, tools: isEarly && names.size === 0 ? null : names.size, checkedAt: now }))
  } catch { /* the listing is a hint only */ }
}

/** Whether a call's tool is the Hub's: this plugin's own server, or one tool.describe placed at the Hub's origin. */
export async function isHubCall($: EngineInterface, tool: string): Promise<boolean> {
  const described = await read($, hubTools).catch((): string[] => [])
  return isHubTool(tool, described)
}

export async function savePrefs($: EngineInterface, p: Prefs): Promise<void> {
  await update($, prefs, () => p).catch(() => undefined)
  await $.store.set('prefs', p).catch(() => undefined)
  await syncStatus($)
}

/** Back to the starting layout and look: the stored choices go. Answers /comp-desk reset and the desk's button. */
export async function resetPrefs($: EngineInterface): Promise<void> {
  await $.store.delete('prefs').catch(() => undefined)
  const fresh = freshPrefs()
  await update($, prefs, () => fresh).catch(() => undefined)
  await applyLook($, fresh)
  await syncStatus($)
}

export async function applyLook($: EngineInterface, p: Prefs): Promise<LookOutcome> {
  if (p.look === 'app') {
    const w = await read($, work).catch(() => null)
    if (w === null || !w.isLookApplied) return 'none'
    try { await $.theme.clear() } catch { /* nothing more to do */ }
    await update($, work, x => ({ ...x, isLookApplied: false })).catch(() => undefined)
    return 'cleared'
  }
  let r: ThemeResult
  try {
    r = await $.theme.set(lookArgs(p.look, p.serif, true))
  } catch {
    try {
      r = await $.theme.set(lookArgs(p.look, p.serif, false))
    } catch {
      return 'refused'
    }
  }
  await update($, work, x => ({ ...x, isLookApplied: true })).catch(() => undefined)
  return r.isDrawn ? 'set' : 'not-drawn'
}

export async function clearDesk($: EngineInterface): Promise<void> {
  await update($, figures, () => []).catch(() => undefined)
  await update($, drafts, () => []).catch(() => undefined)
  await update($, link, l => ({ ...l, lastAnswerAt: null, problem: null, workspace: 'unknown' as const, workspaceAt: null, sent: null, imports: null, notesWaiting: null, notesReady: [] })).catch(() => undefined)
  await update($, band, () => ({ version: 0, hiddenVersion: 0 })).catch(() => undefined)
  await update($, view, v => ({ ...v, name: 'desk' as const, figureId: null, copiedId: null, clearArmed: false })).catch(() => undefined)
  await syncStatus($)
}

export async function copyOut($: EngineInterface, text: string, surface: RenderSurface, key: string | null): Promise<void> {
  let isCopied = false
  try { isCopied = (await $.ui.copy({ text, surface })).isCopied } catch { isCopied = false }
  await say($, isCopied ? COPY.copiedToast : COPY.copyFailed)
  if (isCopied && key !== null) await update($, view, v => ({ ...v, copiedId: key })).catch(() => undefined)
}

/** Puts a request in an empty prompt for the person to send. Never sends it, never overwrites their words. */
export async function fillPrompt($: EngineInterface, text: string, surface: RenderSurface): Promise<void> {
  let draft: string | null = null
  try { draft = (await $.prompt.read()).text } catch { draft = null }
  if (draft !== null && draft.trim() !== '') { await say($, COPY.promptBusy); return }
  try {
    const filled = await $.prompt.fill({ text, mode: draft === null ? 'insert' : 'replace' })
    if (filled.isFilled) return
    if (filled.refusal === 'no_composer') {
      let isCopied = false
      try { isCopied = (await $.ui.copy({ text, surface })).isCopied } catch { isCopied = false }
      await say($, isCopied ? COPY.copiedRequest : COPY.copyFailed)
    }
    else if (filled.refusal === 'dialog') await say($, COPY.finishDialog)
  } catch { /* nothing was filled */ }
}

/** The right-click menu's fill: added where the caret is, next to what the person typed. */
export async function insertPrompt($: EngineInterface, text: string): Promise<void> {
  try { await $.prompt.fill({ text, mode: 'insert' }) } catch { /* nothing was filled */ }
}

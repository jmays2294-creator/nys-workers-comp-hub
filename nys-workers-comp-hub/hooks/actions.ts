// What a hook or a press does beyond drawing. Each helper is a function declaration with its own atoms.
// None of them reaches the network, a file, a process or a model: the suite only shows, fills the prompt
// for the person to send, copies, and asks.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, RenderSurface, ThemeResult, ThemeSetArgs, ThemeStyle, UiOpenResult } from 'claude-code'
import type { Look, Prefs } from '../types'
import { COPY } from './copy'
import { deskNumbers } from './drafts'
import { isHub } from './hub'
import { DEFAULT_PREFS } from './prefs'
import { COLORS } from './theme.gen'

const figures = atom({ plugin: 'nys-workers-comp-hub', key: 'figures' } as const, [], { shape: 'figures-1' })
const drafts = atom({ plugin: 'nys-workers-comp-hub', key: 'drafts' } as const, [], { shape: 'drafts-1' })
const link = atom({ plugin: 'nys-workers-comp-hub', key: 'link' } as const, { tools: null, checkedAt: null, lastAnswerAt: null, problem: null, workspace: 'unknown', workspaceAt: null, sent: null, imports: null, notesWaiting: null, notesReady: [] }, { shape: 'link-1' })
const work = atom({ plugin: 'nys-workers-comp-hub', key: 'work' } as const, { isHubWork: false, skill: null, isDraftingSkill: false, didAutoOpen: false, didOpenDesk: false, didDeclineOffer: false, isLookApplied: false, writes: 0 }, { shape: 'work-1' })
const band = atom({ plugin: 'nys-workers-comp-hub', key: 'band' } as const, { version: 0, hiddenVersion: 0 }, { shape: 'band-1' })
const prefs = atom({ plugin: 'nys-workers-comp-hub', key: 'prefs' } as const, DEFAULT_PREFS, { shape: 'prefs-1' })
const view = atom({ plugin: 'nys-workers-comp-hub', key: 'view' } as const, { name: 'desk', figureId: null, copiedId: null, isAllFigures: false, clearArmed: false }, { shape: 'view-1' })
const isDeskOpen = atom({ plugin: 'nys-workers-comp-hub', key: 'isDeskOpen' } as const, false)

export const PANE_ID = 'comp-desk'
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

export async function openDesk($: EngineInterface, isAsked: boolean): Promise<UiOpenResult> {
  try {
    const opened = await $.ui.open({ id: PANE_ID, title: COPY.paneTitle, columns: 48, rows: 18, closeOnEscape: true, ...(isAsked ? { focus: true as const } : {}) })
    await update($, isDeskOpen, () => opened.isPlaced).catch(() => undefined)
    if (opened.isPlaced) await update($, work, w => ({ ...w, didOpenDesk: true })).catch(() => undefined)
    return opened
  } catch {
    return { isPlaced: false, reason: 'unavailable' }
  }
}

export async function autoOpen($: EngineInterface, options: PluginOptions): Promise<void> {
  if (options.open_desk !== 'on-hub-work') return
  const w = await read($, work).catch(() => null)
  if (w === null || w.didAutoOpen) return
  await update($, work, x => ({ ...x, didAutoOpen: true })).catch(() => undefined)
  await openDesk($, false)
}

export async function recheckTools($: EngineInterface): Promise<void> {
  try {
    const list = await $.tool.list()
    const names = new Set(list.filter(t => isHub(t.name)).map(t => t.name.slice(t.name.lastIndexOf('__') + 2)))
    const now = await $.clock.now()
    await update($, link, l => ({ ...l, tools: names.size, checkedAt: now }))
  } catch { /* the listing is a hint only */ }
}

export async function savePrefs($: EngineInterface, p: Prefs): Promise<void> {
  await update($, prefs, () => p).catch(() => undefined)
  await $.store.set('prefs', p).catch(() => undefined)
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

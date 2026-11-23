// The Comp Desk suite: the hooks module of the New York State Workers' Compensation Hub plugin.
// Every forwarding hook awaits next(e) on every path and returns what it got; its own work is wrapped so a
// failure never reaches the person's session. The module makes no network call of its own, reads no file,
// keeps case data in this session's $.state only and keeps nothing but layout choices in $.store.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'
import type { Draft, Figure, HubLink, Prefs } from '../types'
import { applyLook, autoOpen, bumpBand, clearDesk, notify, openDesk, recheckTools, savePrefs, syncStatus } from './actions'
import { drawBand } from './band'
import { drawDraftCard, drawEmailCard, drawHubCard } from './cards'
import { applyEdit, checklistBase, isChecklistPath, parseChecklist, stripLineNumbers } from './checklist'
import { COPY, SKILL_LABELS } from './copy'
import { drawDesk } from './desk'
import { baseName, DRAFTING_SKILLS, hasDraftMarker, isDocPath, isExcludedPath, MAX_PARSE, skillKey } from './drafts'
import { argsOf, CALCULATORS, distill, emptyFigure, HUB_WRITE_NAMES, inputPairs, isHubPayload, isRecord, lastSegment, num, parsePayload, SIGN_IN, str, textOf } from './hub'
import type { Payload } from './hub'
import { drawMenu } from './menu'
import { applyPreset, CARDS, cleanStoredPrefs, DEFAULT_PREFS, DENSITIES, GUARDS, LOOKS, opt, PRESET_NAMES, prefsFrom, toggle } from './prefs'
import type { PresetName } from './prefs'
import { classify, safeToolName } from './sends'
import type { SendKind } from './sends'

const figures = atom({ plugin: 'nys-workers-comp-hub', key: 'figures' } as const, [], { shape: 'figures-1' })
const drafts = atom({ plugin: 'nys-workers-comp-hub', key: 'drafts' } as const, [], { shape: 'drafts-1' })
const link = atom({ plugin: 'nys-workers-comp-hub', key: 'link' } as const, { tools: null, checkedAt: null, lastAnswerAt: null, problem: null, workspace: 'unknown', workspaceAt: null, sent: null, imports: null, notesWaiting: null, notesReady: [] }, { shape: 'link-1' })
const work = atom({ plugin: 'nys-workers-comp-hub', key: 'work' } as const, { isHubWork: false, skill: null, isDraftingSkill: false, didAutoOpen: false, didOpenDesk: false, didDeclineOffer: false, isLookApplied: false, writes: 0 }, { shape: 'work-1' })
const prefs = atom({ plugin: 'nys-workers-comp-hub', key: 'prefs' } as const, DEFAULT_PREFS, { shape: 'prefs-1' })
const view = atom({ plugin: 'nys-workers-comp-hub', key: 'view' } as const, { name: 'desk', figureId: null, copiedId: null, isAllFigures: false, clearArmed: false }, { shape: 'view-1' })
const tick = atom({ plugin: 'nys-workers-comp-hub', key: 'tick' } as const, 0)
const isDeskOpen = atom({ plugin: 'nys-workers-comp-hub', key: 'isDeskOpen' } as const, false)

// Matcher constants: used as matchers only (runtime checks have their own literals). No nested quantifiers.
const HUB_TOOL = /^mcp__.+__(get_max_min_rate|calculate_weekly_rate|calculate_aww|calculate_slu_award|calculate_lwec_award|calculate_ccp_award|calculate_section_32_split|calculate_burns_lien|calculate_apportionment|get_notice_deadline|lookup_formula|define_term|get_explainer|search_wc_knowledge|search_case_law|lookup_wcb_form|find_providers|list_skills|get_skill|describe_case_schema|add_workspace_cases|get_import_status|calculate_slu_percent_from_rom|calculate_slu_joint_replacement|calculate_benefit_weeks|calculate_fee_split|calculate_aww_with_adjustments|rank_radiculopathy|calculate_ccp_award_detailed|list_hearing_notes|get_hearing_note|mark_hearing_note_posted)$/
const HUB_WRITES = /^mcp__.+__(add_workspace_cases|mark_hearing_note_posted)$/
const SEND_SNAKE = /^mcp__.+_(?:send|reply|forward|post|publish|share|submit|invite|notify|broadcast|tweet)(?:_|$)/
const SEND_CAMEL = /^mcp__.+__[a-z]*(?:Send|Reply|Forward|Post|Publish|Share|Submit|Invite|Notify|Broadcast|Tweet)(?:[A-Z0-9]|$)/
const SEND_LEAD = /^mcp__.+__(?:send|reply|forward|post|publish|share|submit|invite|notify|broadcast|tweet)[A-Z]/
const WRITE_LEAD = /^mcp__.+__(?:create|update|add|insert|upsert|edit|delete|remove|set|write|upload|move|rename|mark|apply|assign|archive|trash|label|merge)(?:[_A-Z]|$)/
const EMAIL_DRAFT = /^mcp__.+__(?:create_draft|update_draft|save_draft|draft_email|create_email_draft)$/
const DOC_PATH = /\.(?:md|markdown|txt|docx|doc|rtf|odt|html|htm|eml)$/i
const CHECKLIST_PATH = /hearing-checklist-[0-9-]{10}[-v0-9]{0,4}\.md$/

const SIGN_IN_TEXT = /sign in|sign-in|expired|revoked|insufficient_scope|unauthori/i
const NOT_ENTITLED_TEXT = /cannot use this permission/i
const SECTION_WORDS = ['review', 'hearings', 'figures', 'connection', 'next'] as const

// One minute tick per loaded module: a reload stops the old timer and starts this flag over with it.
let isTicking = false

type Ran = { deny?: string; isError?: true; result?: unknown; text?: string }

function isRefusedCall(ran: Ran): boolean {
  return typeof ran.deny === 'string' || ran.isError === true
}

// ---- Hub results ----------------------------------------------------------------------------------------

async function settleHub($: EngineInterface, e: Record<string, unknown>, ran: Ran, id: string, name: string, options: PluginOptions): Promise<void> {
  const now = await $.clock.now()
  const isCalc = CALCULATORS.has(name)
  if (typeof ran.deny === 'string') {
    if (isCalc) await update($, figures, l => l.map(f => f.id === id ? { ...f, status: 'error' as const, message: null, at: now } : f))
    await syncStatus($)
    return
  }
  const text = textOf(ran)
  const parsed = parsePayload(text)
  const payload: Payload | null = isHubPayload(parsed) ? parsed : null
  let isBump = false

  if (isCalc) {
    const settled = await update($, figures, l => l.map((f): Figure => {
      if (f.id !== id) return f
      if (payload !== null && typeof payload.calculator === 'string') return { ...distill(payload, f), at: now }
      if (payload !== null && payload.ok === false) return { ...f, status: 'refused', message: str(payload.message), at: now }
      return { ...f, status: 'error', message: null, at: now }
    }))
    if (settled.find(f => f.id === id)?.status === 'refused') isBump = true
  }

  const before = await read($, link)
  const args = argsOf(e)
  const noteId = str(args.id)
  const isOk = payload !== null && payload.ok !== false && ran.isError !== true
  const counts = payload !== null && isRecord(payload.counts) ? payload.counts : null
  const after = await update($, link, (l): HubLink => {
    const next: HubLink = { ...l }
    if (payload !== null) {
      next.lastAnswerAt = now
      next.problem = payload.status === 'rate_limited' || payload.status === 'server_error' ? str(payload.message) : null
    }
    if (SIGN_IN.has(name)) {
      if (payload !== null) { next.workspace = 'signed-in'; next.workspaceAt = now }
      else {
        const t = text ?? ''
        next.workspace = NOT_ENTITLED_TEXT.test(t) ? 'not-entitled' : SIGN_IN_TEXT.test(t) ? 'sign-in' : 'no-answer'
        next.workspaceAt = now
      }
    }
    if (name === 'add_workspace_cases' && counts !== null) {
      const had = l.sent ?? { queued: 0, waiting: 0, inWorkspace: 0, refused: 0 }
      next.sent = {
        queued: had.queued + num(counts.queued) + num(counts.updated),
        waiting: had.waiting + num(counts.duplicate),
        inWorkspace: had.inWorkspace + num(counts.already_imported),
        refused: had.refused + num(counts.refused),
      }
    }
    if (name === 'get_import_status' && counts !== null) {
      next.imports = { imported: num(counts.imported), queued: num(counts.queued), needsReview: num(counts.needs_review), rejected: num(counts.rejected), notFound: num(counts.not_found) }
    }
    if (name === 'list_hearing_notes' && payload !== null && typeof payload.count === 'number') next.notesWaiting = payload.count
    if (name === 'get_hearing_note' && isOk && noteId !== null && !l.notesReady.includes(noteId)) next.notesReady = [...l.notesReady, noteId].slice(-25)
    if (name === 'mark_hearing_note_posted' && isOk && noteId !== null) next.notesReady = l.notesReady.filter(x => x !== noteId)
    return next
  })
  if (after.problem !== null && after.problem !== before.problem) isBump = true
  if (after.workspace === 'sign-in' && before.workspace !== 'sign-in') isBump = true
  if (isBump) await bumpBand($)
  await syncStatus($)
  if (name === 'add_workspace_cases' && counts !== null) await notify($, COPY.toastSent(num(counts.queued) + num(counts.updated), num(counts.refused)))
  if (name === 'mark_hearing_note_posted' && isOk) await notify($, COPY.toastPosted)
  await autoOpen($, options)
}

// ---- drafts -----------------------------------------------------------------------------------------------

type Landing = {
  id: string
  path: string
  kind: 'checklist' | 'document'
  origin: 'write' | 'edit' | 'read'
  text: string | null              // the file's text now, when known
}

function countsOf(kind: Landing['kind'], text: string | null): { checklist: Draft['checklist']; isStale: boolean; isKnown: boolean } {
  if (kind !== 'checklist') return { checklist: null, isStale: false, isKnown: true }
  if (text === null) return { checklist: null, isStale: true, isKnown: false }
  if (text.length > MAX_PARSE) return { checklist: null, isStale: true, isKnown: true }
  return { checklist: parseChecklist(text), isStale: false, isKnown: true }
}

/** Puts a file on the desk, or refreshes the record of the same path. Returns the record and whether it is new. */
async function landFile($: EngineInterface, x: Landing): Promise<{ draft: Draft; isNew: boolean } | null> {
  const now = await $.clock.now()
  const list = await read($, drafts)
  const had = list.find(d => d.path === x.path)
  const isRead = x.origin === 'read'
  const isNew = had === undefined
  const bumpsOrder = !isRead || isNew
  const w = await update($, work, v => ({ ...v, isHubWork: v.isHubWork || x.kind === 'checklist', writes: bumpsOrder ? v.writes + 1 : v.writes }))
  const c = countsOf(x.kind, x.text)
  const where = checklistBase(x.path)
  let landed: Draft | null = null
  await update($, drafts, l => {
    const old = l.find(d => d.path === x.path)
    if (old === undefined) {
      const fresh: Draft = {
        id: x.id, touches: [x.id], kind: x.kind, origin: x.origin, path: x.path, name: baseName(x.path),
        base: x.kind === 'checklist' ? where?.base ?? null : null, version: where?.version ?? 1, key: null, skill: w.skill,
        at: now, order: w.writes, review: 'waiting', reviewedAt: null, isStale: c.isStale, checklist: c.checklist,
      }
      landed = fresh
      return [...l, fresh].slice(-30)
    }
    const touches = old.touches.includes(x.id) ? old.touches : [...old.touches, x.id].slice(-10)
    const refreshed: Draft = isRead
      ? { ...old, touches, isStale: c.isStale, checklist: c.checklist ?? old.checklist }
      : {
        ...old, touches, origin: x.origin, at: now, order: w.writes, review: 'waiting', reviewedAt: null, skill: w.skill ?? old.skill,
        isStale: c.isKnown ? c.isStale : true, checklist: c.isKnown ? c.checklist : old.checklist,
      }
    landed = refreshed
    return l.map(d => d.path === x.path ? refreshed : d)
  })
  return landed === null ? null : { draft: landed, isNew }
}

async function onWrite($: EngineInterface, e: { tool_use_id?: string; file_path: string; content: string }, ran: Ran, options: PluginOptions): Promise<void> {
  if (isRefusedCall(ran)) return
  const r = isRecord(ran.result) ? ran.result : {}
  if (r.staged === true) return
  const path = e.file_path
  const isCheck = isChecklistPath(path)
  const content = typeof r.content === 'string' ? r.content : typeof e.content === 'string' ? e.content : ''
  if (!isCheck) {
    const w = await read($, work)
    if (!isDocPath(path) || isExcludedPath(path) || !w.isHubWork) return
    if (!hasDraftMarker(content) && !w.isDraftingSkill) return
  }
  const now = await $.clock.now()
  const landed = await landFile($, { id: e.tool_use_id ?? `local-${now}`, path, kind: isCheck ? 'checklist' : 'document', origin: 'write', text: content })
  if (landed === null) return
  await bumpBand($)
  await syncStatus($)
  const c = landed.draft.checklist
  await notify($, isCheck && c !== null ? COPY.toastChecklist(c.open, c.verify) : COPY.toastDocument)
  if (isCheck) await autoOpen($, options)
}

async function onEdit($: EngineInterface, e: { tool_use_id?: string; file_path: string; old_string: string; new_string: string; replace_all?: boolean }, ran: Ran): Promise<void> {
  if (isRefusedCall(ran)) return
  const r = isRecord(ran.result) ? ran.result : {}
  if (r.staged === true) return
  const path = e.file_path
  const isCheck = isChecklistPath(path)
  const isOnDesk = (await read($, drafts)).some(d => d.path === path)
  if (!isOnDesk && !isCheck) {
    const w = await read($, work)
    if (!isDocPath(path) || isExcludedPath(path) || !w.isHubWork || !w.isDraftingSkill) return
  }
  const original = str(r.originalFile)
  let text: string | null = null
  if (original !== null && r.userModified !== true) {
    const oldString = str(r.oldString) ?? e.old_string
    const newString = str(r.newString) ?? e.new_string
    const isAll = typeof r.replaceAll === 'boolean' ? r.replaceAll : e.replace_all === true
    text = applyEdit(original, oldString, newString, isAll)
  }
  const now = await $.clock.now()
  const landed = await landFile($, { id: e.tool_use_id ?? `local-${now}`, path, kind: isCheck ? 'checklist' : 'document', origin: 'edit', text })
  if (landed?.isNew === true) await bumpBand($)
  await syncStatus($)
}

async function onRead($: EngineInterface, e: { tool_use_id?: string; file_path: string }, ran: Ran): Promise<void> {
  if (isRefusedCall(ran) || !isChecklistPath(e.file_path)) return
  const r = isRecord(ran.result) ? ran.result : {}
  const file = isRecord(r.file) ? r.file : null
  if (file === null) return
  const isWhole = file.startLine === 1 && num(file.numLines) >= num(file.totalLines) && file.truncatedByTokenCap !== true
  if (!isWhole) return
  const text = str(file.content) ?? (typeof ran.text === 'string' ? stripLineNumbers(ran.text) : null)
  if (text === null) return
  const now = await $.clock.now()
  const landed = await landFile($, { id: e.tool_use_id ?? `local-${now}`, path: e.file_path, kind: 'checklist', origin: 'read', text })
  if (landed?.isNew === true) {
    await bumpBand($)
    const c = landed.draft.checklist
    if (c !== null) await notify($, COPY.toastChecklist(c.open, c.verify))
  }
  await syncStatus($)
}

async function onEmailDraft($: EngineInterface, e: Record<string, unknown>, ran: Ran): Promise<void> {
  if (isRefusedCall(ran)) return
  const w = await read($, work)
  if (!w.isHubWork) return
  const args = argsOf(e)
  const subject = str(args.subject)
  const key = str(args.draft_id) ?? str(args.id)
  const id = str(e.tool_use_id) ?? `local-${await $.clock.now()}`
  const now = await $.clock.now()
  const ww = await update($, work, v => ({ ...v, writes: v.writes + 1 }))
  await update($, drafts, l => {
    const old = key === null ? undefined : l.find(d => d.kind === 'email' && d.key === key)
    const name = subject === null ? (old?.name ?? COPY.kindEmail) : subject.slice(0, 120)
    if (old !== undefined) {
      const touches = old.touches.includes(id) ? old.touches : [...old.touches, id].slice(-10)
      return l.map(d => d === old ? { ...old, touches, name, at: now, order: ww.writes, review: 'waiting' as const, reviewedAt: null } : d)
    }
    const fresh: Draft = {
      id, touches: [id], kind: 'email', origin: 'connector', path: null, name, base: null, version: 1, key, skill: ww.skill,
      at: now, order: ww.writes, review: 'waiting', reviewedAt: null, isStale: false, checklist: null,
    }
    return [...l, fresh].slice(-30)
  })
  await bumpBand($)
  await syncStatus($)
  await notify($, COPY.toastEmail)
}

// ---- the send guard ---------------------------------------------------------------------------------------

function reasonFor(kind: SendKind, name: string): string {
  if (kind === 'hub-write') return name === 'add_workspace_cases' ? COPY.guardWorkspace : COPY.guardPosted
  if (kind === 'send') return COPY.guardSend(safeToolName(name))
  return COPY.guardWrite(safeToolName(name))
}

// ---- commands ---------------------------------------------------------------------------------------------

async function resetPrefs($: EngineInterface, options: PluginOptions): Promise<void> {
  await $.store.delete('prefs').catch(() => undefined)
  const fresh = prefsFrom(options)
  await update($, prefs, () => fresh)
  await applyLook($, fresh)
  await syncStatus($)
}

async function runDesk($: EngineInterface, args: string, options: PluginOptions): Promise<string> {
  const word = args.trim().toLowerCase()
  if (word === '' || word === 'open') {
    const opened = await openDesk($, true)
    await recheckTools($)
    return opened.isPlaced ? COPY.deskOpened : COPY.deskWaits
  }
  if (word === 'close') {
    try { await $.ui.close({ id: 'comp-desk' }) } catch { /* already closed */ }
    return COPY.deskClosed
  }
  if (word === 'clear') { await clearDesk($); return COPY.cleared }
  if (word === 'reset') { await resetPrefs($, options); return COPY.resetDone }
  if (word === 'help') return COPY.deskHelp
  return COPY.deskUnknown
}

function isWord<T extends string>(t: string | undefined, list: readonly T[]): t is T {
  return t !== undefined && (list as readonly string[]).includes(t)
}

async function runLayout($: EngineInterface, args: string): Promise<string> {
  const toks = args.trim().toLowerCase().split(/\s+/).filter(t => t !== '')
  const cur = await read($, prefs)
  if (toks.length === 0) return COPY.layoutList(cur)
  let next: Prefs = cur
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i]
    const after = toks[i + 1]
    if (isWord<PresetName>(t, PRESET_NAMES)) next = applyPreset(next, t)
    else if (isWord(t, DENSITIES)) next = toggle(next, { density: t })
    else if ((t === 'hide' || t === 'show') && isWord(after, SECTION_WORDS)) { next = toggle(next, { sections: { [after]: t === 'show' } }); i += 1 }
    else if (t === 'cards' && isWord(after, CARDS)) { next = toggle(next, { cards: after }); i += 1 }
    else return COPY.layoutHelp
  }
  await savePrefs($, next)
  return COPY.layoutDone(next)
}

async function runLook($: EngineInterface, args: string): Promise<string> {
  const toks = args.trim().toLowerCase().split(/\s+/).filter(t => t !== '')
  const cur = await read($, prefs)
  if (toks.length === 0) return COPY.lookList(cur)
  let look = cur.look
  let serif = cur.serif
  let hasLookWord = false
  for (const t of toks) {
    if (isWord(t, LOOKS)) { look = t; hasLookWord = true }
    else if (t === 'serif') serif = true
    else if (t === 'no-serif') serif = false
    else return COPY.lookHelp
  }
  const next = toggle(cur, { look, serif })
  await savePrefs($, next)
  if (!hasLookWord && next.look === 'app') return COPY.lookList(next)
  const outcome = await applyLook($, next)
  if (outcome === 'set') return COPY.lookSet(look)
  if (outcome === 'not-drawn') return COPY.lookSet(look) + COPY.lookNotDrawn
  if (outcome === 'cleared') return COPY.lookOff
  if (outcome === 'none') return COPY.lookNone
  await savePrefs($, toggle(next, { look: cur.look }))
  return COPY.lookRefused
}

async function startPrefs($: EngineInterface, options: PluginOptions): Promise<Prefs> {
  const fresh = prefsFrom(options)
  let raw: unknown = undefined
  try { raw = await $.store.get('prefs') } catch { raw = undefined }
  const stored = cleanStoredPrefs(raw)
  const chosen = stored !== null && stored.stamp === fresh.stamp ? stored : fresh
  if (chosen !== stored && raw !== undefined && raw !== null) await $.store.delete('prefs').catch(() => undefined)
  await update($, prefs, () => chosen)
  return chosen
}

// ---- registration -------------------------------------------------------------------------------------------

export const register: Register = (on, options) => {
  // 1. Session start: commands, choices, look, the minute tick, the status line. Each step on its own.
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'comp-desk', description: COPY.cmdDesk, argumentHint: '[open|close|clear|reset|help]', immediate: true }).catch(() => undefined)
    await $.command.register({ name: 'comp-desk-layout', description: COPY.cmdLayout, argumentHint: '[desk|focus|figures|glance|quiet] [fit|comfortable|compact] [hide|show <section>] [cards full|compact|off]', immediate: true }).catch(() => undefined)
    await $.command.register({ name: 'comp-desk-look', description: COPY.cmdLook, argumentHint: '[app|paper|paper-light|paper-night] [serif|no-serif]', immediate: true }).catch(() => undefined)
    const p = await startPrefs($, options).catch(() => DEFAULT_PREFS)
    await update($, figures, l => l.some(f => f.status === 'running') ? l.map(f => f.status === 'running' ? { ...f, status: 'error' as const } : f) : l).catch(() => undefined)
    if (p.look !== 'app') await applyLook($, p).catch(() => undefined)
    await recheckTools($)
    if (!isTicking) {
      try {
        $.clock.every(60_000, async () => {
          if (await read($, isDeskOpen).catch(() => false)) await update($, tick, n => n + 1).catch(() => undefined)
        })
        isTicking = true
      } catch { /* ages still show; they redraw at the next change */ }
    }
    await syncStatus($)
    if (options.open_desk === 'on-start') await openDesk($, false)
    return started
  }).catch(($, e, next) => next(e))

  // 2-4. Slash commands. Each answers its own command; nothing is sent.
  on('command.run', { command: 'comp-desk' }, async ($, e) => {
    let text: string = COPY.deskUnknown
    try { text = await runDesk($, e.args, options) } catch { text = COPY.deskFailed }
    return { text, isTextDisplayOnly: true }
  })
  on('command.run', { command: 'comp-desk-layout' }, async ($, e) => {
    let text: string = COPY.layoutHelp
    try { text = await runLayout($, e.args) } catch { text = COPY.deskFailed }
    return { text, isTextDisplayOnly: true }
  })
  on('command.run', { command: 'comp-desk-look' }, async ($, e) => {
    let text: string = COPY.lookHelp
    try { text = await runLook($, e.args) } catch { text = COPY.lookRefused }
    return { text, isTextDisplayOnly: true }
  })

  // 5. A Hub tool call: a running figure first, then the Hub's own answer. The answer goes up unchanged.
  on('tool.call', { tool: HUB_TOOL }, async ($, e, next) => {
    const name = lastSegment(e.tool)
    const at = await $.clock.now().catch(() => 0)
    const id = e.tool_use_id ?? `local-${at}`
    const input = e as unknown as Record<string, unknown>
    await update($, work, w => w.isHubWork ? w : { ...w, isHubWork: true }).catch(() => undefined)
    if (CALCULATORS.has(name)) {
      await update($, figures, l => [...l, { ...emptyFigure(id, name, at), inputs: inputPairs(argsOf(input), true) }].slice(-50)).catch(() => undefined)
    }
    const ran = await next(e)
    await settleHub($, input, ran, id, name, options).catch(() => undefined)
    return ran
  }).catch(($, e, next) => next(e))

  // 6. A document Write: a hearing checklist always; another document during Hub work, when it is a draft.
  on('tool.call', { tool: 'Write', file_path: DOC_PATH }, async ($, e, next) => {
    const ran = await next(e)
    await onWrite($, e, ran, options).catch(() => undefined)
    return ran
  }).catch(($, e, next) => next(e))

  // 7. A document Edit: recount a tracked checklist from the edit the tool reported.
  on('tool.call', { tool: 'Edit', file_path: DOC_PATH }, async ($, e, next) => {
    const ran = await next(e)
    await onEdit($, e, ran).catch(() => undefined)
    return ran
  }).catch(($, e, next) => next(e))

  // 8. A whole-file Read of a hearing checklist: recount it, or put it on the desk.
  on('tool.call', { tool: 'Read', file_path: CHECKLIST_PATH }, async ($, e, next) => {
    const ran = await next(e)
    await onRead($, e, ran).catch(() => undefined)
    return ran
  }).catch(($, e, next) => next(e))

  // 9. An email draft a mail connector made during Hub work: on the desk as unsent.
  on('tool.call', { tool: EMAIL_DRAFT }, async ($, e, next) => {
    const ran = await next(e)
    await onEmailDraft($, e as unknown as Record<string, unknown>, ran).catch(() => undefined)
    return ran
  }).catch(($, e, next) => next(e))

  // 10. The send guard: a send, and the Hub's two writes, wait for the person's own yes in every mode.
  // It never loosens a deny and never answers allow; if it fails, it asks.
  on('tool.check', { tool: [HUB_WRITES, SEND_SNAKE, SEND_CAMEL, SEND_LEAD, WRITE_LEAD] }, async ($, e, next) => {
    const beneath = await next(e)
    if (beneath.decision === 'deny') return beneath
    const guard = opt(options.send_guard, GUARDS, 'sends')
    const kind = classify(e.tool)
    const isHubWork = (await read($, work)).isHubWork
    const asks = kind === 'hub-write'
      || (kind === 'send' && guard !== 'hub-only')
      || (kind === 'write' && guard === 'sends-and-writes' && isHubWork)
    return asks ? { decision: 'ask', reason: reasonFor(kind, lastSegment(e.tool)) } : beneath
  }).catch(() => ({ decision: 'ask', reason: COPY.guardFallback }))

  // 11. A skill of this plugin: Hub work, and the drafts it writes belong on the desk.
  on('skill.prompt', { pluginName: 'nys-workers-comp-hub' }, async ($, e, next) => {
    const key = skillKey(e.skill)
    await update($, work, w => ({ ...w, isHubWork: true, skill: SKILL_LABELS[key] ?? null, isDraftingSkill: w.isDraftingSkill || DRAFTING_SKILLS.has(key) })).catch(() => undefined)
    await syncStatus($)
    await autoOpen($, options).catch(() => undefined)
    return next(e)
  }).catch(($, e, next) => next(e))

  // 12. A short, constant section of working conventions, last, for this session.
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (options.working_conventions === false) return composed
    return { ...composed, sections: [...composed.sections, { id: 'nys-workers-comp-hub:conventions', text: COPY.conventions, scope: 'session' as const }] }
  }).catch(($, e, next) => next(e))

  // 13. The desk.
  on('ui.render', { component: 'Pane', requestId: 'comp-desk' }, ($, e) => drawDesk($, e, options))
    .catch(($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>{COPY.deskFailed}</Text>
    })

  // 14-16. Cards under tool rows. Each keeps the engine's row.
  on('ui.render', { component: 'ToolUse', props: { tool: HUB_TOOL } }, async ($, e, next) => {
    const row = await next(e)
    return drawHubCard($, e, row)
  }).catch(($, e, next) => next(e))
  on('ui.render', { component: 'ToolUse', props: { tool: ['Write', 'Edit', 'Read'], input: { file_path: DOC_PATH } } }, async ($, e, next) => {
    const row = await next(e)
    return drawDraftCard($, e, row)
  }).catch(($, e, next) => next(e))
  on('ui.render', { component: 'ToolUse', props: { tool: EMAIL_DRAFT } }, async ($, e, next) => {
    const row = await next(e)
    return drawEmailCard($, e, row)
  }).catch(($, e, next) => next(e))

  // 17. The row above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const tree = await drawBand($, e, options)
    return tree ?? next(e)
  }).catch(($, e, next) => next(e))

  // 18. Rows in the desktop app's right-click menu.
  on('ui.render', { component: 'ContextMenu' }, async ($, e, next) => {
    const tree = await drawMenu($, e, options)
    return tree ?? next(e)
  }).catch(($, e, next) => next(e))

  // 19. The desk closes: the view goes back to the desk. Never keeps it open.
  on('ui.close', { id: 'comp-desk' }, async ($, e, next) => {
    await update($, isDeskOpen, () => false).catch(() => undefined)
    await update($, view, v => ({ ...v, name: 'desk' as const, figureId: null, clearArmed: false })).catch(() => undefined)
    return next(e)
  }).catch(($, e, next) => next(e))

  // 20. /clear empties this session's desk and starts the new conversation without Hub work;
  // layout choices and the look stay.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await clearDesk($).catch(() => undefined)
      await update($, work, w => ({ ...w, isHubWork: false, skill: null, isDraftingSkill: false, didAutoOpen: false, didDeclineOffer: false })).catch(() => undefined)
      await syncStatus($)
    }
    return next(e)
  }).catch(($, e, next) => next(e))
}

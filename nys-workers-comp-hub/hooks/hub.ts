// Reading the Hub's own results. Pure: no $. Every figure shown comes from a Hub payload's display strings,
// labelled; nothing here computes, rounds or reformats a figure.
import type { Citation, Figure, FigureNotice, Pair } from '../types'
import { clean, cleanDeep } from './clean'
import { COPY, DEFAULT_TITLE, DISPLAY_LABELS, INPUT_LABELS, TITLES } from './copy'

// Where the Hub is. A tool counts as the Hub's only when it comes from this plugin's own server (its name starts
// with OWN_SERVER) or tool.describe reported the Hub's own origin for its server: a same-named tool on another
// server is not the Hub, and its answers are never shown as Hub figures.
export const OWN_SERVER = 'mcp__plugin_nys-workers-comp-hub_nys-workers-comp-hub__'
export const HUB_ORIGIN = 'https://ltibymvlytodkemdeeox.supabase.co'

// The runtime twins of register.tsx's matcher constants (those stay matcher-only).
export const HUB_NAMES: ReadonlySet<string> = new Set([
  'get_max_min_rate', 'calculate_weekly_rate', 'calculate_aww', 'calculate_slu_award', 'calculate_lwec_award', 'calculate_ccp_award',
  'calculate_section_32_split', 'calculate_burns_lien', 'calculate_apportionment', 'get_notice_deadline', 'lookup_formula', 'define_term',
  'get_explainer', 'search_wc_knowledge', 'search_case_law', 'lookup_wcb_form', 'find_providers', 'list_skills', 'get_skill',
  'describe_case_schema', 'add_workspace_cases', 'get_import_status', 'calculate_slu_percent_from_rom', 'calculate_slu_joint_replacement',
  'calculate_benefit_weeks', 'calculate_fee_split', 'calculate_aww_with_adjustments', 'rank_radiculopathy', 'calculate_ccp_award_detailed',
  'list_hearing_notes', 'get_hearing_note', 'mark_hearing_note_posted',
])
export const CALCULATORS: ReadonlySet<string> = new Set([
  'get_max_min_rate', 'calculate_weekly_rate', 'calculate_aww', 'calculate_slu_award', 'calculate_lwec_award', 'calculate_ccp_award',
  'calculate_section_32_split', 'calculate_burns_lien', 'calculate_apportionment', 'get_notice_deadline',
  'calculate_slu_percent_from_rom', 'calculate_slu_joint_replacement', 'calculate_benefit_weeks', 'calculate_fee_split',
  'calculate_aww_with_adjustments', 'rank_radiculopathy', 'calculate_ccp_award_detailed',
])
export const SIGN_IN: ReadonlySet<string> = new Set(['add_workspace_cases', 'get_import_status', 'list_hearing_notes', 'get_hearing_note', 'mark_hearing_note_posted'])
export const HUB_WRITE_NAMES: ReadonlySet<string> = new Set(['add_workspace_cases', 'mark_hearing_note_posted'])
// The engine's own keys on tool.call's input (ToolCallReserved, AgentLoop, ToolRequestMeta): never tool arguments.
export const RESERVED: ReadonlySet<string> = new Set(['tool', 'tool_use_id', 'consent', 'agentId', 'requestMeta'])

const HEADLINE_KEYS: Record<string, readonly string[]> = {
  get_max_min_rate: ['max', 'min'],
  calculate_weekly_rate: ['rate'],
  calculate_aww: ['aww', 'rate'],
  calculate_slu_award: ['award', 'net_to_claimant', 'net', 'rate'],
  calculate_lwec_award: ['weekly_rate', 'award_after_credit', 'award_before_credit'],
  calculate_ccp_award: ['total_award', 'net_to_claimant'],
  calculate_section_32_split: ['net', 'fee'],
  calculate_burns_lien: ['carrier_cost_share', 'net_to_plaintiff'],
  calculate_apportionment: ['total_award', 'total_net'],
  get_notice_deadline: ['deadline'],
  calculate_slu_percent_from_rom: ['range'],
  calculate_slu_joint_replacement: ['slu_percent'],
  calculate_fee_split: ['current_attorney', 'fee_requested_on_oc400_1'],
  calculate_aww_with_adjustments: ['aww', 'weekly_rate'],
  rank_radiculopathy: ['severity_rank', 'total_points'],
  calculate_ccp_award_detailed: ['total_award', 'net_to_claimant'],
}

export type Payload = Record<string, unknown>

export function lastSegment(full: string): string {
  const i = full.lastIndexOf('__')
  return i < 0 ? full : full.slice(i + 2)
}

/** A Hub tool name on any server: the first test only. isHubTool says whether it is the Hub's. */
export function isHubName(full: string): boolean {
  return full.startsWith('mcp__') && HUB_NAMES.has(lastSegment(full))
}

/** A Hub tool name from this plugin's own server, or from a server tool.describe placed at the Hub's origin. */
export function isHubTool(full: string, described: readonly string[]): boolean {
  return isHubName(full) && (full.startsWith(OWN_SERVER) || described.includes(full))
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

export function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

export function parsePayload(text: unknown): Payload | null {
  if (typeof text !== 'string' || text.length > 200_000) return null
  try {
    const v: unknown = cleanDeep(JSON.parse(text))
    return isRecord(v) ? v : null
  } catch {
    return null
  }
}

function firstTextBlock(list: readonly unknown[]): string | null {
  for (const b of list) {
    if (isRecord(b) && b.type === 'text' && typeof b.text === 'string') return b.text
  }
  return null
}

/** The text of a tool.call result, in the order the engine fills it. */
export function textOf(ran: unknown): string | null {
  if (!isRecord(ran)) return null
  if (typeof ran.text === 'string') return ran.text
  if (typeof ran.result === 'string') return ran.result
  if (Array.isArray(ran.result)) return firstTextBlock(ran.result)
  return null
}

/** A ToolUse row's stored output (after a resume, when this session's record is gone). */
export function payloadOfOutput(output: unknown): Payload | null {
  if (typeof output === 'string') return parsePayload(output)
  if (Array.isArray(output)) return parsePayload(firstTextBlock(output))
  if (isRecord(output)) {
    if (isRecord(output.structuredContent)) return cleanRecord(output.structuredContent)
    if (Array.isArray(output.content)) return parsePayload(firstTextBlock(output.content))
    return cleanRecord(output)
  }
  return null
}

function cleanRecord(v: Record<string, unknown>): Payload | null {
  const c = cleanDeep(v)
  return isRecord(c) ? c : null
}

export function isHubPayload(p: Payload | null): p is Payload {
  return p !== null && (typeof p.calculator === 'string' || typeof p.tool === 'string') && isRecord(p.notice)
}

export function humanize(key: string): string {
  const t = clean(key).replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function inputLabel(key: string): string {
  return INPUT_LABELS[key] ?? humanize(key)
}

function cut(v: string, n: number): string {
  return v.length > n ? v.slice(0, n - 1) + '…' : v
}

// While a call runs, its arguments are the model's, not the Hub's: inside a nested value only these fields
// are drawn, so a name tucked into a known argument never reaches the desk.
const NESTED_KNOWN: ReadonlySet<string> = new Set([
  'body_part', 'loss_percent', 'type', 'start_date', 'end_date', 'held_in_abeyance', 'disability_percent', 'current_weekly_earnings',
  'aww', 'date_of_accident', 'body_parts', 'weeks_at_temporary_total', 'prior_payments', 'amount', 'amount_unknown', 'weekly_rate',
])

function show(v: unknown, depth: number, isStrict: boolean): string {
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return clean(v)
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (depth > 3) return ''
  if (Array.isArray(v)) return v.map(x => show(x, depth + 1, isStrict)).filter(x => x !== '').join('; ')
  if (isRecord(v)) {
    return Object.entries(v).filter(([k]) => !isStrict || NESTED_KNOWN.has(k)).map(([k, x]) => {
      if (/_percent$/.test(k)) return `${show(x, depth + 1, isStrict)}%`
      if (typeof x === 'string') return clean(x)
      return `${humanize(k)} ${show(x, depth + 1, isStrict)}`
    }).filter(x => x.trim() !== '').join(' ')
  }
  return ''
}

/** Labelled pairs of an inputs object, in its own order. With `onlyKnown` (a call's own arguments), keys without a
 *  label are left out, and so is any nested field outside NESTED_KNOWN. */
export function inputPairs(inputs: unknown, onlyKnown = false): Pair[] {
  if (!isRecord(inputs)) return []
  const out: Pair[] = []
  for (const [key, v] of Object.entries(inputs)) {
    if (out.length >= 12) break
    if (onlyKnown && INPUT_LABELS[key] === undefined) continue
    const value = cut(show(v, 0, onlyKnown), 80)
    if (value === '') continue
    out.push({ label: inputLabel(key), value })
  }
  return out
}

export function argsOf(e: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(e)) if (!RESERVED.has(k)) out[k] = v
  return out
}

function displayLabel(key: string): string {
  return DISPLAY_LABELS[key] ?? humanize(key)
}

function noticeOf(p: Payload): FigureNotice {
  const n = isRecord(p.notice) ? p.notice : {}
  return { figures: str(n.figures), legal: str(n.not_legal_advice), firm: str(n.not_a_law_firm) }
}

export function titleOf(tool: string): string {
  return TITLES[tool] ?? DEFAULT_TITLE
}

export function emptyFigure(id: string, tool: string, at: number): Figure {
  return {
    id, tool, title: titleOf(tool), status: 'running', at, headline: [], more: [], inputs: [], steps: [], notes: [], citations: [],
    notice: { figures: null, legal: null, firm: null }, message: null, missing: [], problems: [],
  }
}

/** A calculator payload as a Figure. `base` keeps what the running record had (its id, and its inputs when the payload has none). */
export function distill(p: Payload, base: Figure): Figure {
  const tool = typeof p.calculator === 'string' ? p.calculator : base.tool
  const f: Figure = { ...base, tool, title: titleOf(tool), notice: noticeOf(p) }
  const payloadInputs = inputPairs(p.inputs)
  if (payloadInputs.length > 0) f.inputs = payloadInputs
  if (p.ok !== true) {
    f.status = 'refused'
    f.message = str(p.message)
    f.missing = (Array.isArray(p.missing) ? p.missing : []).filter((x): x is string => typeof x === 'string').slice(0, 8).map(inputLabel)
    f.problems = (Array.isArray(p.problems) ? p.problems : [])
      .map(x => (isRecord(x) ? str(x.field) : null)).filter((x): x is string => x !== null).slice(0, 8).map(inputLabel)
    return f
  }
  f.status = 'done'
  const display = isRecord(p.display) ? p.display : {}
  const strings = Object.entries(display).filter((x): x is [string, string] => typeof x[1] === 'string')
  if (tool === 'calculate_benefit_weeks') {
    const periods = (Array.isArray(display.periods) ? display.periods : []).filter(isRecord)
    const weeks = periods.map(x => str(x.weeks)).filter((x): x is string => x !== null)
    f.headline = weeks.length > 0 ? [{ label: displayLabel('weeks'), value: weeks.slice(0, 4).join(', ') }] : []
    f.more = periods.slice(0, 8).flatMap(x => {
      const a = str(x.start_date), b = str(x.end_date), w = str(x.weeks)
      return a !== null && b !== null && w !== null ? [{ label: `${a} to ${b}`, value: w }] : []
    })
  } else {
    const keys = HEADLINE_KEYS[tool] ?? []
    const head = keys.filter(k => typeof display[k] === 'string').slice(0, 3)
    const chosen = head.length > 0 ? head : strings.slice(0, 2).map(x => x[0])
    f.headline = chosen.map(k => ({ label: displayLabel(k), value: display[k] as string }))
    f.more = strings.filter(x => !chosen.includes(x[0])).slice(0, 8).map(([k, v]) => ({ label: displayLabel(k), value: v }))
  }
  f.steps = (Array.isArray(p.steps) ? p.steps : []).filter(isRecord)
    .filter(x => typeof x.label === 'string' && typeof x.display === 'string')
    .slice(0, 24)
    .map(x => ({ label: `${typeof x.step === 'number' || typeof x.step === 'string' ? x.step : '?'}. ${x.label as string}`, value: x.display as string }))
  if (f.headline.length === 0) {
    const last = f.steps[f.steps.length - 1]
    if (last !== undefined) f.headline = [{ label: last.label.replace(/^[^.]*\.\s/, ''), value: last.value }]
  }
  f.notes = (Array.isArray(p.notes) ? p.notes : []).filter((x): x is string => typeof x === 'string').slice(0, 4)
  f.citations = (Array.isArray(p.formulas) ? p.formulas : []).filter(isRecord)
    .flatMap((x): Citation[] => {
      const name = str(x.name), citation = str(x.citation), status = str(x.citation_status)
      return name !== null && citation !== null && status !== null ? [{ name, citation, status }] : []
    }).slice(0, 6)
  return f
}

/** The clipboard text of a figure: its title, its pairs, its inputs and the Hub's own notice lines. */
export function copyText(f: Figure): string {
  const lines = [`${f.title} (Hub estimate)`]
  for (const p of [...f.headline, ...f.more]) lines.push(`${p.label}: ${p.value}`)
  if (f.inputs.length > 0) lines.push(`Inputs: ${f.inputs.map(p => `${p.label} ${p.value}`).join('; ')}`)
  if (f.notice.figures !== null) lines.push(f.notice.figures)
  lines.push(f.notice.firm ?? COPY.disclaimer)
  return lines.join('\n')
}

export function ageOf(at: number, now: number): string {
  const ms = Math.max(0, now - at)
  const m = Math.floor(ms / 60_000)
  if (m < 1) return COPY.justNow
  if (m < 60) return COPY.minutesAgo(m)
  const h = Math.floor(m / 60)
  if (h < 24) return COPY.hoursAgo(h)
  return COPY.daysAgo(Math.floor(h / 24))
}

export function headlineText(pairs: readonly Pair[]): string {
  return pairs.map(p => `${p.label} ${p.value}`).join(' · ')
}

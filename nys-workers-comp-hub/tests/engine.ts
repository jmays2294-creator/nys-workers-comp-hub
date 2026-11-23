// The engine beneath the plugin in every test: each hook here stands for Claude Code and records what the
// suite asked of it. Nothing here reaches a network, a file or a model.
import { mock } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, RenderElement, UiOpenResult } from 'claude-code'
import type { Reply } from './fixtures'

export type Result = Reply | { result: unknown; text?: string; isError?: true }
export type ResultFor = Result | ((e: Record<string, unknown>) => Result)

export type EngineOptions = {
  prompt?: string
  tools?: string[]
  results?: Record<string, ResultFor>
  uiOpen?: UiOpenResult
  themeThrowsOnStyle?: boolean
  store?: Record<string, unknown>
}

export type Fill = { text: string; mode: string | undefined }

export type Log = {
  opened: string[]
  focused: boolean[]
  closed: string[]
  statuses: (string | undefined)[]
  toasts: string[]
  copies: string[]
  fills: Fill[]
  themes: Record<string, unknown>[]
  clears: number
  stored: unknown[]
  deleted: string[]
  submits: string[]
  clock: { advance: (ms: number) => Promise<void> }
}

export const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const
export const PANE = { title: 'The Comp Desk', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } as const
export const BAND = { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 6, bodyColumns: 80, scroll: { offset: 0, bodyRows: 6 }, view: {} } as const
export const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } } as const
export const START = { cwd: '/x', surface: 'desktop', isInteractive: true } as const
export const COMPOSE = { model: 'm', promptModel: 'm', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] } as const

function lastSegment(full: string): string {
  const i = full.lastIndexOf('__')
  return i < 0 ? full : full.slice(i + 2)
}

function builtin(e: Record<string, unknown>): Result {
  const tool = String(e.tool)
  if (tool === 'Write') return { result: { type: 'create', filePath: e.file_path, content: e.content, structuredPatch: [], originalFile: null } }
  if (tool === 'Edit') return { result: { filePath: e.file_path, oldString: e.old_string, newString: e.new_string, originalFile: null, structuredPatch: [], userModified: false, replaceAll: e.replace_all === true } }
  if (tool === 'Read') return { result: { type: 'text', file: { filePath: e.file_path, content: '', numLines: 0, startLine: 1, totalLines: 0 } } }
  return { result: '{}', text: '{}' }
}

export function engine(on: On, opts: EngineOptions = {}): Log {
  const log: Log = {
    opened: [], focused: [], closed: [], statuses: [], toasts: [], copies: [], fills: [], themes: [], clears: 0, stored: [], deleted: [], submits: [],
    clock: { advance: async () => undefined },
  }
  on('store.set', { key: 'prefs' }, (_, e, next) => { log.stored.push(e.value); return next(e) })
  on('store.delete', { key: 'prefs' }, (_, e, next) => { log.deleted.push(e.key); return next(e) })
  mock.store(on, opts.store)
  const clock = mock.clock(on, { now: 1_700_000_000_000 })
  log.clock = { advance: ms => clock.advance(ms) }
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('theme.set', (_, e) => {
    log.themes.push(e as unknown as Record<string, unknown>)
    if (opts.themeThrowsOnStyle === true && e.style !== undefined) throw new Error('an older build: no style')
    return { value: { isDrawn: false, requestId: 'theme', reason: 'test' } }
  })
  on('theme.clear', () => { log.clears += 1; return { value: { isDrawn: false, reason: 'cleared' } } })
  on('ui.log', () => ({ value: undefined }))
  on('ui.open', (_, e) => {
    log.opened.push(e.id)
    log.focused.push(e.focus === true)
    return { value: opts.uiOpen ?? { isPlaced: true } }
  })
  on('ui.close', (_, e) => { log.closed.push(e.id); return { value: undefined } })
  on('ui.status', (_, e) => { log.statuses.push(e.text); return { value: undefined } })
  on('ui.toast', (_, e) => { log.toasts.push(e.text); return { value: undefined } })
  on('ui.copy', (_, e) => { log.copies.push(e.text); return { value: { isCopied: true } } })
  on('prompt.read', () => ({ value: { text: opts.prompt ?? '', cursor: 0 } }))
  on('prompt.fill', (_, e) => { log.fills.push({ text: e.text, mode: e.mode }); return { isFilled: true, text: e.text, cursor: e.text.length } })
  on('prompt.submit', (_, e, next) => { log.submits.push(String(e.text)); return next(e) })
  on('skill.prompt', (_, e) => ({ text: e.text }))
  on('tool.list', () => ({ value: (opts.tools ?? []).map(name => ({ name, description: 'x', mcp: true })) }))
  on('tool.call', (_, e) => {
    const input = e as unknown as Record<string, unknown>
    const answer = opts.results?.[lastSegment(String(input.tool))]
    const r = answer === undefined ? builtin(input) : typeof answer === 'function' ? answer(input) : answer
    return r as never
  })
  return log
}

// A reader standing beside the suite: any plugin may read another's $.state, none may write it. Self-contained,
// as an inline plugin must be.
export const PEEK = {
  name: 'tcd-peek',
  register(on: On) {
    on('command.run', { command: 'tcd-peek' }, async ($, e) => {
      const k = e.args.trim()
      const held: { value?: unknown } = k === 'figures' ? await $.state.get({ plugin: 'nys-workers-comp-hub', key: 'figures' })
        : k === 'drafts' ? await $.state.get({ plugin: 'nys-workers-comp-hub', key: 'drafts' })
        : k === 'link' ? await $.state.get({ plugin: 'nys-workers-comp-hub', key: 'link' })
        : k === 'work' ? await $.state.get({ plugin: 'nys-workers-comp-hub', key: 'work' })
        : k === 'band' ? await $.state.get({ plugin: 'nys-workers-comp-hub', key: 'band' })
        : k === 'prefs' ? await $.state.get({ plugin: 'nys-workers-comp-hub', key: 'prefs' })
        : k === 'view' ? await $.state.get({ plugin: 'nys-workers-comp-hub', key: 'view' })
        : k === 'isDeskOpen' ? await $.state.get({ plugin: 'nys-workers-comp-hub', key: 'isDeskOpen' })
        : {}
      const v = held.value
      const inner = typeof v === 'object' && v !== null && 'shape' in v && 'value' in v ? (v as { value: unknown }).value : v
      return { text: JSON.stringify(inner ?? null) }
    })
  },
}

/** The suite's session value for `key`, read as another plugin would. Needs `{ plugins: [PEEK] }` on the test. */
export async function peek<T = unknown>($: Engine, key: string): Promise<T> {
  const r = await $.command.run({ ...RUN, command: 'tcd-peek', args: key })
  return JSON.parse(r.text ?? 'null') as T
}

export const HUB = 'nys-workers-comp-hub'

/** A tool row's props, as the engine hands them to a ToolUse hook. */
export function toolRow(tool: string, id: string, input: unknown, extra: Record<string, unknown> = {}) {
  return { tool_use_id: id, tool, input, isRunning: false, isErrored: false, isInterrupted: false, ...extra }
}

/** A skill of this plugin starting, as the Skill tool or its slash command raises it. */
export function skillArgs(skill: string) {
  return { skill: `nys-workers-comp-hub:${skill}`, pluginName: 'nys-workers-comp-hub', text: 'skill text', frontmatter: {}, source: 'plugin' }
}

/** The border a drawn root asks for; undefined for the engine's own row or a Box without one. */
export function borderOf(el: RenderElement): unknown {
  return 'props' in el ? (el.props as Record<string, unknown>).borderStyle : undefined
}

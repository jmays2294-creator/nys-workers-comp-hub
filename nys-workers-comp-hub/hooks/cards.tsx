// Cards under tool rows: a Hub calculator's figure with its inputs, a short line under other Hub tools, and
// a note under a draft or an unsent email draft. A card never shows a file name, a path or a subject.
import { atom, memberOf, read, update } from 'claude-code'
import type { EngineInterface, RenderElement, RenderInput, UiPressArgument } from 'claude-code'
import type { Draft, Figure } from '../types'
import { copyOut, fillPrompt, openDesk } from './actions'
import { COPY } from './copy'
import { checklistBase, isChecklistPath, parseChecklist } from './checklist'
import { MAX_PARSE } from './drafts'
import { copyText, distill, emptyFigure, headlineText, isHubPayload, isRecord, lastSegment, num, payloadOfOutput, SIGN_IN, str } from './hub'
import { DEFAULT_PREFS } from './prefs'

const figures = atom({ plugin: 'nys-workers-comp-hub', key: 'figures' } as const, [], { shape: 'figures-1' })
const drafts = atom({ plugin: 'nys-workers-comp-hub', key: 'drafts' } as const, [], { shape: 'drafts-1' })
const prefs = atom({ plugin: 'nys-workers-comp-hub', key: 'prefs' } as const, DEFAULT_PREFS, { shape: 'prefs-1' })
const isCardOpen = atom({ plugin: 'nys-workers-comp-hub', key: 'isCardOpen' } as const, false)

const SIGN_IN_TEXT = /sign in|sign-in|expired|revoked|insufficient_scope|unauthori/i

function isQuiet(e: RenderInput<'ToolUse'>): boolean {
  return e.props.isExpanded === true || e.props.isRunning
}

export async function drawHubCard($: EngineInterface, e: RenderInput<'ToolUse'>, row: RenderElement): Promise<RenderElement> {
  const p = await read($, prefs)
  if (p.cards === 'off' || isQuiet(e)) return row
  const { Box, Text, Button } = $.ui.resolve(e)
  const id = e.props.tool_use_id
  const name = lastSegment(e.props.tool)
  let f: Figure | null = (await read($, figures)).find(x => x.id === id) ?? null
  const payload = f === null ? payloadOfOutput(e.props.output) : null
  if (f === null && isHubPayload(payload) && typeof payload.calculator === 'string') {
    f = distill(payload, emptyFigure(id, payload.calculator, 0))
  }

  if (f !== null) {
    if (f.status !== 'done' && f.status !== 'refused') return row
    const fig = f
    const fill = (text: string) => (press: UiPressArgument) => fillPrompt($, text, press.surface)
    if (p.cards === 'compact') {
      const first = fig.headline[0]
      if (fig.status === 'done') {
        return (
          <Box flexDirection="column">
            {row}
            {first !== undefined ? <Text dimColor maxLines={1}>{COPY.cardCompact(fig.title, first.label, first.value)}</Text> : null}
            {fig.inputs.length > 0 ? <Text dimColor maxLines={1}>{COPY.inputsLine(fig.inputs)}</Text> : null}
          </Box>
        )
      }
      return (
        <Box flexDirection="column">
          {row}
          <Text dimColor maxLines={1}>{COPY.cardRefused(fig.title)}</Text>
          {fig.missing.length > 0 ? <Text dimColor maxLines={1}>{COPY.missingLine(fig.missing)}</Text> : null}
        </Box>
      )
    }
    if (fig.status === 'refused') {
      return (
        <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
          {row}
          <Text dimColor size="caption">{COPY.cardEyebrow}</Text>
          <Text weight="semibold">{fig.title}</Text>
          <Text color="warning">{COPY.nothingCalculated}</Text>
          {fig.message !== null ? <Text dimColor maxLines={3}>{fig.message}</Text> : null}
          {fig.missing.length > 0 ? <Text>{COPY.missingLine(fig.missing)}</Text> : null}
          {fig.problems.length > 0 ? <Text>{COPY.problemsLine(fig.problems)}</Text> : null}
          {fig.missing.length > 0 ? <Button key={`card-missing-${id}`} label={COPY.addMissing} onPress={fill(COPY.fillMissing(fig.title, fig.missing))} /> : null}
        </Box>
      )
    }
    const isOpen = await read($, memberOf(isCardOpen, { requestId: id }))
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
        {row}
        <Text dimColor size="caption">{COPY.cardEyebrow}</Text>
        <Text weight="semibold">{fig.title}</Text>
        {fig.headline.length > 0 ? <Text tabular>{headlineText(fig.headline)}</Text> : null}
        {fig.more.length > 0 ? <Text dimColor maxLines={2}>{headlineText(fig.more)}</Text> : null}
        {fig.inputs.length > 0 ? <Text dimColor maxLines={2}>{COPY.inputsLine(fig.inputs)}</Text> : null}
        {fig.notice.figures !== null ? <Text dimColor size="caption" maxLines={3}>{fig.notice.figures}</Text> : null}
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {fig.steps.length > 0
            ? <Button key={`card-steps-${id}`} label={isOpen ? COPY.hideHow : COPY.howItWasMade} onPress={() => update($, memberOf(isCardOpen, { requestId: id }), x => !x)} />
            : null}
          <Button key={`card-copy-${id}`} label={COPY.copyWithInputs} onPress={(press: UiPressArgument) => copyOut($, copyText(fig), press.surface, null)} />
          <Button key={`card-ask-${id}`} label={COPY.askAbout} onPress={fill(COPY.fillAskFigure(fig.title))} />
        </Box>
        {isOpen ? fig.steps.map(s => <Text dimColor>{COPY.stepLine(s.label, s.value)}</Text>) : null}
        {isOpen ? fig.notes.map(x => <Text dimColor>{x}</Text>) : null}
        {isOpen ? fig.citations.map(c => <Text dimColor>{COPY.citationLine(c)}</Text>) : null}
      </Box>
    )
  }

  const line = otherLine(name, payload, typeof e.props.output === 'string' ? e.props.output : null)
  if (line === null) return row
  return <Box flexDirection="column">{row}<Text dimColor maxLines={3}>{line}</Text></Box>
}

/** The one quiet line under a Hub tool that is not a calculator: the Hub's own words, or a count. */
function otherLine(name: string, payload: Record<string, unknown> | null, text: string | null): string | null {
  if (!isHubPayload(payload)) {
    return SIGN_IN.has(name) && text !== null && SIGN_IN_TEXT.test(text) ? COPY.signInCard : null
  }
  const message = str(payload.message)
  if (payload.ok === false && typeof payload.calculator !== 'string') return message
  if (name === 'lookup_formula' && isRecord(payload.formula)) {
    const a = str(payload.formula.name), b = str(payload.formula.citation), c = str(payload.formula.citation_status)
    return a !== null && b !== null && c !== null ? COPY.formulaLine(a, b, c) : null
  }
  if (name === 'find_providers') return str(payload.important)
  if (name === 'search_case_law') return str(payload.library)
  if (name === 'add_workspace_cases' || name === 'mark_hearing_note_posted') return message
  if (name === 'get_import_status' && isRecord(payload.counts)) {
    const c = payload.counts
    return COPY.importLine({ imported: num(c.imported), queued: num(c.queued), needsReview: num(c.needs_review), rejected: num(c.rejected), notFound: num(c.not_found) })
  }
  if (name === 'list_hearing_notes' && typeof payload.count === 'number') return COPY.notesWaiting(payload.count)
  if (name === 'get_hearing_note' && payload.ok !== false) return COPY.noteReadyCard
  return null
}

function draftFor(list: readonly Draft[], id: string): Draft | undefined {
  return list.find(d => d.touches.includes(id))
}

export async function drawDraftCard($: EngineInterface, e: RenderInput<'ToolUse'>, row: RenderElement): Promise<RenderElement> {
  const p = await read($, prefs)
  if (p.cards === 'off' || isQuiet(e)) return row
  const { Box, Text, Button } = $.ui.resolve(e)
  const id = e.props.tool_use_id
  const d = draftFor(await read($, drafts), id)
  let kind: Draft['kind'] | null = d?.kind ?? null
  let counts = d?.checklist ?? null
  let fileName = d?.name ?? null
  if (d === undefined && e.props.tool === 'Write' && isRecord(e.props.input)) {
    const path = str(e.props.input.file_path)
    const content = str(e.props.input.content)
    if (path !== null && isChecklistPath(path) && checklistBase(path) !== null && content !== null && content.length <= MAX_PARSE) {
      kind = 'checklist'
      counts = parseChecklist(content)
      fileName = path.slice(path.lastIndexOf('/') + 1)
    }
  }
  if (kind === null) return row
  if (kind === 'document') return <Box flexDirection="column">{row}<Text dimColor>{COPY.documentCard}</Text></Box>
  if (kind !== 'checklist') return row
  const line = counts === null ? COPY.tooLong : COPY.checklistLine(counts)
  if (p.cards === 'compact') return <Box flexDirection="column">{row}<Text dimColor maxLines={2}>{`${COPY.checklistCardTitle} · ${line}`}</Text></Box>
  const verify = counts?.verify ?? 0
  const verifyName = fileName
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
      {row}
      <Text weight="semibold">{COPY.checklistCardTitle}</Text>
      <Text>{line}</Text>
      <Text dimColor>{COPY.draftsOnlyLine}</Text>
      <Box flexDirection="row" flexWrap="wrap" gap={1}>
        <Button key={`dc-open-${id}`} label={COPY.openDesk} onPress={() => openDesk($, true)} />
        {verify > 0 && verifyName !== null
          ? <Button key={`dc-verify-${id}`} label={COPY.verifyItems} onPress={(press: UiPressArgument) => fillPrompt($, COPY.fillVerify(verifyName), press.surface)} />
          : null}
      </Box>
    </Box>
  )
}

export async function drawEmailCard($: EngineInterface, e: RenderInput<'ToolUse'>, row: RenderElement): Promise<RenderElement> {
  const p = await read($, prefs)
  if (p.cards === 'off' || isQuiet(e)) return row
  const d = draftFor(await read($, drafts), e.props.tool_use_id)
  if (d === undefined || d.kind !== 'email') return row
  const { Box, Text } = $.ui.resolve(e)
  return <Box flexDirection="column">{row}<Text dimColor>{COPY.emailCard}</Text></Box>
}

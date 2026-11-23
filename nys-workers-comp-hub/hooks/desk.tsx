// The desk: a pane beside the chat with three views (desk, customize, figure). It draws only from this
// session's $.state and the person's layout choices; every figure on it is a Hub display string.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, RenderElement, RenderInput, UiPressArgument } from 'claude-code'
import type { Draft, Figure, PaneView, Prefs, SectionName } from '../types'
import { applyLook, clearDesk, copyOut, fillPrompt, PANE_ID, recheckTools, savePrefs, say, syncStatus } from './actions'
import { COPY, SECTION_ORDER } from './copy'
import { deskNumbers, extOf, latestChecklists } from './drafts'
import { ageOf, copyText, headlineText } from './hub'
import { applyPreset, DEFAULT_PREFS, GUARDS, opt, prefsFrom, toggle } from './prefs'
import type { PrefsChange, PresetName } from './prefs'

const figures = atom({ plugin: 'nys-workers-comp-hub', key: 'figures' } as const, [], { shape: 'figures-1' })
const drafts = atom({ plugin: 'nys-workers-comp-hub', key: 'drafts' } as const, [], { shape: 'drafts-1' })
const link = atom({ plugin: 'nys-workers-comp-hub', key: 'link' } as const, { tools: null, checkedAt: null, lastAnswerAt: null, problem: null, workspace: 'unknown', workspaceAt: null, sent: null, imports: null, notesWaiting: null, notesReady: [] }, { shape: 'link-1' })
const work = atom({ plugin: 'nys-workers-comp-hub', key: 'work' } as const, { isHubWork: false, skill: null, isDraftingSkill: false, didAutoOpen: false, didOpenDesk: false, didDeclineOffer: false, isLookApplied: false, writes: 0 }, { shape: 'work-1' })
const prefs = atom({ plugin: 'nys-workers-comp-hub', key: 'prefs' } as const, DEFAULT_PREFS, { shape: 'prefs-1' })
const view = atom({ plugin: 'nys-workers-comp-hub', key: 'view' } as const, { name: 'desk', figureId: null, copiedId: null, isAllFigures: false, clearArmed: false }, { shape: 'view-1' })
const tick = atom({ plugin: 'nys-workers-comp-hub', key: 'tick' } as const, 0)

// The breathing dot while the Hub calculates: opacity only, still under Reduce Motion. No timer of its own.
const BREATH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="12" height="12">' +
  '<style>@keyframes b{0%,100%{opacity:.35}50%{opacity:.9}}circle{animation:b 2.4s ease-in-out infinite}' +
  '@media (prefers-reduced-motion: reduce){circle{animation:none;opacity:.7}}</style>' +
  '<circle cx="6" cy="6" r="3.5" fill="#E87722"/></svg>'

type Look = Prefs['look']

export async function drawDesk($: EngineInterface, e: RenderInput<'Pane'>, options: PluginOptions): Promise<RenderElement> {
  const { Box, Text, Button, Link } = $.ui.resolve(e)
  const figs = await read($, figures)
  const drs = await read($, drafts)
  const lk = await read($, link)
  const p = await read($, prefs)
  const v = await read($, view)
  await read($, tick)
  const now = await $.clock.now()
  const n = deskNumbers(drs, figs)
  const latest = latestChecklists(drs)

  if (e.props.placement === 'widget') return <Text>{COPY.glanceLine(n.review, n.verify, n.figuresDone, n.hearings)}</Text>

  const placement = e.props.placement === 'inline' ? 'inline' : 'dock'
  const cols = e.props.bodyColumns
  const isNarrow = cols < 36
  const density = p.density === 'fit' ? (cols < 48 || placement !== 'dock' ? 'compact' : 'comfortable') : p.density
  const isComfy = density === 'comfortable' && !isNarrow
  const guard = opt(options.send_guard, GUARDS, 'sends')
  const age = (at: number): string => ageOf(at, now)

  // Presses. Each reads the current value when pressed, never a value captured while drawing.
  const setView = (change: Partial<PaneView>) => update($, view, x => ({ ...x, copiedId: null, ...change }))
  const fill = (text: string) => (press: UiPressArgument) => fillPrompt($, text, press.surface)
  const change = (c: PrefsChange | ((cur: Prefs) => PrefsChange)) => async () => {
    const cur = await read($, prefs)
    await savePrefs($, toggle(cur, typeof c === 'function' ? c(cur) : c))
  }
  const preset = (name: PresetName) => async () => { const cur = await read($, prefs); await savePrefs($, applyPreset(cur, name)) }
  const setLook = (c: { look: Look } | { serif: boolean }) => async () => {
    const cur = await read($, prefs)
    const next = toggle(cur, c)
    await savePrefs($, next)
    if ('serif' in c && next.look === 'app') return
    const outcome = await applyLook($, next)
    if (outcome === 'refused') { await savePrefs($, toggle(next, { look: cur.look })); await say($, COPY.lookRefused) }
    else if (outcome === 'not-drawn') await say($, COPY.lookNotDrawn.trim())
  }
  const markReviewed = (id: string, isReviewed: boolean) => async () => {
    const at = await $.clock.now()
    await update($, drafts, list => list.map(d => d.id !== id ? d : isReviewed ? { ...d, review: 'reviewed' as const, reviewedAt: at } : { ...d, review: 'waiting' as const, reviewedAt: null }))
    await syncStatus($)
  }
  const copy = (text: string, key: string) => (press: UiPressArgument) => copyOut($, text, press.surface, key)
  const copiedLabel = (key: string, label: string): string => v.copiedId === key ? COPY.copied : label

  // ---- the figure view ----------------------------------------------------------------------------------
  const shown = v.name === 'figure' ? figs.find(f => f.id === v.figureId) : undefined
  if (shown !== undefined) return figureView(shown)

  if (v.name === 'customize') return customizeView()

  // ---- the desk view ------------------------------------------------------------------------------------
  const isRunning = figs.some(f => f.status === 'running')
  let dot: RenderElement | null = null
  if (isRunning && p.motion === 'subtle' && e.surface !== 'terminal') {
    const { Svg } = $.ui.resolve(e)
    dot = <Svg source={BREATH} alt={COPY.workingAlt} width={12} height={12} />
  }
  const allZero = n.review === 0 && n.verify === 0 && n.figuresDone === 0 && n.hearings === 0
  const order: readonly SectionName[] = p.order === 'figures-first' ? ['figures', 'review', 'hearings', 'connection', 'next'] : SECTION_ORDER
  const visible = order.filter(x => p.sections[x])

  return (
    <Box flexDirection="column" gap={isComfy ? 1 : 0}>
      <Box flexDirection="column">
        {isComfy ? <Text dimColor size="caption" maxLines={2}>{COPY.strip}</Text> : null}
        <Text size="heading" weight="semibold">{COPY.headline(n.review, n.verify, n.figuresDone, n.hearings)}</Text>
        {allZero ? <Text dimColor>{COPY.headEmptySub}</Text> : null}
        {isRunning ? <Box flexDirection="row" gap={1}>{dot}<Text dimColor>{COPY.working}</Text></Box> : null}
      </Box>
      {isNarrow ? <Text>{COPY.glanceLine(n.review, n.verify, n.figuresDone, n.hearings)}</Text> : glance()}
      {visible.length === 0
        ? <Box flexDirection="column"><Text dimColor>{COPY.sectionsOff}</Text><Button key="customize" label={COPY.customize} onPress={() => setView({ name: 'customize', clearArmed: false })} /></Box>
        : visible.map(x => section(x))}
      <Box flexDirection="column">
        <Text dimColor size="caption">{COPY.disclaimer}</Text>
        {isComfy ? <Text dimColor size="caption">{COPY.draftedByAgent}</Text> : null}
        {isComfy ? <Text dimColor size="caption">{COPY.sessionOnly}</Text> : null}
        {isComfy ? <Link href="https://thecompdesk.com/claude" label={COPY.footerLink} /> : null}
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {visible.length > 0 ? <Button key="customize" label={COPY.customize} onPress={() => setView({ name: 'customize', clearArmed: false })} /> : null}
          <Button key="close" role="dismiss" label={COPY.close} onPress={async () => { try { await $.ui.close({ id: PANE_ID }) } catch { /* already closed */ } }} />
        </Box>
      </Box>
    </Box>
  )

  // ---- pieces ---------------------------------------------------------------------------------------------
  function heading(name: string, count: number | null, extra: RenderElement | null = null): RenderElement {
    return (
      <Box flexDirection="row" gap={1}>
        <Text weight="semibold">{name}</Text>
        {count === null ? null : <Text dimColor tabular>{String(count)}</Text>}
        {extra}
      </Box>
    )
  }

  function lines(list: readonly string[]): RenderElement {
    return <Box flexDirection="column">{list.map((t, i) => i === 0 ? <Text>{t}</Text> : <Text dimColor>{t}</Text>)}</Box>
  }

  function glance(): RenderElement {
    const waiting = drs.filter(d => d.review === 'waiting')
    const oldest = waiting.reduce<number | null>((a, d) => a === null || d.at < a ? d.at : a, null)
    const newestDone = figs.filter(f => f.status === 'done').reduce<number | null>((a, f) => a === null || f.at > a ? f.at : a, null)
    const firstWhen = latest[0]?.checklist?.hearings[0]?.when ?? ''
    const cells: { label: string; value: number; sub: string; isSignal: boolean }[] = [
      { label: COPY.gReview, value: n.review, sub: n.review > 0 && oldest !== null ? COPY.gOldest(age(oldest)) : COPY.gAllClear, isSignal: true },
      { label: COPY.gVerify, value: n.verify, sub: n.verify > 0 ? COPY.gInLists(n.checklistsToVerify) : COPY.gNone, isSignal: true },
      { label: COPY.gFigures, value: n.figuresDone, sub: n.figuresDone > 0 && newestDone !== null ? COPY.gNewest(age(newestDone)) : COPY.gNoneYet, isSignal: false },
      { label: COPY.gHearings, value: n.hearings, sub: n.hearings > 0 && firstWhen !== '' ? COPY.gFirst(firstWhen) : COPY.gNone, isSignal: false },
    ]
    const width = cols >= 56 ? '25%' : '50%'
    const cell = (c: typeof cells[number]): RenderElement => (
      <Box flexDirection="column" width={width}>
        <Text dimColor size="caption">{c.label}</Text>
        <Box flexDirection="row" gap={1}>
          <Text size="title" weight="semibold" tabular>{String(c.value)}</Text>
          {c.isSignal && c.value > 0 ? <Text color="claude">●</Text> : null}
        </Box>
        <Text dimColor size="caption" maxLines={1}>{c.sub}</Text>
      </Box>
    )
    if (cols >= 56) return <Box flexDirection="row">{cells.map(cell)}</Box>
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">{cells.slice(0, 2).map(cell)}</Box>
        <Box flexDirection="row">{cells.slice(2).map(cell)}</Box>
      </Box>
    )
  }

  function section(x: SectionName): RenderElement {
    if (x === 'review') return reviewSection()
    if (x === 'hearings') return hearingsSection()
    if (x === 'figures') return figuresSection()
    if (x === 'connection') return connectionSection()
    return nextSection()
  }

  function draftName(d: Draft): string {
    if (d.kind === 'checklist' || p.names === 'show') {
      if (d.kind === 'email') return d.name === COPY.kindEmail ? COPY.kindEmail : `${COPY.kindEmail} · ${d.name}`
      return `${d.kind === 'checklist' ? COPY.kindChecklist : COPY.kindDocument} · ${d.name}`
    }
    const same = drs.filter(o => o.kind === d.kind)
    const i = same.findIndex(o => o.id === d.id) + 1
    return d.kind === 'email' ? COPY.maskedEmail(i) : COPY.maskedDraft(i, d.path === null ? '' : extOf(d.path))
  }

  function originLine(d: Draft): string {
    const a = age(d.at)
    const base = d.origin === 'write' ? COPY.originWrite(a) : d.origin === 'edit' ? COPY.originEdit(a) : d.origin === 'read' ? COPY.originRead(a) : COPY.originConnector(a)
    return d.skill === null ? base : base + COPY.withSkill(d.skill)
  }

  function reviewRow(d: Draft): RenderElement {
    const isWaiting = d.review === 'waiting'
    const markKey = `rv-mark-${d.id}`
    const markLabel = !isWaiting ? COPY.undo : isNarrow ? COPY.markReviewedShort : COPY.markReviewed
    const mark = <Button key={markKey} label={markLabel} onPress={markReviewed(d.id, isWaiting)} />
    if (isNarrow) {
      return (
        <Box flexDirection="column">
          <Text weight="semibold" dimColor={!isWaiting} maxLines={1} wrap="truncate-end">{draftName(d)}</Text>
          {mark}
        </Box>
      )
    }
    if (!isWaiting) {
      return (
        <Box flexDirection="column">
          <Text dimColor maxLines={isComfy ? 2 : 1}>{draftName(d)}</Text>
          <Text dimColor>{COPY.reviewedLine(age(d.reviewedAt ?? d.at))}</Text>
          <Box flexDirection="row" flexWrap="wrap" gap={1}>{mark}</Box>
        </Box>
      )
    }
    const buttons: RenderElement[] = []
    const c = d.checklist
    if (d.kind === 'checklist' && c !== null && c.verify > 0) buttons.push(<Button key={`rv-verify-${d.id}`} label={COPY.verifyItems} onPress={fill(COPY.fillVerify(d.name))} />)
    if (d.kind === 'document' && p.names === 'show') buttons.push(<Button key={`rv-sum-${d.id}`} label={COPY.summarize} onPress={fill(COPY.fillSummarize(d.name))} />)
    if (isComfy && d.kind === 'checklist' && d.isStale) buttons.push(<Button key={`rv-recount-${d.id}`} label={COPY.recount} onPress={fill(COPY.fillRecount(d.name))} />)
    buttons.push(mark)
    if (isComfy && d.path !== null) {
      if (e.surface === 'terminal') buttons.push(<Link href={'file://' + encodeURI(d.path)} label={COPY.openFile} />)
      else {
        const key = `rv-path-${d.id}`
        buttons.push(<Button key={key} label={copiedLabel(key, COPY.copyPath)} onPress={copy(d.path, key)} />)
      }
    }
    return (
      <Box flexDirection="column">
        <Text weight="semibold" maxLines={isComfy ? 2 : 1}>{draftName(d)}</Text>
        {d.kind === 'checklist'
          ? (c === null ? <Text dimColor>{COPY.tooLong}</Text> : <Text maxLines={isComfy ? 3 : 2}>{COPY.checklistLine(c)}</Text>)
          : null}
        {d.kind === 'checklist' && d.isStale ? <Text color="warning">{COPY.stale}</Text> : null}
        {isComfy ? <Text dimColor maxLines={2}>{originLine(d)}</Text> : null}
        <Box flexDirection="row" flexWrap="wrap" gap={1}>{buttons}</Box>
      </Box>
    )
  }

  function reviewSection(): RenderElement {
    const waiting = drs.filter(d => d.review === 'waiting').sort((a, b) => b.order - a.order || b.at - a.at)
    const reviewed = drs.filter(d => d.review === 'reviewed').sort((a, b) => (b.reviewedAt ?? 0) - (a.reviewedAt ?? 0))
    const w = waiting.slice(0, isComfy ? 10 : 6)
    const r = reviewed.slice(0, 3)
    const rest = reviewed.length - r.length
    const ready = lk.notesReady.length
    const needs = lk.imports?.needsReview ?? 0
    const isEmpty = drs.length === 0 && ready === 0 && needs === 0
    return (
      <Box flexDirection="column">
        {heading(COPY.secReview, n.review)}
        {isEmpty ? lines(COPY.reviewEmpty(guard)) : null}
        {w.map(reviewRow)}
        {r.map(reviewRow)}
        {rest > 0 ? <Text dimColor>{COPY.moreReviewed(rest)}</Text> : null}
        {ready > 0 ? <Box flexDirection="column"><Text>{COPY.notesReady(ready)}</Text><Text dimColor>{COPY.notesReadySub}</Text></Box> : null}
        {needs > 0 ? <Box flexDirection="column"><Text>{COPY.importsReview(needs)}</Text><Link href="https://thecompdesk.com/workspace" label={COPY.openWorkspace} /></Box> : null}
        {isComfy && drs.length > 0 ? <Text dimColor size="caption">{COPY.reviewFooter}</Text> : null}
      </Box>
    )
  }

  function hearingsSection(): RenderElement {
    const total = latest.reduce((a, d) => a + (d.checklist?.hearings.length ?? 0), 0)
    const cap = isComfy ? 12 : 6
    const namesButton = total > 0
      ? <Button key="names" label={p.names === 'show' ? COPY.hideNames : COPY.showNames} onPress={change(cur => ({ names: cur.names === 'show' ? 'hide' : 'show' }))} />
      : null
    const blocks: RenderElement[] = []
    let shownCount = 0
    for (const d of latest) {
      const c = d.checklist
      if (c === null) continue
      if (latest.length > 1) blocks.push(<Text dimColor>{c.dateLine ?? d.name}</Text>)
      for (const hg of c.hearings) {
        if (shownCount >= cap) break
        shownCount += 1
        const masked = COPY.hearingMasked(hg.n)
        const first = [hg.when, hg.purpose].filter(x => x !== '').join(' · ') || masked
        const second = p.names === 'show' ? ([hg.who, hg.wcb].filter(x => x !== '').join(' · ') || masked) : masked
        if (isNarrow) {
          const lead = p.names === 'show' ? (hg.who || masked) : masked
          blocks.push(<Text maxLines={1} wrap="truncate-end">{[lead, hg.when].filter(x => x !== '').join(' · ')}</Text>)
          continue
        }
        const counts = hg.open > 0 && hg.verify > 0
          ? <Text dimColor>{`${hg.open} open · `}<Text color="warning">{`${hg.verify} to verify`}</Text>{hg.done > 0 ? ` · ${hg.done} done` : ''}</Text>
          : <Text dimColor>{COPY.hearingCounts(hg.open, hg.verify, hg.done)}</Text>
        blocks.push(
          <Box flexDirection="column">
            <Text weight="semibold" maxLines={isComfy ? 2 : 1}>{first}</Text>
            <Text maxLines={1}>{second}</Text>
            {counts}
            {isComfy ? <Button key={`hr-open-${d.base ?? d.id}-${hg.n}`} label={COPY.whatIsOpen} onPress={fill(COPY.fillHearingOpen(hg.n, d.name))} /> : null}
          </Box>,
        )
      }
      if (!isNarrow) {
        blocks.push(
          <Box flexDirection="row" flexWrap="wrap" gap={1}>
            <Text dimColor>{COPY.hearingsFrom(d.name)}</Text>
            <Button key={`hr-recount-${d.base ?? d.id}`} label={COPY.recount} onPress={fill(COPY.fillRecount(d.name))} />
          </Box>,
        )
      }
    }
    return (
      <Box flexDirection="column">
        {heading(COPY.secHearings, n.hearings, namesButton)}
        {total === 0 ? lines(COPY.hearingsEmpty) : blocks}
        {total > shownCount ? <Text dimColor>{COPY.more(shownCount, total)}</Text> : null}
        {isComfy && total > 0 ? <Text dimColor size="caption">{COPY.hearingsNote}</Text> : null}
      </Box>
    )
  }

  function figureRow(f: Figure): RenderElement {
    const first = f.headline[0]
    if (isNarrow) {
      return (
        <Box flexDirection="column">
          <Text maxLines={1} wrap="truncate-end">{f.status === 'done' && first !== undefined ? `${f.title} · ${first.label} ${first.value}` : f.title}</Text>
          {f.status === 'done' ? <Button key={`fig-${f.id}`} label={COPY.details} onPress={() => setView({ name: 'figure', figureId: f.id })} /> : null}
        </Box>
      )
    }
    const suffix = f.status === 'running' ? <Text dimColor>{COPY.calculating}</Text>
      : f.status === 'refused' ? <Text color="warning">{COPY.nothingCalculated}</Text>
      : f.status === 'error' ? <Text dimColor>{COPY.noAnswer}</Text> : null
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" flexWrap="wrap" gap={1}><Text weight="semibold">{f.title}</Text>{suffix}</Box>
        {f.status === 'done' && f.headline.length > 0 ? <Text tabular weight="semibold">{headlineText(f.headline)}</Text> : null}
        {f.inputs.length > 0 ? <Text dimColor maxLines={isComfy ? 2 : 1}>{COPY.inputsLine(f.inputs)}</Text> : null}
        {f.status === 'refused' && f.message !== null ? <Text dimColor maxLines={2}>{f.message}</Text> : null}
        {f.status === 'refused' && f.missing.length > 0 ? <Text>{COPY.missingLine(f.missing)}</Text> : null}
        {f.status === 'refused' && f.problems.length > 0 ? <Text>{COPY.problemsLine(f.problems)}</Text> : null}
        {f.status === 'refused' && f.missing.length > 0
          ? <Button key={`fig-missing-${f.id}`} label={COPY.addMissing} onPress={fill(COPY.fillMissing(f.title, f.missing))} />
          : null}
        {f.status === 'done'
          ? (
            <Box flexDirection="row" flexWrap="wrap" gap={1}>
              <Button key={`fig-${f.id}`} label={COPY.details} onPress={() => setView({ name: 'figure', figureId: f.id })} />
              {isComfy ? <Button key={`fig-copy-${f.id}`} label={copiedLabel(`fig-copy-${f.id}`, COPY.copyWithInputs)} onPress={copy(copyText(f), `fig-copy-${f.id}`)} /> : null}
            </Box>
          )
          : null}
      </Box>
    )
  }

  function figuresSection(): RenderElement {
    const newestFirst = [...figs].reverse()
    const limit = v.isAllFigures ? 50 : p.order === 'figures-first' ? 20 : 5
    const list = newestFirst.slice(0, limit)
    const newestDone = newestFirst.find(f => f.status === 'done')
    return (
      <Box flexDirection="column">
        {heading(COPY.secFigures, n.figuresDone)}
        {figs.length === 0 ? lines(COPY.figuresEmpty) : list.map(figureRow)}
        {figs.length > (p.order === 'figures-first' ? 20 : 5)
          ? <Button key="fig-all" label={v.isAllFigures ? COPY.showFewer : COPY.showAll(figs.length)} onPress={() => setView({ isAllFigures: !v.isAllFigures })} />
          : null}
        {newestDone?.notice.figures != null ? <Text dimColor size="caption" maxLines={3}>{newestDone.notice.figures}</Text> : null}
        {figs.length >= 50 ? <Text dimColor size="caption">{COPY.figuresCap}</Text> : null}
      </Box>
    )
  }

  function connectionSection(): RenderElement {
    const hubLine = lk.problem !== null ? <Text color="warning">{COPY.hubProblem(lk.problem)}</Text>
      : lk.lastAnswerAt !== null ? <Text color="success">{COPY.hubAnswered(age(lk.lastAnswerAt))}</Text>
      : lk.tools !== null && lk.tools > 0 ? <Text color="success">{COPY.hubListed(lk.tools)}</Text>
      : lk.tools === 0 ? <Text color="warning">{COPY.hubNotListed}</Text>
      : <Text dimColor>{COPY.hubNotChecked}</Text>
    const ws = lk.workspace === 'signed-in' ? <Text>{COPY.wsSignedIn(age(lk.workspaceAt ?? now))}</Text>
      : lk.workspace === 'sign-in' ? <Text color="warning">{COPY.wsSignIn}</Text>
      : lk.workspace === 'not-entitled' ? <Text>{COPY.wsNotEntitled}</Text>
      : lk.workspace === 'no-answer' ? <Text>{COPY.wsNoAnswer}</Text>
      : <Box flexDirection="column"><Text>{COPY.wsUnknown}</Text>{isNarrow ? null : <Text dimColor>{COPY.wsUnknownSub}</Text>}</Box>
    return (
      <Box flexDirection="column">
        {heading(COPY.secConnection, null)}
        <Box flexDirection="row" flexWrap="wrap" gap={1}>{hubLine}<Button key="check" label={COPY.checkAgain} onPress={() => recheckTools($)} /></Box>
        {ws}
        {isNarrow ? null : <Button key="check-ws" label={COPY.checkWorkspace} onPress={fill(COPY.fillCheckWorkspace)} />}
        {lk.sent !== null ? <Text>{COPY.sentLine(lk.sent)}</Text> : null}
        {lk.imports !== null ? <Text>{COPY.importLine(lk.imports)}</Text> : null}
        {lk.notesWaiting !== null ? <Text>{COPY.notesWaiting(lk.notesWaiting)}</Text> : null}
        <Text dimColor>{COPY.sendsLine(guard)}</Text>
      </Box>
    )
  }

  function nextSection(): RenderElement {
    const hasChecklist = latest.length > 0
    const toVerify = latest.find(d => (d.checklist?.verify ?? 0) > 0)
    const hasDone = figs.some(f => f.status === 'done')
    const picks: { key: string; label: string; text: string }[] = []
    const add = (key: string, label: string, text: string): void => { if (!picks.some(x => x.label === label)) picks.push({ key, label, text }) }
    if (!hasChecklist) add('qa-prep', COPY.qaPrep, COPY.fillPrep)
    if (toVerify !== undefined) add('qa-verify', COPY.qaVerify, COPY.fillVerify(toVerify.name))
    add('qa-32', COPY.qa32, COPY.fill32)
    add('qa-offer', COPY.qaOffer, COPY.fillOffer)
    if (hasDone) add('qa-slu', COPY.qaSlu, COPY.fillSlu)
    else add('qa-rate', COPY.qaRate, COPY.fillRate)
    if ((lk.notesWaiting ?? 0) > 0) add('qa-notes', COPY.qaNotes, COPY.fillNotes)
    else add('qa-ws', COPY.qaWorkspace, COPY.fillWorkspace)
    if (!hasChecklist && picks.length < 6) add('qa-open', COPY.qaOpenChecklist, COPY.fillOpenChecklist)
    if (picks.length < 6) add('qa-rate', COPY.qaRate, COPY.fillRate)
    if (picks.length < 6) add('qa-term', COPY.qaTerm, COPY.fillTerm)
    const limit = isNarrow ? 2 : isComfy ? 6 : 4
    return (
      <Box flexDirection="column">
        {heading(COPY.secNext, null)}
        {isNarrow ? null : <Text dimColor>{COPY.nextHint}</Text>}
        <Box flexDirection={isNarrow ? 'column' : 'row'} flexWrap="wrap" gap={isNarrow ? 0 : 1}>
          {picks.slice(0, limit).map(x => <Button key={x.key} label={x.label} onPress={fill(x.text)} />)}
        </Box>
      </Box>
    )
  }

  // ---- the figure view ----------------------------------------------------------------------------------
  function pairRows(list: readonly { label: string; value: string }[]): RenderElement[] {
    return list.map(x => (
      <Box flexDirection="row" flexWrap="wrap" gap={1}>
        <Text dimColor>{x.label}</Text>
        <Text tabular>{x.value}</Text>
      </Box>
    ))
  }

  function figureView(f: Figure): RenderElement {
    const back = <Button key="back" label={COPY.back} onPress={() => setView({ name: 'desk', figureId: null })} />
    const notices = [f.notice.figures, f.notice.legal, f.notice.firm].filter((x): x is string => x !== null)
    const body = f.status === 'done'
      ? (
        <Box flexDirection="column" gap={isComfy ? 1 : 0}>
          <Box flexDirection="column"><Text weight="semibold">{COPY.headFigures}</Text>{pairRows([...f.headline, ...f.more])}</Box>
          {f.inputs.length > 0 ? <Box flexDirection="column"><Text weight="semibold">{COPY.headInputs}</Text>{pairRows(f.inputs)}</Box> : null}
          {f.steps.length > 0 ? <Box flexDirection="column"><Text weight="semibold">{COPY.headSteps}</Text>{f.steps.map(x => <Text>{COPY.stepLine(x.label, x.value)}</Text>)}</Box> : null}
          {f.citations.length > 0 ? <Box flexDirection="column"><Text weight="semibold">{COPY.headCitations}</Text>{f.citations.map(c => <Text dimColor>{COPY.citationLine(c)}</Text>)}</Box> : null}
          {f.notes.length > 0 ? <Box flexDirection="column"><Text weight="semibold">{COPY.headNotes}</Text>{f.notes.map(x => <Text>{x}</Text>)}</Box> : null}
          {notices.length > 0 ? <Box flexDirection="column">{notices.map(x => <Text dimColor size="caption">{x}</Text>)}</Box> : null}
        </Box>
      )
      : (
        <Box flexDirection="column">
          {f.status === 'refused'
            ? <Text color="warning">{COPY.nothingCalculated}</Text>
            : <Text dimColor>{f.status === 'error' ? COPY.noAnswer : COPY.calculating}</Text>}
          {f.message !== null ? <Text dimColor>{f.message}</Text> : null}
          {f.missing.length > 0 ? <Text>{COPY.missingLine(f.missing)}</Text> : null}
          {f.problems.length > 0 ? <Text>{COPY.problemsLine(f.problems)}</Text> : null}
          {f.inputs.length > 0 ? <Text dimColor>{COPY.inputsLine(f.inputs)}</Text> : null}
          {f.missing.length > 0 ? <Button key="fv-missing" label={COPY.addMissing} onPress={fill(COPY.fillMissing(f.title, f.missing))} /> : null}
        </Box>
      )
    return (
      <Box flexDirection="column" gap={isComfy ? 1 : 0}>
        {back}
        <Box flexDirection="column">
          <Text size="heading" weight="semibold">{f.title}</Text>
          <Text dimColor size="caption">{COPY.cardEyebrow}</Text>
        </Box>
        {body}
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {f.status === 'done' ? <Button key="fv-copy" label={copiedLabel('fv-copy', COPY.copyWithInputs)} onPress={copy(copyText(f), 'fv-copy')} /> : null}
          {f.status === 'done' ? <Button key="fv-ask" label={COPY.askAbout} onPress={fill(COPY.fillAskFigure(f.title))} /> : null}
        </Box>
      </Box>
    )
  }

  // ---- the customize view -------------------------------------------------------------------------------
  function choiceRow(title: string, buttons: readonly { key: string; label: string; isOn: boolean; press: () => Promise<void> }[], under: readonly string[]): RenderElement {
    return (
      <Box flexDirection="column">
        <Text dimColor>{title}</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {buttons.map(b => <Button key={b.key} label={b.label} variant={b.isOn ? 'primary' : 'secondary'} onPress={b.press} />)}
        </Box>
        {under.map(t => <Text dimColor>{t}</Text>)}
      </Box>
    )
  }

  function customizeView(): RenderElement {
    const presets: readonly PresetName[] = ['desk', 'focus', 'figures', 'glance', 'quiet']
    const looks: readonly Look[] = ['app', 'paper', 'paper-light', 'paper-night']
    const reset = async (): Promise<void> => {
      await $.store.delete('prefs').catch(() => undefined)
      const fresh = prefsFrom(options)
      await update($, prefs, () => fresh)
      await applyLook($, fresh)
      await syncStatus($)
    }
    const clear = async (): Promise<void> => {
      const cur = await read($, view)
      if (!cur.clearArmed) { await update($, view, x => ({ ...x, clearArmed: true })); return }
      await clearDesk($)
      await say($, COPY.cleared)
    }
    return (
      <Box flexDirection="column" gap={isComfy ? 1 : 0}>
        <Text size="heading" weight="semibold">{COPY.cHeading}</Text>
        {choiceRow(COPY.cLayout, presets.map(x => ({ key: `p-${x}`, label: COPY.presetName[x], isOn: p.preset === x, press: preset(x) })), [COPY.now(COPY.presetName[p.preset]), COPY.presetAbout[p.preset]])}
        {choiceRow(COPY.cDensity, (['fit', 'comfortable', 'compact'] as const).map(x => ({ key: `d-${x}`, label: COPY.densityName[x], isOn: p.density === x, press: change({ density: x }) })), [COPY.now(COPY.densityName[p.density])])}
        {choiceRow(COPY.cSections, SECTION_ORDER.map(x => ({ key: `s-${x}`, label: COPY.shownHidden(COPY.sectionName[x], p.sections[x]), isOn: p.sections[x], press: change(cur => ({ sections: { [x]: !cur.sections[x] } })) })), [])}
        {choiceRow(COPY.cAround, [
          { key: 'b-band', label: COPY.onOff(COPY.bandName, p.band), isOn: p.band, press: change(cur => ({ band: !cur.band })) },
          { key: 'b-status', label: COPY.onOff(COPY.statusName, p.status), isOn: p.status, press: change(cur => ({ status: !cur.status })) },
          { key: 'b-notices', label: COPY.onOff(COPY.noticesName, p.notices), isOn: p.notices, press: change(cur => ({ notices: !cur.notices })) },
        ], [])}
        {choiceRow(COPY.cCards, (['full', 'compact', 'off'] as const).map(x => ({ key: `c-${x}`, label: COPY.cardsName[x], isOn: p.cards === x, press: change({ cards: x }) })), [COPY.now(COPY.cardsName[p.cards])])}
        {choiceRow(COPY.cNames, (['show', 'hide'] as const).map(x => ({ key: `n-${x}`, label: COPY.namesName[x], isOn: p.names === x, press: change({ names: x }) })), [COPY.namesNote])}
        {choiceRow(COPY.cLook, looks.map(x => ({ key: `l-${x}`, label: COPY.lookName[x], isOn: p.look === x, press: setLook({ look: x }) })), [COPY.lookNote])}
        {choiceRow(COPY.cSerif, [
          { key: 'serif-on', label: COPY.serifName.on, isOn: p.serif, press: setLook({ serif: true }) },
          { key: 'serif-off', label: COPY.serifName.off, isOn: !p.serif, press: setLook({ serif: false }) },
        ], [])}
        {choiceRow(COPY.cMotion, (['subtle', 'off'] as const).map(x => ({ key: `m-${x}`, label: COPY.motionName[x], isOn: p.motion === x, press: change({ motion: x }) })), [COPY.motionNote])}
        <Text dimColor size="caption">{COPY.savedNote}</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          <Button key="reset" label={COPY.backToOptions} onPress={reset} />
          <Button key="clear" label={v.clearArmed ? COPY.clearArmed : COPY.clearDesk} onPress={clear} />
          <Button key="done" variant="primary" label={COPY.done} onPress={() => setView({ name: 'desk', clearArmed: false })} />
        </Box>
      </Box>
    )
  }
}

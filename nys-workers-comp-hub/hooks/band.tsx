// The quiet row above the prompt: one line, only when something new needs the person, never while a turn
// runs. It carries counts and the Hub's own words, never a name, a path or a subject.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, RenderElement, RenderInput, UiPressArgument } from 'claude-code'
import { fillPrompt, isDeskShown, openDesk } from './actions'
import { COPY } from './copy'
import { deskNumbers } from './drafts'
import { DEFAULT_PREFS, OPEN_DESK, opt } from './prefs'

const figures = atom({ plugin: 'nys-workers-comp-hub', key: 'figures' } as const, [], { shape: 'figures-1' })
const drafts = atom({ plugin: 'nys-workers-comp-hub', key: 'drafts' } as const, [], { shape: 'drafts-1' })
const link = atom({ plugin: 'nys-workers-comp-hub', key: 'link' } as const, { tools: null, checkedAt: null, lastAnswerAt: null, problem: null, workspace: 'unknown', workspaceAt: null, sent: null, imports: null, notesWaiting: null, notesReady: [] }, { shape: 'link-1' })
const work = atom({ plugin: 'nys-workers-comp-hub', key: 'work' } as const, { isHubWork: false, skill: null, isDraftingSkill: false, didAutoOpen: false, didOpenDesk: false, didDeclineOffer: false, isLookApplied: false, writes: 0 }, { shape: 'work-1' })
const band = atom({ plugin: 'nys-workers-comp-hub', key: 'band' } as const, { version: 0, hiddenVersion: 0 }, { shape: 'band-1' })
const prefs = atom({ plugin: 'nys-workers-comp-hub', key: 'prefs' } as const, DEFAULT_PREFS, { shape: 'prefs-2' })
const isDeskOpen = atom({ plugin: 'nys-workers-comp-hub', key: 'isDeskOpen' } as const, false)

/** The band's row, or null for none (the hook then hands the band on unchanged). */
export async function drawBand($: EngineInterface, e: RenderInput<'AbovePrompt'>, options: PluginOptions): Promise<RenderElement | null> {
  const p = await read($, prefs)
  if (!p.band || e.props.hasSurvey || e.props.isWorking) return null
  // The desk is up: by the suite's own mark, or by the engine's record (a waiting open the surface placed later).
  if (await read($, isDeskOpen)) return null
  if (await isDeskShown($)) return null
  const b = await read($, band)
  const figs = await read($, figures)
  const lk = await read($, link)
  const w = await read($, work)
  const n = deskNumbers(await read($, drafts), figs)
  const isNew = b.version > b.hiddenVersion
  const isShort = e.props.bodyColumns < 50
  const { Box, Text, Button } = $.ui.resolve(e)

  const hide = <Button key="band-hide" label={COPY.hide} onPress={() => update($, band, x => ({ ...x, hiddenVersion: x.version }))} />
  const open = <Button key="band-open" label={COPY.openDesk} onPress={() => openDesk($, true)} />
  const row = (words: string, buttons: readonly (RenderElement | null)[]): RenderElement => (
    <Box flexDirection="row" gap={1}>
      <Text dimColor wrap="truncate-end">{words}</Text>
      {buttons}
    </Box>
  )

  const newest = figs[figs.length - 1]
  if (isNew && newest !== undefined && newest.status === 'refused') {
    const add = newest.missing.length > 0
      ? <Button key="band-missing" label={COPY.addIt} onPress={(press: UiPressArgument) => fillPrompt($, COPY.fillMissing(newest.title, newest.missing), press.surface)} />
      : null
    return row(COPY.bandRefused(newest.title, newest.missing, newest.problems), [add, hide])
  }
  if (isNew && lk.workspace === 'sign-in') return row(COPY.bandSignIn, [hide])
  if (isNew && lk.problem !== null) return row(COPY.bandProblem(lk.problem), [hide])
  if (isNew && (n.review > 0 || n.verify > 0)) return row(isShort ? COPY.bandNeedsShort(n.review, n.verify) : COPY.bandNeeds(n.review, n.verify), [open, hide])
  if (opt(options.open_desk, OPEN_DESK, 'offer') === 'offer' && n.figuresDone > 0 && !w.didOpenDesk && !w.didDeclineOffer) {
    const notNow = <Button key="band-not-now" label={COPY.notNow} onPress={() => update($, work, x => ({ ...x, didDeclineOffer: true }))} />
    return row(isShort ? COPY.bandOfferShort : COPY.bandOffer, [open, notNow])
  }
  return null
}

// The Comp Desk suite's session state. Nothing here is written to $.store: $.store holds one key, 'prefs'
// (Prefs), and nothing else. Other plugins in the session can read $.state, so this keeps the minimum:
// counts, labels, file names and the Hub's own display strings. Never a document's text, a hearing note's
// text or a tool's whole output.

export type Pair = { label: string; value: string }
export type Citation = { name: string; citation: string; status: string }
export type FigureNotice = { figures: string | null; legal: string | null; firm: string | null }

export type Figure = {
  id: string                       // tool_use_id, or 'local-<at>' for a call without one
  tool: string                     // last segment, e.g. 'calculate_slu_award'
  title: string                    // TITLES[tool] ?? 'Hub calculation'
  status: 'running' | 'done' | 'refused' | 'error'
  at: number                       // $.clock.now() when it started, then when it settled
  headline: Pair[]                 // <= 3, values are the Hub's display strings
  more: Pair[]                     // <= 8, the rest of display, Hub order
  inputs: Pair[]                   // <= 12, the payload's inputs (known keys of the call while running)
  steps: Pair[]                    // <= 24, '<step>. <label>' and display
  notes: string[]                  // <= 4, verbatim
  citations: Citation[]            // <= 6, verbatim
  notice: FigureNotice             // notice.figures / not_legal_advice / not_a_law_firm, verbatim
  message: string | null           // refusal, rate-limit or problem message, verbatim
  missing: string[]                // <= 8, labels of the field names the Hub listed as missing
  problems: string[]               // <= 8, labels of the field names in problems[]
}

export type HearingRow = {
  n: number                        // section number in the checklist
  who: string                      // claimant label as written (client data)
  wcb: string                      // 'WCB DEMO-0001' as written (client data)
  when: string                     // '12/03/2026 9:30 AM' as written
  purpose: string                  // 'Permanency (SLU)' as written
  open: number
  verify: number                   // open items with a '(verify)' Rule line
  done: number
}

export type ChecklistCounts = {
  dateLine: string | null          // H1 after 'Hearing checklist: ', as written
  hearings: HearingRow[]           // <= 12
  hearingCount: number             // all hearings, past the cap too
  open: number
  done: number
  verify: number
  conflicts: number
  notFound: number
  odd: number
  signed: 'yes' | 'no' | 'unknown' // the 'Verified by:' line filled in, still underscores, or absent
}

export type Draft = {
  id: string                       // first tool_use_id that put it on the desk
  touches: string[]                // tool_use_ids that wrote, edited or read it, <= 10
  kind: 'checklist' | 'document' | 'email'
  origin: 'write' | 'edit' | 'read' | 'connector'
  path: string | null              // absolute path for files (session only); null for email
  name: string                     // basename, or the email subject cut to 120
  base: string | null              // checklist date 'YYYY-MM-DD', else null
  version: number                  // checklist -vN, 1 when none
  key: string | null               // an email draft's draft_id / id input, when given
  skill: string | null             // SKILL_LABELS value of the newest Hub skill when it landed
  at: number
  order: number                    // write order this session (work.writes)
  review: 'waiting' | 'reviewed'
  reviewedAt: number | null
  isStale: boolean                 // counts may be out of date (edit not replayable, user-modified, too long)
  checklist: ChecklistCounts | null
}

export type HubLink = {
  tools: number | null             // distinct Hub tools in $.tool.list() at the last check (OWN_SERVER or hubTools)
  checkedAt: number | null
  lastAnswerAt: number | null      // last parsable Hub payload
  problem: string | null           // Hub message verbatim (rate limit, server error), else null
  workspace: 'unknown' | 'signed-in' | 'sign-in' | 'not-entitled' | 'no-answer'
  workspaceAt: number | null
  sent: { queued: number; waiting: number; inWorkspace: number; refused: number } | null
  imports: { imported: number; queued: number; needsReview: number; rejected: number; notFound: number } | null
  notesWaiting: number | null      // list_hearing_notes count
  notesReady: string[]             // get_hearing_note ids seen and not yet marked posted, <= 25
}

export type Work = {
  isHubWork: boolean               // a Hub tool, Hub skill or Hub command ran, or a checklist was written or read
  skill: string | null             // SKILL_LABELS value of the newest Hub skill
  isDraftingSkill: boolean         // a Hub drafting skill ran this session (drafts.ts DRAFTING_SKILLS)
  didAutoOpen: boolean
  didOpenDesk: boolean             // the desk was placed at least once this session
  didDeclineOffer: boolean         // the person pressed Not now on the band's offer
  isLookApplied: boolean           // this plugin set the theme in this session
  writes: number                   // counter for Draft.order
}

export type Band = { version: number; hiddenVersion: number }

export type SectionName = 'review' | 'hearings' | 'figures' | 'connection' | 'next'
export type Sections = { review: boolean; hearings: boolean; figures: boolean; connection: boolean; next: boolean }
export type Preset = 'desk' | 'focus' | 'figures' | 'glance' | 'quiet' | 'custom'
export type Look = 'app' | 'paper' | 'paper-light' | 'paper-night'
export type Guard = 'sends' | 'sends-and-writes' | 'hub-only'

export type Prefs = {
  v: 1
  preset: Preset
  order: 'review-first' | 'figures-first'
  sections: Sections
  band: boolean
  status: boolean
  notices: boolean
  cards: 'full' | 'compact' | 'off'
  density: 'fit' | 'comfortable' | 'compact'
  names: 'show' | 'hide'
  look: Look
  serif: boolean
  motion: 'subtle' | 'off'
}

export type PaneView = {
  name: 'desk' | 'customize' | 'figure'
  figureId: string | null
  copiedId: string | null          // the button that reads 'Copied' until the view changes
  isAllFigures: boolean
  clearArmed: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'nys-workers-comp-hub': {
      figures: Shaped<Figure[]>          // shape 'figures-1', newest last, <= 50
      drafts: Shaped<Draft[]>            // shape 'drafts-1', newest last, <= 30
      link: Shaped<HubLink>              // shape 'link-1'
      work: Shaped<Work>                 // shape 'work-1'
      band: Shaped<Band>                 // shape 'band-1'
      prefs: Shaped<Prefs>               // shape 'prefs-2', session mirror of $.store 'prefs'
      view: Shaped<PaneView>             // shape 'view-1'
      tick: number                       // minute counter while the desk is open (ages redraw)
      isDeskOpen: boolean
      isCardOpen: StateFamily<boolean>   // "How it was made" on a card, per tool_use_id
      hubTools: Shaped<string[]>         // shape 'hub-tools-1': full names tool.describe placed at the Hub's origin, <= 96
    }
  }
}

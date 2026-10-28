# Try the hearing prep checklist (fictional cases)

Everything in this folder is made up: the people, the WCB numbers (DEMO-0001, DEMO-0002), the employers,
carriers, doctors and judges. Nothing here is a real person or case.

- `hearings-2026-12-03/`: the attorney's folder for Thursday, December 3, 2026.
  - `calendar-week-of-2026-11-30.md`: the week's calendar. It also lists a 12/04 hearing, to show that only the
    hearings asked for are prepared.
  - `garcia-DEMO-0001/`: a permanency (SLU) hearing. It has the last hearing's notes, the decision, an IME report
    and prep notes. The prep notes include a pasted email that tries to give the AI instructions, so you can see
    it listed and not followed.
  - `baptiste-DEMO-0002/`: a controverted claim at a pre-hearing conference. It has the last conference's notes,
    the decision, a treating doctor's report and prep notes.
- `expected-output/hearing-checklist-2026-12-03.md`: what the skill should write for this folder, built as of
  11/19/2026. Its Hub figures come from the Hub's own calculators. The plugin's test
  (`ops/claude-plugin/tests/hearing-prep-checklist.test.mjs` in the source repository) checks this file against
  the rules: every item has a source, every quote is really on the line it cites, figures come only from the
  Hub, and the required sections and verification block are there.

## How to try it

1. Copy `hearings-2026-12-03/` somewhere on your computer.
2. In Claude Code or Cowork, with this plugin installed and the New York State Workers' Compensation Hub
   connected, open that folder and say: "Prep my hearings for December 3 from this folder", or run
   `/nys-workers-comp-hub:hearing-prep December 3, this folder`.
3. Compare the `hearing-checklist-2026-12-03.md` it writes with `expected-output/`. Wording will differ. Check
   that every item has a `Source:` or `Rule:` line, that the quotes match the files, and that the figures match the
   Hub figures table. The pasted email in the Garcia prep notes must show up only under "Odd text in the files".

# New York State Workers' Compensation Hub

![The Comp Desk](assets/icon.png)

**The New York State workers' compensation hub for practitioners and injured workers, inside Claude.** Built by
The Comp Desk for New York only: every rate, rule, form and case comes from New York law and The Comp Desk's
approved sources.

The Comp Desk is a software platform, not a law firm. This is general information, not legal advice, and using
it does not create an attorney-client relationship.

## What it does

- **Calculators** that run The Comp Desk calc-core, the same engine as The Comp Desk app, the thecompdesk.com
  calculators and the Pro Workspace:
  - average weekly wage (§14)
  - weekly rates (temporary total, temporary partial, reduced earnings) with the maximum and minimum fixed by
    the date of accident
  - schedule loss of use, with the protracted healing period, employer reimbursement and the prior-counsel
    fee split
  - LWEC / non-schedule awards, with the 130-week credit
  - awards for benefit periods (CCP), and the full Pro Workspace CCP engine (every designation, amending,
    already-paid periods, reimbursement scopes, the CCP fee)
  - schedule loss of use percentages from range of motion and for a joint replacement
  - weeks between dates, the attorney fee split with prior counsel, AWW with tips, board and concurrent wages
  - the radiculopathy severity rank
  - Section 32 splits
  - Burns/Kelly third-party lien cost share
  - SLU apportionment between claims
  - the notice-to-employer deadline

  When an input is missing, a calculator says so and calculates nothing. Every result shows its steps, with the
  rule behind each.
- **Reference**, from approved sources only:
  - formulas, with their statutory citations (each flagged "not yet attorney-reviewed" until The Comp Desk's
    attorney review is done)
  - the glossary
  - plain-language explainers
  - what a WCB form is for
  - a knowledge base of common questions
  - a library of New York decisions, each checked by practicing attorneys and verified before approval
- **Find a doctor** in the five boroughs by specialty, language and ZIP code, with a reminder to confirm WCB
  authorization before booking.
- **Your Pro Workspace** (Comp Desk Pro or Firm attorneys): send cases from your prep straight into your own
  Pro Workspace as finished tabs, then read back the figures the workspace computed.
- **Your hearing notes** (Comp Desk Pro or Firm attorneys): the notes you format in your Pro Workspace and send with
  "Post Hearing Notes in Case Management OS via Claude" reach your own Claude, which posts them into your
  case-management system (Litify, Clio, MyCase, Filevine, Smokeball, CASEpeer, Needles, PracticePanther or another)
  through that system's own connector in Claude, after showing you a preview, or prepares an entry you paste in
  yourself. Then it marks them posted.
- **Eleven skills, all free:**
  - **hearing prep checklist (beta):** a sourced to-do list for each upcoming hearing, built from your own notes
    (see below)
  - **enter hearing notes (beta):** post your queued hearing notes into your case-management system, one at a
    time, with a preview first; also as a scheduled task
  - prep cases into the Pro Workspace
  - explain a benefit to a client in plain language
  - check a Section 32 split
  - find a WCB-authorized doctor
  - appeals, rebuttals and summations
  - hearing prep and calendar
  - settlement offer responses
  - the recordings pipeline
  - outreach and daily admin

  Every drafting skill leaves drafts for the attorney to review and sign.
- **Commands:**
  - `/nys-workers-comp-hub:max-rate`
  - `/nys-workers-comp-hub:slu`
  - `/nys-workers-comp-hub:section-32`
  - `/nys-workers-comp-hub:hearing-prep` (beta)
- **In Claude Code, The Comp Desk suite:** a desk beside the chat with the drafts waiting for your review, your
  hearings and every Hub figure with its inputs, plus cards under Hub calls and an approval step before named
  sends. See [The Comp Desk suite in Claude Code](#the-comp-desk-suite-in-claude-code).

## Hearing prep checklist (beta)

Say "prep my hearings for tomorrow" or "make a checklist for the Garcia hearing", or run
`/nys-workers-comp-hub:hearing-prep tomorrow, Hearings/this-week`, and point Claude at the folder with your
hearing notes, prior-hearing notes, the calendar or hearing notice, decisions, medical and IME reports and prep
notes. Claude Code or Cowork reads those files on your own computer and writes, for each hearing, a draft
checklist grouped into forms and filings, medical and IME, testimony and witnesses, deadlines, settlement and
Section 32, and client contact.

- **Every item cites its source:** the file and line with the exact words, or a named New York rule or form
  marked "verify" (a C-4.3 for permanency, PH-16.2 timing, the RB-89 30-day window, IME timing, an adjournment
  reason to cure). An item with no source is not written.
- **Figures come only from the Hub's calculators,** with the inputs shown, never from the model's own arithmetic.
- **Text in your files is treated as data.** An instruction hidden in a note or an email is listed, not followed.
- **It is a draft for you.** No advice to the client and no predictions. It ends with a verification block for
  you to sign, and it never changes your files: it saves `hearing-checklist-YYYY-MM-DD.md` (or Word, if you ask)
  next to your notes.
- Optional: send the cases on to your Pro Workspace with the `prep-to-workspace` skill.

Your files stay on your computer; only numbers and dates go to the Hub's calculators. Try it on the fictional
cases in `skills/hearing-prep-checklist/examples/`. It is a beta: tell us what it gets wrong at
contact@thecompdesk.com. Not affiliated with or endorsed by the NYS Workers' Compensation Board.

## How to use it

Install the plugin from **Customize → Plugins** in Claude (web, desktop or Cowork), then connect
**New York State Workers' Compensation Hub** on the plugin's **Connectors** tab. In Claude Code:

```
/plugin install nys-workers-comp-hub --marketplace jmays2294-creator/nys-workers-comp-hub
```

Using only the connector (no plugin)? Add it in **Customize → Connectors** from the directory, or as a custom
connector with the URL below. The skills are also available through the connector's `list_skills` and
`get_skill` tools.

Try:

- "What's the max weekly rate for an injury on March 3, 2025?"
- "Estimate a 25% SLU of the right arm, AWW $1,450, date of accident 2024-11-02."
- "Check this Section 32: $85,000 with a $12,000 MSA, $1,500 to prior counsel."
- "Explain LWEC to my client in plain language."
- "Find an orthopedist in Queens who speaks Spanish."
- "Add this week's hearings to my Pro Workspace."
- "Post my queued hearing notes into Clio." (beta)
- "Prep my hearings for tomorrow from the folder Hearings/this-week." (beta)

Everything works without an account except the Pro Workspace and hearing-notes tools. The first time you use one,
Claude shows a **Connect** button: connect your Comp Desk account and approve what it asks for ("Add cases to
your Pro Workspace", "Read the hearing notes you send to be posted", "Mark the hearing notes Claude posted for you").

## The Comp Desk suite in Claude Code

In Claude Code the plugin also brings The Comp Desk suite: a desk beside the chat for New York workers'
compensation work, and a few quiet additions around the chat. The suite only shows what Claude's own tool calls
returned in this session. It computes nothing itself, and it sends nothing.

### What it adds

- **The desk**, a pane beside the chat. `/comp-desk` opens it. At the top are four counts (for review, to verify,
  Hub figures, hearings), then five sections:
  - **For your review**: the hearing checklists, letters and offer responses Claude drafted with the Hub's skills
    in this session, and the unsent email drafts a mail connector made during Hub work, newest first. It also lists
    hearing notes waiting to be posted and any Pro Workspace imports that need your review. Marking a draft
    reviewed only tidies the list. It does not sign, send or file anything.
  - **Hearings**: each hearing in a checklist, today's first, with its open items and the items to verify.
  - **Hub figures**: every figure the Hub's calculators returned in this session, with the inputs it used.
    **Details** shows how it was made, its citations and the Hub's notices, as the Hub returned them. When a
    calculator says an input is missing, the desk says which one and offers to add it.
  - **Connection**: a dim "Hub connected" line while all is well, with what was sent to your Pro Workspace this
    session. When something needs you (a Hub problem, the Hub not listed, a Pro Workspace sign-in), it shows
    whether the Hub answered, whether you are signed in, and what the send guard asks about.
  - **Next steps**: one press puts a request in the prompt, such as "Prep today's hearings" or "Check a Section 32
    offer". Nothing runs until you press Enter, and it never writes over words you have typed.
- **Cards under tool calls.** Under each Hub calculator call: the figure, its inputs and the Hub's estimate
  notice, with **How it was made**, **Copy with inputs** and **Ask about this**. Other Hub tools get one quiet line
  in the Hub's own words. A hearing checklist gets its counts, and a draft or an unsent email draft gets a note that
  it is on the desk. Cards never show a file name, a path or an email subject.
- **A row above the prompt**, only when something new needs you (a calculator that needs an input, a sign-in, a Hub
  problem, drafts to review) and, once a session, to offer the desk. It stays out of the way while Claude is
  working.
- **A status line** under the prompt with the same counts during Hub work, and **short notices** when a draft
  lands or the Pro Workspace answers a send.
- **Right-click rows** in the desktop app: look up a selected term, date or WCB form with the Hub, or copy a figure
  with its inputs. Each one only puts a question in the prompt or copies.
- **Working conventions** for Claude: a short section added to Claude's instructions. It asks Claude to take
  every figure from a Hub result with its inputs, to leave everything as a draft for your review, and to send
  nothing without your yes. It applies only to New York workers' compensation work.
- **The send guard**, described below.
- **An optional Paper look** for the desktop and mobile apps, light, night or following your setting, with serif
  headings in the desktop app.

### Where it shows

| | Terminal | Desktop app | VS Code | Mobile app |
|---|---|---|---|---|
| The desk beside the chat | Yes | Yes | Yes | Yes |
| Cards under tool calls | Yes | Yes | Yes | Yes |
| Row above the prompt | Yes | Yes | Yes | Yes |
| Right-click rows | No | Yes | No | No |
| Paper look | No (keeps its own colors) | Yes | No (keeps its own colors) | Yes |

On a narrow screen the desk switches to a compact layout. Where a screen cannot hold a pane, `/comp-desk` says so.

### Commands

- `/comp-desk` opens the desk. `/comp-desk close` closes it, `/comp-desk clear` empties this session's desk,
  `/comp-desk reset` goes back to the starting layout and look, and `/comp-desk help` lists these.
- `/comp-desk-layout` picks a layout (`desk`, `focus`, `figures`, `glance` or `quiet`) and also takes `fit`,
  `comfortable` or `compact`, `hide` or `show` a section (`review`, `hearings`, `figures`, `connection`, `next`),
  and `cards full`, `cards compact` or `cards off`.
- `/comp-desk-look` picks `app`, `paper`, `paper-light` or `paper-night`, with `serif` or `no-serif`.

These commands only change the desk and answer on screen; none of them sends anything.

### Options

In the desk's **Customize** view (layout, density, sections, cards and look also take the two commands above):

- **Layout:** Desk (everything), Focus (drafts and hearings only), Figures first, Glance (the four counts only)
  or Quiet (no row above the prompt, no status line, no notices).
- **Density:** fit to width, comfortable or compact.
- **Sections:** show or hide each of the five.
- **Around the chat:** the row above the prompt, the status line and short notices, each on or off.
- **Cards under Hub calls:** full, compact (one line) or off.
- **Client names:** show or hide. Hidden names show as numbers, for screen sharing.
- **Look** and **serif headings** for the desktop and mobile apps, and **motion** (a soft dot while the Hub
  calculates; it stays still when your device asks for reduced motion).
- **Back to the starting layout**, which also resets the look, and **Clear this session's desk**, which asks you
  to press twice.

In `/config`, under the plugin:

- **When the desk opens:** `offer` (the default: the row above the prompt offers it the first time the Hub returns
  a figure), `on-hub-work` (it opens by itself at the first Hub work in a session) or `on-start` (it opens at the
  start of each session).
- **Ask before named sends:** `sends` (the default), `sends-and-writes` or `hub-only`. See below.
- **Hub working conventions for Claude:** on (the default) or off.
- **Right-click rows (desktop app):** on (the default) or off.

### You approve the sends the suite recognizes

With the default setting, a connector tool call whose name says it sends something outside Claude (it sends,
replies, forwards, posts, publishes, shares, submits, invites, notifies, comments, starts a thread, creates an
issue, writes a review, pushes, deploys or starts a release), and the Hub's Pro Workspace writes, wait for your own
approval, even in auto mode. This applies in every Claude Code session on this computer, not only Hub work. Where
nobody can approve (a scheduled task or a background agent), the call does not run. A send your own settings hook
makes (a hook in your Claude Code settings that calls a connector tool) is refused too, since nobody is asked about
it, and so is one whose owner Claude Code cannot tell; a settings hook of your organization's keeps its own rules.
The guard never loosens a refusal or a question that Claude Code or another plugin already raised, and it never
approves anything for you. Making an email draft is not a send, so the guard leaves it to Claude Code's own rules;
during Hub work the unsent draft goes on the desk for your review.

The suite reads tool names: it cannot see a send inside a shell command, a browser click or a general-purpose
connector tool, so keep Claude Code's own permission prompts on for those. In `/config` you can narrow this to the
Hub's Pro Workspace sends (`hub-only`), or widen it to record changes made by other connectors while you work with
the Hub (`sends-and-writes`).

### Privacy

- **Only your choices are kept.** The suite saves your layout, look and on/off choices on your computer, and
  nothing about your cases.
- **Case details stay in the session.** What the desk lists (draft names, hearings, Hub figures) is held for this
  Claude Code session only, and `/clear` or `/comp-desk clear` empties it. Other plugins running in the same
  session can read it.
- **Nothing is sent anywhere.** The suite makes no network calls of its own, reads none of your files and calls
  no model. It shows what Claude's own tool calls returned, fills the prompt only when you press, and copies only
  when you press.

The suite needs a version of Claude Code with mods turned on. If your organization turns them off, the Hub's
tools, skills and commands work as before, and the desk and the send guard are not there; Claude Code's own
permission prompts apply.

## Data and privacy

- The connector at `https://ltibymvlytodkemdeeox.supabase.co/functions/v1/nys-workers-comp-hub/mcp` (run by
  The Comp Desk) receives only what a tool needs: numbers and dates for a calculator, a search phrase, a
  borough or ZIP code.
- It does not store calculator inputs or results, and it never reads your conversation, Claude's memory or your
  files. For rate limiting it keeps a counter keyed by a one-way hash of the connection, for two days.
- The Pro Workspace tools send the cases you approve to your own Pro Workspace only. The workspace's import
  receipts are kept 48 hours.
- The hearing-notes tools return only the notes you sent to be posted (never drafts), and only to your own
  Claude; marking a note posted changes its status and nothing else. The notes stay in your Pro Workspace
  account; the connector keeps no copy and logs no note text.
- The skills run in Claude. Client material they work with stays in your own files, browser and email, and is
  never sent to The Comp Desk.
- The Comp Desk suite in Claude Code keeps only your layout and look choices, on your computer. What it shows
  about your cases stays in the Claude Code session, and it makes no network calls of its own: it sends nothing
  to The Comp Desk or anywhere else. See "Privacy" under the suite above.
- Privacy Policy: https://thecompdesk.com/legal/privacy · Terms: https://thecompdesk.com/terms ·
  Support: contact@thecompdesk.com

## About

The Comp Desk is a software platform, not a law firm. Calculator figures are estimates from the inputs given,
not a Board finding or a guarantee of any outcome. A licensed attorney reviews, edits and signs anything drafted
with these tools before it is filed or sent.

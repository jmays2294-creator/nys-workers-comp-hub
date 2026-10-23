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
  - awards for benefit periods (CCP)
  - Section 32 splits
  - Burns/Kelly third-party lien cost share
  - SLU apportionment between claims
  - the notice-to-employer deadline

  When an input is missing, a calculator says so and calculates nothing.
- **Reference**, from approved sources only:
  - formulas, with their statutory citations (each flagged "not yet attorney-reviewed" until The Comp Desk's
    attorney review is done)
  - the glossary
  - plain-language explainers
  - what a WCB form is for
  - a knowledge base of common questions
  - a library of New York decisions, each KeyCited in Westlaw before approval
- **Find a doctor** in the five boroughs by specialty, language and ZIP code, with a reminder to confirm WCB
  authorization before booking.
- **Your Pro Workspace** (Comp Desk Pro or Firm attorneys): send cases from your prep straight into your own
  Pro Workspace as finished tabs, then read back the figures the workspace computed.
- **Nine skills, all free:**
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

Everything works without signing in except the two Pro Workspace tools. The first time you use one, Claude
shows a **Connect** button: sign in with your Comp Desk account and approve "Add cases to your Pro Workspace".

## Data and privacy

- The connector at `https://ltibymvlytodkemdeeox.supabase.co/functions/v1/nys-workers-comp-hub/mcp` (run by
  The Comp Desk) receives only what a tool needs: numbers and dates for a calculator, a search phrase, a
  borough or ZIP code.
- It does not store calculator inputs or results, and it never reads your conversation, Claude's memory or your
  files. For rate limiting it keeps a counter keyed by a one-way hash of the connection, for two days.
- The Pro Workspace tools send the cases you approve to your own Pro Workspace only. The workspace's import
  receipts are kept 48 hours.
- The skills run in Claude. Client material they work with stays in your own files, browser and email, and is
  never sent to The Comp Desk.
- Privacy Policy: https://thecompdesk.com/legal/privacy · Terms: https://thecompdesk.com/terms ·
  Support: contact@thecompdesk.com

## About

The Comp Desk is a software platform, not a law firm. Calculator figures are estimates from the inputs given,
not a Board finding or a guarantee of any outcome. A licensed attorney reviews, edits and signs anything drafted
with these tools before it is filed or sent.

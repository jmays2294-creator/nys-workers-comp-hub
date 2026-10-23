---
name: wc-hearing-prep-calendar
description: Builds and maintains a New York workers' compensation attorney's weekly hearing and deposition prep packet and calendar. Fetches the week's WCB calendar, highlights the attorney's own events, fills in case basics (Hearing ID, claimant age and phone, case background) and C-3 employer and injury details, pulls the procedural and decision history, and drafts PH-16.2 pre-hearing conference statements for the attorney to review and file. All facts come live from the WCB eCase portal or the attorney's own files, never assumed from a case-management system.
metadata:
  title: WC Hearing Prep & Calendar
  kind: workflow
  listing: wc-hearing-prep-calendar
---

# WC Hearing Prep & Calendar

Use this whenever the attorney asks to build, update or fill in this week's hearing prep, fetch or highlight
the weekly WC calendar, pull a case's procedural history, or prepare PH-16.2 pre-hearing conference statements.
Trigger phrases include "build this week's prep", "fetch the calendar", "highlight my calendar", "fill in the
prep TBDs", "pull the case background for WCB# …" and "prep the 16.2s".

## 1. Weekly calendar fetch and highlighting
- Pull the current week's WC calendar (PDF or portal listing) from the source the attorney uses.
- Find the attorney's own hearings and depositions by their name or attorney-of-record field, and highlight them.
- Save the highlighted copy next to the source file, named with the week's date; never overwrite the original.

## 2. Weekly prep packet
- For each of the attorney's hearings that week, create or update one entry: WCB case number, claimant name,
  Hearing ID, date, time and forum, and a case-background block.
- If a prep document already exists for the week (a local file), extend it rather than starting over.

## 3. Case basics and C-3 details
- For any entry missing the Hearing ID, the claimant's age or phone number, look it up on eCase.
- For employer, claimant's position, how the injury happened and the injured body parts, read the claimant's
  most recent C-3 (or C-3.0 / EC-3 / C-3X variant) on eCase.
- Never leave a field silently blank: if eCase does not have it, ask the attorney rather than guessing.

## 4. Case background and procedural history
- From eCase, summarize the Notices of Decision and hearing history in date order: established and pending sites,
  permanency status (PFME, SLU, CCP), the average weekly wage found, and the directions from the last hearing.
- Reconcile against the attorney's own hearing notes; where eCase and the notes conflict, flag it rather than
  picking one.
- Figures (the max rate for the date of accident, an SLU or LWEC estimate, an award for past periods) come from
  the Hub's calculators, labelled as estimates. To put the week's cases into the Pro Workspace, use the
  `prep-to-workspace` skill.

## 5. PH-16.2 pre-hearing conference statements
- Identify which of the week's cases need a PH-16.2.
- Pre-fill it from the case data gathered above (parties, case number, issues, position).
- Leave every statement as a draft: the attorney reviews, signs and files it. Never submit a WCB filing.

## Where the facts come from (no case-management system assumed)
1. **Browser:** the WCB eCase portal and the calendar source, in the browser Claude is connected to. The attorney
   logs in themselves; never store or ask for credentials.
2. **Local files:** an existing prep document, calendar PDF or hearing notes on disk, updated in place.
3. **The attorney:** anything neither the portal nor the files resolve, asked directly and recorded.

Client and case information stays in the attorney's own files and browser; none of it is sent to The Comp Desk
(except cases the attorney chooses to add to their own Pro Workspace).

End every report with: "Drafts only: the attorney reviews and signs everything before it is filed. The Comp
Desk is a software platform, not a law firm. This is general information, not legal advice, and using it does
not create an attorney-client relationship."

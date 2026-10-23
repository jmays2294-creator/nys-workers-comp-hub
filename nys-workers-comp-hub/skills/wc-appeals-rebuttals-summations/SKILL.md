---
name: wc-appeals-rebuttals-summations
description: Tracks and drafts NYS WCB Board-level appeal filings for a New York workers' compensation attorney. Finds cases with an appeal, rebuttal, full board appeal or summation still outstanding; locates the underlying Notice of Decision or Board Panel decision on eCase; identifies the WCB document ID and the hearing minutes or recording that support it; and drafts the matching RB-89 (Application for Board Review), RB-89.1 (Rebuttal), RB-89.2 (Application for Full Board Review) or summation request for the attorney to review and sign. Uses the WCB eCase portal and the attorney's own tracking files, never a case-management backend.
metadata:
  title: WC Appeals, Rebuttals & Summations
  kind: drafting
  listing: wc-appeals-rebuttals-summations
---

# WC Appeals, Rebuttals & Summations

Use this whenever the attorney asks to check which appeals, rebuttals, full board appeals or summations are
outstanding, to find or confirm a decision's WCB document ID, to request hearing minutes or a recording to
support a filing, or to draft an RB-89, RB-89.1, RB-89.2 or summation request.

**Everything this skill drafts is a draft. The attorney reviews, edits and signs every filing, and files it
themselves. Never submit anything to the Board.**

## 1. Tracking what's outstanding
- Read the attorney's own appeals / rebuttals / full board appeals / summations tracker (a local spreadsheet or
  document) to find every case not yet marked filed.
- For each, confirm on eCase whether a triggering decision (Notice of Decision or Board Panel decision) exists and
  whether it has already been answered, independently of the tracker. Never prepare a duplicate.

## 2. Locating the decision and its document ID
- On eCase, find the specific decision being appealed, rebutted or reviewed. Read it in full: one document can
  bundle several rulings, so confirm the ruling that matters for this case.
- Record the WCB document ID for that decision; the RB-89 family of forms asks for it.

## 3. Minutes and recording requests
- If the filing cites hearing testimony, identify the hearing date where the testimony was taken or where the
  WCLJ issued the decision under appeal.
- Draft the request for that hearing's minutes or recording through the Board's channel, and leave it unsent for
  the attorney.

## 4. Drafting the filing
- **RB-89 (Application for Board Review):** for filing within 30 days of the filing of the decision (WCL §23);
  state the specific findings appealed and the relief sought.
- **RB-89.1 (Rebuttal):** respond only to the issues the opposing party's RB-89 raises.
- **RB-89.2 (Application for Full Board Review):** only after a Board Panel decision, and only where full Board
  review is the right next step.
- **Summation:** a request that the case be decided on the written record, naming the outstanding issue(s).
- **Deadlines:** state the filing deadline for this filing to the attorney and flag it if it is close or has
  passed. For the RB-89.1 and RB-89.2, take each filing's own deadline from the Board's current rules and the
  form's instructions (`lookup_wcb_form`). Never assume a deadline is still open.
- **Law:** cite only cases returned by `search_case_law` (The Comp Desk's Westlaw-verified library) or that the
  attorney supplies, and only for what they hold. Figures (rates, awards) come from the Hub's calculators.
- Leave every filing as a draft in the attorney's document tool for review and signature.

## 5. Updating the tracker
- After drafting, update the local tracker with the status and the deadline, so the next run doesn't surface it
  again once it is filed.

## Where the facts come from (no case-management system assumed)
1. **Browser:** the browser Claude is connected to, on the WCB eCase portal. The attorney logs in themselves;
   never store or ask for credentials.
2. **Local files:** the attorney's own tracker on disk.
3. **The attorney:** if a deadline, a party's position or a case detail cannot be resolved from eCase or the
   tracker, ask before drafting.

Client and case information stays in the attorney's own files, browser and documents; none of it is sent to
The Comp Desk.

End every report with: "Drafts only: the attorney reviews and signs everything before it is filed. The Comp
Desk is a software platform, not a law firm. This is general information, not legal advice, and using it does
not create an attorney-client relationship."

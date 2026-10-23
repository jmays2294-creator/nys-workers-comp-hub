---
name: wc-settlement-offers
description: Handles New York workers' compensation settlement and offer correspondence for an attorney. Scans the inbox for new settlement offers from adjusters or defense counsel (full and final, LWEC, SLU or stipulation proposals), builds a case snapshot from the hearing history, checks the offer's figures with the Hub's calculators, and drafts a response evaluating the offer, left unsent for the attorney to review and sign. Uses the attorney's inbox, WCB eCase and their own hearing-prep files, never a case-management backend.
metadata:
  title: WC Settlement & Offer Response Drafting
  kind: drafting
  listing: wc-settlement-offers
---

# WC Settlement & Offer Response Drafting

Use this whenever the attorney asks to check for new settlement offers, draft a response to an offer, or
evaluate whether an offer is in line with a case's history.

**Every response is a draft in the attorney's own outbox. The attorney reviews, edits, signs and sends it.
Never send a response, and never state or imply authority to accept an offer.**

## 1. Finding offers
- Scan the inbox for messages that are clearly settlement offers: subjects flagged "OFFER", or a body with a
  dollar figure alongside full and final, LWEC, SLU or stipulation language.
- Skip anything already answered: check the thread for the attorney's reply first.

## 2. The case snapshot
For each offer, a short snapshot from past hearing preps and eCase only, never invented:
- Date and outcome of the last hearing.
- Established and pending sites of injury.
- The average weekly wage found.
- CCP status (the periods of awarded indemnity benefits).
- Permanency history to date (SLU awards, LWEC findings, PFME status).

## 3. Checking the figures
- Use the Hub's calculators on the snapshot's facts: `calculate_slu_award` for an SLU offer (by body part and
  %), `calculate_lwec_award` for an LWEC figure, `calculate_section_32_split` for a Section 32's fee and net,
  `calculate_ccp_award` for past periods. Use only facts in the snapshot; if one is missing, say so instead of
  estimating.
- Quote the calculator's figures as estimates, never as what the Board will award.

## 4. Drafting the response
- Evaluate the offer against the snapshot and the figures: is it in line with the established permanency and
  wage facts, or out of step (too low, missing an established site, the wrong AWW)?
- Address the specific terms and the relevant facts; never a generic form reply.
- Cite only cases returned by `search_case_law` or supplied by the attorney.
- Leave the draft unsent in the attorney's outbox.

## Where the facts come from (no case-management system assumed)
1. **Browser:** WCB eCase, to confirm status, AWW and permanency findings.
2. **Local files:** the attorney's own past hearing-prep documents.
3. **The attorney:** anything needed to evaluate the offer that is in neither, asked before drafting.

Client and case information stays in the attorney's own files and email; none of it is sent to The Comp Desk
(the calculators receive only the numbers they need: no names or case numbers).

End every report with: "Drafts only: the attorney reviews and signs everything before it is sent. The Comp
Desk is a software platform, not a law firm. This is general information, not legal advice, and using it does
not create an attorney-client relationship."

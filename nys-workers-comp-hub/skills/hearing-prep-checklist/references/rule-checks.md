# Rule checks: the New York checks the checklist runs on every hearing

These are the deterministic checks. Each one starts from a fact in the attorney's files, and you cite that fact
(`Source:`). The rule or form it rests on goes on a `Rule:` line that always ends in "verify". The rule is written
from general knowledge, not from the Board's current text, and the attorney checks it before relying on it.

Run every check against every hearing. A check whose trigger is not in the files writes nothing. If its absence
matters (a permanency hearing with no permanency report anywhere in the folder), put it on the "Not found in the
files" list.

Dates: you may write a date that is a plain count from a dated source ("30 days from the filing on 11/06/2026
falls on 12/06/2026"), always followed by "verify". If that date falls on a weekend or a holiday, say so. Never
count weeks of benefits, money or percentages yourself: those come from the Hub (SKILL.md, step 5).

| # | Check | Trigger in the files | Item (category) | Rule line |
|---|---|---|---|---|
| R1 | Permanency report | The hearing's purpose is permanency, SLU, PPD or classification, and there is no treating doctor's C-4.3 in the folder (or a note says it is still outstanding) | Get the treating doctor's C-4.3 on file before the hearing, and chase the office (Medical and IME) | `Rule: Form C-4.3, Doctor's Report of MMI/Permanent Impairment: the treating doctor's permanency opinion (verify)` |
| R2 | Competing permanency opinions | An IME and a treating report give different percentages, or one of them is still missing | Line up both opinions for the hearing; if the files mention depositions, note what was said about them (Testimony and witnesses). Never average the two, and never pick one. | none needed when the file quote states it; otherwise `Rule: competing medical opinions are resolved by the WCLJ on the record (verify)` |
| R3 | PH-16.2 | The claim is controverted and a pre-hearing conference is calendared | File the PH-16.2 pre-hearing conference statement (Forms and filings). Say whether the files show it was started or filed. | `Rule: PH-16.2 pre-hearing conference statement, filed at least 10 days before the pre-hearing conference (12 NYCRR 300.38; verify)` |
| R4 | RB-89 window | A decision in the folder has a filing date, and 30 days from that date are not yet over on the checklist date or the hearing date | Decide whether any finding of the decision filed on that date is to be appealed (Deadlines). Not whether it should be: that is the attorney's call. | `Rule: RB-89, application for Board review, within 30 days of the filing of the decision (WCL §23; verify)` |
| R5 | Directions from the last decision or hearing | A decision or hearing note directs a party to produce something | One item per direction, naming who must produce what and when (Deadlines). If the directed party is the carrier, the item is to check that it was produced. | none: the quote is the source |
| R6 | Deadline conflict | Two files give different deadlines, dates or figures for the same thing | Put it under "Conflicts to resolve", quoting both. The decision is the Board's record, but say "verify", not "the decision controls". | none |
| R7 | IME timing | The files set or mention an IME date or window | Confirm the IME date and that the claimant has the directions (Medical and IME). Once the exam date has passed, check that the IME report is in the file. | `Rule: WCL §137, IME notice, report filing and service (verify)` when you check the report |
| R8 | Adjournment reason to cure | The last hearing was adjourned and the files say why | Cure that reason before this date (the item names it), or confirm the party who must cure it has (Deadlines, or the category of the thing to cure) | none: the quote is the source |
| R9 | Witnesses | A file names a witness (lay or medical), or a party is directed to produce one | Confirm the witness's availability and how they appear (virtual or in person). For a PH-16.2, list them on the statement (Testimony and witnesses). | `Rule: PH-16.2 lists lay and medical witnesses (verify)` when tied to the PH-16.2 |
| R10 | Notice and causation defenses (ANCR) | The carrier raises notice, causal relationship, accident or employment | Prepare the claimant's testimony on that issue, citing the facts in the files (Testimony and witnesses). For notice, run `get_notice_deadline` with the date of accident. | `Rule: WCL §18 written notice to the employer within 30 days; late notice may be excused by the Board (verify)` |
| R11 | Section 32 talk | A file mentions a Section 32 amount, an offer or settlement talks | Check the split with `calculate_section_32_split` from the amounts in the file, and put the discussion with the client on the list (Settlement and Section 32). No view on whether to settle. | `Rule: WCL §32 agreements need Board approval (verify)` |
| R12 | Award and fee | The hearing may make an award (SLU, CCP, LWEC), and the attorney's fee application is not in the folder | Have the OC-400.1 fee application ready (Forms and filings) | `Rule: Form OC-400.1, attorney's fee application (verify)` |
| R13 | Interpreter | The client's language is not English | Confirm an interpreter is requested for the hearing (Client contact) | `Rule: the Board provides hearing interpreters on request (verify)` |
| R14 | Client logistics | Every hearing | Confirm the client has the date, time, format and part (from the calendar or notice), and any contact detail the notes say to confirm (Client contact) | none: the calendar line is the source |
| R15 | Treatment waiting on the carrier | A file says a prior authorization request or a treatment request is unanswered | Raise it, or follow up on it, by the hearing (Medical and IME). Name the request and its date. | none: the quote is the source |

## Figures each check may need (Hub only)

| Check | Hub tool | Inputs, from the files |
|---|---|---|
| R1/R2, SLU on the calendar | `calculate_slu_award` | AWW found, date of accident, body part and the % of each opinion (one call per opinion, labelled), `prior_payments` only if a payment record states it |
| LWEC or classification | `calculate_lwec_award` | AWW, date of accident, LWEC % (only if a decision or report states one) |
| Past periods owed | `calculate_ccp_award` | AWW, date of accident, each period's dates and type |
| R10, notice | `get_notice_deadline` | date of accident (or of disablement) |
| R11, Section 32 | `calculate_section_32_split` | settlement amount, any MSA, any prior-counsel amounts |
| Rate questions | `get_max_min_rate`, `calculate_weekly_rate` | date of accident, AWW |

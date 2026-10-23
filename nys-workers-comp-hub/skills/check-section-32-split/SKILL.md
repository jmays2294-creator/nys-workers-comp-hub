---
name: check-section-32-split
description: Check the numbers in a proposed New York Section 32 settlement (waiver agreement) against The Comp Desk calculator: the gross amount, any Medicare set-aside, the 15% attorney fee rounded down to $5, a prior-counsel fee split and the claimant's net, and flag every figure that does not match, with the arithmetic laid out. Use when an attorney or paralegal says "check this Section 32 split", "does this C-32 add up", "verify the fee and net on this settlement", "how much does my client net on a $60,000 Section 32".
metadata:
  title: Check a Section 32 split
  kind: review
---

# Check a Section 32 split

For a New York Section 32 settlement. This checks the arithmetic of a proposed split; it does not judge
whether the settlement is a good one.

## Steps

1. **Collect the figures from the document** (or the user): the gross settlement, any Medicare set-aside
   (MSA) amount, the attorney fee in the agreement, any amounts going to prior counsel, and the claimant's net
   as written. Note where each came from. Missing figures are listed, not assumed.
2. **Run `calculate_section_32_split`** with `settlement_amount`, `msa_amount` (if any) and
   `prior_counsel_fees` (if any).
3. **Compare, line by line**, in a table: | Line | In the document | Calculator | Match? |
   for the set-aside, the amount the fee is figured on, the fee, prior counsel's share, the current attorney's
   share and the net.
4. **Explain each mismatch** in one sentence (for example "the fee was figured on the gross, including the
   set-aside"). Do not decide which number is right when the agreement states a different fee on purpose: the
   fee is whatever the Workers' Compensation Law Judge approves, and it can differ from 15%.
5. **Related checks, only if the user asks:** an SLU or award figure in the agreement can be checked with
   `calculate_slu_award` or `calculate_ccp_award`; an employer reimbursement with the same tools'
   `employer_reimbursement` input; a third-party lien with `calculate_burns_lien`.

## Output

The table, the list of mismatches (or "every line matches"), and anything missing. Anything drafted from this
check is a draft: the attorney reviews and signs everything.

End with: "The Comp Desk is a software platform, not a law firm. This is general information, not legal
advice, and using it does not create an attorney-client relationship."

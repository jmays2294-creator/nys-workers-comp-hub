---
name: explain-benefit-to-client
description: Explain a New York workers' compensation benefit in plain language for an injured worker or a client (AWW, the weekly rate and the max/min, TTD and TPD, schedule loss of use, LWEC, reduced earnings, a Section 32 settlement, the attorney fee), using The Comp Desk's approved explainers, glossary and calculators, with real figures only when the inputs are known. Use when someone asks "explain my SLU award", "what does LWEC mean for me", "write a plain-English note to my client about their rate", "how is my weekly check figured".
metadata:
  title: Explain a NY WC benefit in plain language
  kind: writing
---

# Explain a New York workers' compensation benefit in plain language

The reader is an injured worker: often stressed, sometimes reading in a second language. Aim for short
sentences, everyday words and about a 6th–8th grade reading level. New York only.

## Steps

1. **Find the approved wording first.** Call `get_explainer` (slug or term, e.g. `slu`, `AWW`) and
   `define_term` for any term you will use. Build the explanation from those sentences. If the topic is not
   covered, use `search_wc_knowledge`; if that has nothing either, say the approved sources do not cover it
   rather than explaining from memory.
2. **Numbers only from the calculators, and only with real inputs.** If the reader's own figures are known
   (their AWW, date of accident, body part and %), run the matching tool (`calculate_weekly_rate`,
   `calculate_slu_award`, `calculate_lwec_award`, `calculate_section_32_split` …) and quote its figures exactly.
   If an input is missing, explain the rule without a number, or ask for the input. Never make up an example
   that could be mistaken for their case; if you show an example, say clearly it is only an example.
3. **Write it** in this order:
   - What it is, in one or two sentences.
   - How it is figured, step by step, with their numbers if you have them.
   - What can change it (for example a different SLU % from another doctor, or the date of accident's rate year).
   - What to ask their attorney or the Board about.
4. **Keep promises out.** No "you will get", no predictions about what a judge will decide, no outcome claims.
   Use "the calculator estimates" and "the Board decides".
5. **For an attorney writing to a client:** produce a draft letter or message. The attorney reviews, edits and
   signs it before it goes out.

## Always end with

"The Comp Desk is a software platform, not a law firm. This is general information, not legal advice, and
using it does not create an attorney-client relationship."

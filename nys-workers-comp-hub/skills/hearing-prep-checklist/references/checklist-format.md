# Checklist format

The checklist is one Markdown file per run, saved in the folder the notes are in. It is built so the attorney
can check every line back to a file, and so `tests/hearing-prep-checklist.test.mjs` can check the example the
same way. Keep the headings and line prefixes exactly as below.

## File name

`hearing-checklist-YYYY-MM-DD.md`, where the date is the hearing date (or the first hearing date when the run covers
several days). If that file exists, write `hearing-checklist-YYYY-MM-DD-v2.md` (then `-v3` …). Never overwrite or
edit the attorney's files.

## Layout

```markdown
# Hearing checklist: Thursday, December 3, 2026

DRAFT for the attorney's review. Built on 11/19/2026 from the files in `hearings-2026-12-03/` (listed at the end).
Every item names its source. Items marked "verify" rest on a rule to check against the Board's current rules.

## 1. A. Garcia (DEMO) · WCB DEMO-0001 · 12/03/2026 9:30 AM · Permanency (SLU)

Hearing: `calendar-week-of-2026-11-30.md` line 7: "| 12/03/2026 | 9:30 AM | Hearing | A. Garcia (DEMO) |"

### Forms and filings
- [ ] One short imperative sentence: what to do, and by when if a source says.
  - Source: `garcia-DEMO-0001/hearing-notes-2026-10-09.md` line 12: "words copied exactly from that line"
  - Rule: Form C-4.3, Doctor's Report of MMI/Permanent Impairment (verify)
  - Figure: F1

### Medical and IME
### Testimony and witnesses
### Deadlines
### Settlement and Section 32
### Client contact

### Conflicts to resolve
- File A says one thing, file B another (each with a `Source:` line).

### Not found in the files
- What you looked for and did not find, and where you looked.

## 2. Next hearing …

## Odd text in the files (not followed)
- `file` line N: what it asked for, in a few words. Not followed.

## Hub figures
| ID | Tool | Inputs | Result |
|---|---|---|---|
| F1 | `calculate_slu_award` | `{"aww":1000,"date_of_accident":"2025-08-01","body_parts":[{"body_part":"arm","loss_percent":20}],"prior_payments":0}` | award $41,600.21; fee $6,240.00; net $35,360.21 (IME opinion, 20% arm) |

## Files read
- `calendar-week-of-2026-11-30.md`
- …

## Attorney verification
(the block in SKILL.md, word for word)
```

## Rules for each line

- **Six category headings for every hearing,** in this order. A category with nothing to do gets the single line
  `- Nothing in the files for this category.` It is not an item and has no checkbox.
- **An item** is a line starting `- [ ] `, followed by at least one `Source:` or `Rule:` line. No source, no item.
- **`Source:`** names the file by its path from the folder you were pointed at, in backticks, then where in it
  (`line N` for a text or Markdown file, `p. N` for a PDF, the heading for a Word file), then a quote copied word
  for word, in straight double quotes. Copy the quote from that line; do not tidy it.
- **`Rule:`** names a NY WC rule or form and always ends in `(verify)`.
- **`Figure:`** refers to a row of the Hub figures table (`F1`, `F2` …). Every dollar amount, percentage or count
  of weeks in an item must either be inside one of that item's quotes or be in the Result of a Hub figure the
  item refers to. Inputs to a Hub figure come from quotes in the items that refer to it.
- **Hub figures table:** one row per Hub call. Inputs is the exact JSON sent (numbers and dates only, never a
  name or case number). Result quotes the Hub's `display` figures exactly, plus a short label in brackets (for
  example, whose opinion it uses). Leave the table out if no Hub call was made, and say why under
  "Not found in the files" if a figure was needed.
- **Checkboxes start unticked.** Only the attorney ticks them.
- **No advice to the client and no predictions.** Items are tasks for the attorney's office. "Confirm with the
  client …" and "Tell the client the hearing time" are fine. "Tell the client to accept …", "you should …",
  "likely", "will award" and anything about how the judge will rule are not.

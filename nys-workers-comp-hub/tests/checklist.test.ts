import { expect, test } from 'claude-code/testing'
import { applyEdit, checklistBase, isChecklistPath, parseChecklist, stripLineNumbers } from '../hooks/checklist'
import { CHECKLIST, CHECKLIST_READ, CHECKLIST_READ_ARROW, CHECKLIST_SIGNED, CHECKLIST_TICKED, CHECKLIST_UNSIGNED_BLOCK } from './fixtures'

test('1. the example checklist counts as its format says', () => {
  const c = parseChecklist(CHECKLIST)
  expect(c.hearingCount).toBe(2)
  expect(c.hearings).toHaveLength(2)
  expect(c.open).toBe(21)
  expect(c.done).toBe(0)
  expect(c.verify).toBe(8)
  // Garcia's one conflict; Baptiste's section says "- None found.", which is not a conflict.
  expect(c.conflicts).toBe(1)
  expect(c.notFound).toBe(6)
  expect(c.odd).toBe(1)
  expect(c.signed).toBe('no')
  expect(c.dateLine).toBe('Thursday, December 3, 2026')
  expect(c.hearings[0]).toEqual({ n: 1, who: 'A. Garcia (DEMO)', wcb: 'WCB DEMO-0001', when: '12/03/2026 9:30 AM', purpose: 'Permanency (SLU)', open: 10, verify: 5, done: 0 })
  expect(c.hearings[1]?.when).toBe('12/03/2026 11:00 AM')
  expect(c.hearings[1]?.purpose).toBe('Pre-hearing conference (controverted)')
  expect(c.hearings[1]?.open).toBe(11)
  expect(c.hearings[1]?.verify).toBe(3)
})

test('2. ticks count as done, and a ticked verify item is no longer to verify', () => {
  const c = parseChecklist(CHECKLIST_TICKED)
  expect([c.open, c.done, c.verify]).toEqual([19, 2, 7])
})

test('3. the verification line: filled in, still blank, or absent', () => {
  expect(parseChecklist(CHECKLIST_SIGNED).signed).toBe('yes')
  expect(parseChecklist(CHECKLIST_UNSIGNED_BLOCK).signed).toBe('unknown')
})

test('4. a Read with line numbers counts the same, with tab or arrow prefixes', () => {
  const plain = parseChecklist(CHECKLIST)
  for (const read of [CHECKLIST_READ, CHECKLIST_READ_ARROW]) {
    const c = parseChecklist(stripLineNumbers(read))
    expect([c.open, c.verify, c.hearingCount, c.conflicts, c.notFound, c.odd, c.signed]).toEqual([plain.open, plain.verify, plain.hearingCount, plain.conflicts, plain.notFound, plain.odd, plain.signed])
  }
  expect(stripLineNumbers('no numbers here\nnone')).toBe('no numbers here\nnone')
})

test('5. checklist file names', () => {
  expect(isChecklistPath('/x/hearing-checklist-2026-12-03.md')).toBe(true)
  expect(isChecklistPath('/x/hearing-checklist-2026-12-03-v2.md')).toBe(true)
  expect(isChecklistPath('/x/notes.md')).toBe(false)
  expect(isChecklistPath('/x/hearing-checklist-2026-12.md')).toBe(false)
  expect(isChecklistPath('/x/hearing-checklist-2026-12-03.docx')).toBe(false)
  expect(checklistBase('/x/hearing-checklist-2026-12-03-v2.md')).toEqual({ base: '2026-12-03', version: 2 })
  expect(checklistBase('/x/hearing-checklist-2026-12-03.md')).toEqual({ base: '2026-12-03', version: 1 })
})

test('6. an Edit is replayed once, or everywhere with replaceAll', () => {
  expect(applyEdit('a b a', 'a', 'c', false)).toBe('c b a')
  expect(applyEdit('a b a', 'a', 'c', true)).toBe('c b c')
  expect(applyEdit('cost $1', '$1', '$$2', false)).toBe('cost $$2')
})

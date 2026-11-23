import { expect, test } from 'claude-code/testing'
import { COPY } from '../hooks/copy'
import { COMPOSE, engine } from './engine'

test('74. the working conventions: one constant section, last, for this session', async ($, on) => {
  engine(on)
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'engine intro', scope: 'shared' }] }))
  for (let i = 0; i < 2; i += 1) {
    const { sections } = await $.prompt.compose(COMPOSE)
    expect(sections.map(s => s.id)).toEqual(['intro', 'nys-workers-comp-hub:conventions'])
    const last = sections[sections.length - 1]
    expect(last?.scope).toBe('session')
    expect(last?.text).toBe(COPY.conventions)
  }
})

test('74b. turned off in /config, the sections are left as they were', { options: { working_conventions: false } }, async ($, on) => {
  engine(on)
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'engine intro', scope: 'shared' }] }))
  const { sections } = await $.prompt.compose(COMPOSE)
  expect(sections.map(s => s.id)).toEqual(['intro'])
})

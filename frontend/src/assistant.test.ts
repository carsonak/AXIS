import { describe, expect, it } from 'vitest'
import { matchAssistantIntent } from './assistant'

describe('assistant intent matching', () => {
  it.each([
    ['Why did my water volume change today?', 'volume'],
    ['Why are the litres different?', 'volume'],
    ['How did rainfall affect the farm?', 'rain'],
    ['Explain crop growth stage water needs', 'stage'],
    ['Kwa nini unyevu wa udongo haukubadilika baada ya umwagiliaji?', 'sensor']
  ])('matches %s', (query, intent) => expect(matchAssistantIntent(query)).toBe(intent))

  it.each([
    'Explain this recommendation to me like I am 12 years old.',
    'Why does sprinkler efficiency make the number larger?',
    'What should I know today?',
    'Explain water to me'
  ])('does not false-positive for %s', query => expect(matchAssistantIntent(query)).toBeUndefined())
})

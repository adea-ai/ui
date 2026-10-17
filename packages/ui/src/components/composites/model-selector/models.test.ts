import { describe, expect, test } from 'bun:test'
import {
  findModel,
  groupModels,
  modelSearchValue,
  needsSearch,
  normalizeEfforts,
  resolveEffort,
  type ModelOption,
} from './models'

const sonnet: ModelOption = {
  id: 'sonnet',
  label: 'Sonnet',
  provider: 'Anthropic',
  efforts: ['low', 'medium', 'high'],
}
const haiku: ModelOption = { id: 'haiku', label: 'Haiku', provider: 'Anthropic' }
const other: ModelOption = { id: 'gpt', label: 'GPT', provider: 'OpenAI', description: 'General' }

describe('normalizeEfforts', () => {
  test('labels bare ids and keeps given labels', () => {
    expect(
      normalizeEfforts(['low', { id: 'xhigh', label: 'Extra high', description: 'Slowest' }])
    ).toEqual([
      { id: 'low', label: 'Low' },
      { id: 'xhigh', label: 'Extra high', description: 'Slowest' },
    ])
  })

  test('drops blanks and repeated ids', () => {
    expect(normalizeEfforts(['low', '', '  ', 'low', 'high']).map((effort) => effort.id)).toEqual([
      'low',
      'high',
    ])
  })

  test('nothing advertised means no options', () => {
    expect(normalizeEfforts(undefined)).toEqual([])
    expect(normalizeEfforts([])).toEqual([])
  })

  test('bounds a hostile label', () => {
    expect(normalizeEfforts([{ id: 'x', label: 'y'.repeat(500) }])[0]!.label.length).toBe(61)
  })
})

describe('resolveEffort', () => {
  test('finds an effort the model offers', () => {
    expect(resolveEffort(sonnet, 'medium')?.label).toBe('Medium')
  })

  test('refuses one the model does not offer, or when there is no model', () => {
    expect(resolveEffort(sonnet, 'max')).toBeUndefined()
    expect(resolveEffort(haiku, 'low')).toBeUndefined()
    expect(resolveEffort(undefined, 'low')).toBeUndefined()
    expect(resolveEffort(sonnet, undefined)).toBeUndefined()
  })
})

describe('findModel', () => {
  test('looks up by id', () => {
    expect(findModel([sonnet, haiku], 'haiku')).toBe(haiku)
    expect(findModel([sonnet], 'missing')).toBeUndefined()
    expect(findModel([sonnet], undefined)).toBeUndefined()
  })
})

describe('groupModels', () => {
  test('groups by provider in order of first appearance', () => {
    const groups = groupModels([sonnet, other, haiku])
    expect(groups.map((group) => group.provider)).toEqual(['Anthropic', 'OpenAI'])
    expect(groups[0]!.models.map((model) => model.id)).toEqual(['sonnet', 'haiku'])
  })

  test('a blank provider is grouped as Other', () => {
    expect(groupModels([{ id: 'a', label: 'A', provider: '  ' }])[0]!.provider).toBe('Other')
  })
})

describe('needsSearch', () => {
  test('is true only past the threshold', () => {
    expect(needsSearch(7)).toBe(false)
    expect(needsSearch(8)).toBe(true)
    expect(needsSearch(3, 2)).toBe(true)
  })
})

describe('modelSearchValue', () => {
  test('contains what a person would type', () => {
    const value = modelSearchValue(other)
    for (const word of ['GPT', 'OpenAI', 'gpt', 'General']) expect(value).toContain(word)
  })
})

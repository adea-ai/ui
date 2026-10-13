import { afterEach, describe, expect, test } from 'bun:test'
import {
  localStoragePersistence,
  readPersisted,
  writePersisted,
  type ThemePersistence,
} from '../src/components/theme/theme-persistence'
import { defaultThemeSelection, mergeThemeSelection } from '../src/components/theme/theme-state'
import { blockLocalStorage, installLocalStorage } from './helpers/fake-root'

let restore: (() => void) | undefined
afterEach(() => {
  restore?.()
  restore = undefined
})

const KEY = 'cortana.appearance'

function withStorage(initial: Record<string, string> = {}) {
  const installed = installLocalStorage(initial)
  restore = installed.restore
  return installed.backing
}

describe('localStoragePersistence.read', () => {
  test('nothing stored is the defaults', () => {
    withStorage()
    expect(localStoragePersistence(KEY).read()).toEqual(defaultThemeSelection)
  })

  test('reads every axis back, validated', () => {
    withStorage({
      [KEY]: JSON.stringify({
        appearance: 'light',
        lightThemeId: 'solarized-light',
        darkThemeId: 'nord',
        accent: 'violet',
        font: 'geist',
        density: 'compact',
      }),
    })
    expect(localStoragePersistence(KEY).read()).toMatchObject({
      appearance: 'light',
      lightThemeId: 'solarized-light',
      darkThemeId: 'nord',
      accent: 'violet',
      font: 'geist',
      density: 'compact',
    })
  })

  test('a stale id falls back to the default of its slot, and a wrong-appearance id too', () => {
    withStorage({
      [KEY]: JSON.stringify({
        lightThemeId: 'removed-in-a-release',
        darkThemeId: 'solarized-light',
      }),
    })
    const read = localStoragePersistence(KEY).read()
    expect(read).toMatchObject({ lightThemeId: 'adea-light', darkThemeId: 'adea-dark' })
  })

  test('an unknown accent, appearance and density are defaulted', () => {
    withStorage({
      [KEY]: JSON.stringify({ appearance: 'sepia', accent: 'chartreuse', density: 'cramped' }),
    })
    expect(localStoragePersistence(KEY).read()).toMatchObject({
      appearance: 'system',
      accent: 'theme',
      density: 'comfortable',
    })
  })

  test('a theme accent is kept even when this pair cannot offer it', () => {
    withStorage({ [KEY]: JSON.stringify({ accent: 'ansi-blue' }) })
    expect(localStoragePersistence(KEY).read()).toMatchObject({ accent: 'ansi-blue' })
  })

  test('corrupt JSON and non-object JSON are the defaults, not an error', () => {
    withStorage({ [KEY]: '{"appearance":"da' })
    expect(localStoragePersistence(KEY).read()).toEqual(defaultThemeSelection)
    withStorage({ [KEY]: 'null' })
    expect(localStoragePersistence(KEY).read()).toEqual(defaultThemeSelection)
  })

  test('a store that throws on access is the defaults', () => {
    restore = blockLocalStorage()
    expect(localStoragePersistence(KEY).read()).toEqual(defaultThemeSelection)
  })

  test('the key may be a function, read at the time of each call', () => {
    withStorage({ a: JSON.stringify({ accent: 'violet' }), b: JSON.stringify({ accent: 'blue' }) })
    let key = 'a'
    const persistence = localStoragePersistence(() => key)
    expect(persistence.read()).toMatchObject({ accent: 'violet' })
    key = 'b'
    expect(persistence.read()).toMatchObject({ accent: 'blue' })
  })
})

describe('localStoragePersistence.write', () => {
  test('stores the selection as JSON under the key', () => {
    const backing = withStorage()
    const next = mergeThemeSelection(defaultThemeSelection, { appearance: 'dark' })
    localStoragePersistence(KEY).write(next)
    expect(JSON.parse(backing.get(KEY)!)).toEqual(next)
  })

  test('a Cortana selection serialises to exactly the bytes it always did', () => {
    // Cortana: initial {appearance:'dark', accent:'theme', font:'geist'}, then
    // setSelection({ darkThemeId }). The golden is the document 0.123.1 wrote.
    const backing = withStorage()
    const next = mergeThemeSelection(
      mergeThemeSelection(defaultThemeSelection, {
        appearance: 'dark',
        accent: 'theme',
        font: 'geist',
      }),
      { darkThemeId: 'nord' }
    )
    localStoragePersistence(KEY).write(next)
    expect(backing.get(KEY)).toBe(
      '{"appearance":"dark","lightThemeId":"adea-light","darkThemeId":"nord","accent":"theme","font":"geist","fonts":{"ui":{"family":"geist","size":14},"content":{"family":"system","size":14},"code":{"family":"system","size":12}},"density":"comfortable"}'
    )
  })

  test('a blocked store drops the write without throwing', () => {
    restore = blockLocalStorage()
    expect(() => localStoragePersistence(KEY).write(defaultThemeSelection)).not.toThrow()
  })
})

describe('readPersisted and writePersisted', () => {
  const throwing: ThemePersistence = {
    read() {
      throw new Error('store exploded')
    },
    write() {
      throw new Error('store exploded')
    },
  }

  test('a persistence that throws on read is treated as empty', () => {
    expect(readPersisted(throwing)).toBeUndefined()
  })

  test('a persistence that throws on write loses the preference, not the switch', () => {
    expect(() => writePersisted(throwing, defaultThemeSelection)).not.toThrow()
  })

  test('both pass through to a well-behaved persistence', () => {
    const writes: unknown[] = []
    const persistence: ThemePersistence = {
      read: () => ({ accent: 'violet' }),
      write: (next) => void writes.push(next),
    }
    expect(readPersisted(persistence)).toEqual({ accent: 'violet' })
    writePersisted(persistence, defaultThemeSelection)
    expect(writes).toEqual([defaultThemeSelection])
  })
})

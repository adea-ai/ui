import { describe, expect, test } from 'bun:test'
import {
  defaultPreferenceStorage,
  quarantineRecord,
  readLegacyValue,
  readVersionedRecord,
  recoveryEnvelope,
  recoveryKeyFor,
  writeVersionedRecord,
  type PreferenceStorage,
  type RecoveryEnvelope,
} from '../src/lib/preference-store'
import { blockLocalStorage, installLocalStorage } from './helpers/fake-root'

function memory(initial: Record<string, string> = {}) {
  const backing = new Map(Object.entries(initial))
  const storage: PreferenceStorage = {
    getItem: (key) => backing.get(key) ?? null,
    setItem: (key, value) => void backing.set(key, value),
  }
  return { backing, storage }
}

const blocked: PreferenceStorage = {
  getItem() {
    throw new DOMException('Access is denied for this document.', 'SecurityError')
  },
  setItem() {
    throw new DOMException('Access is denied for this document.', 'SecurityError')
  },
}

const NOW = () => new Date('2026-10-13T08:00:00.000Z')
const V2 = { key: 'appearance', version: 2, recoveryKey: 'appearance.recovery' } as const

const envelopeOf = (backing: Map<string, string>, key = 'appearance.recovery') =>
  JSON.parse(backing.get(key)!) as RecoveryEnvelope

describe('readVersionedRecord', () => {
  test('nothing stored is absent and writes nothing', () => {
    const { storage, backing } = memory()
    expect(readVersionedRecord(storage, V2, NOW)).toEqual({ status: 'absent' })
    expect(backing.size).toBe(0)
  })

  test('a record of the supported version is returned as stored', () => {
    const raw = JSON.stringify({ version: 2, mode: 'dark', extra: [1] })
    const { storage, backing } = memory({ appearance: raw })
    const read = readVersionedRecord(storage, V2, NOW)
    expect(read).toEqual({
      status: 'record',
      record: { version: 2, mode: 'dark', extra: [1] },
      raw,
    })
    expect(backing.has('appearance.recovery')).toBe(false)
  })

  test('invalid JSON is quarantined byte for byte as corrupt_json', () => {
    const corrupt = '{"version":2,"mode":"da'
    const { storage, backing } = memory({ appearance: corrupt })
    expect(readVersionedRecord(storage, V2, NOW)).toEqual({
      status: 'quarantined',
      reason: 'corrupt_json',
      raw: corrupt,
    })
    expect(envelopeOf(backing)).toEqual({
      schemaVersion: 1,
      reason: 'corrupt_json',
      capturedAt: '2026-10-13T08:00:00.000Z',
      raw: corrupt,
    })
    // The main key is not touched by a read.
    expect(backing.get('appearance')).toBe(corrupt)
  })

  test('JSON that is not an object is corrupt_json, including null and an empty string', () => {
    for (const raw of ['null', '5', '"dark"', 'true', '']) {
      const { storage, backing } = memory({ appearance: raw })
      const read = readVersionedRecord(storage, V2, NOW)
      expect(read, raw).toMatchObject({ status: 'quarantined', reason: 'corrupt_json' })
      expect(envelopeOf(backing).raw).toBe(raw)
    }
  })

  test('another version, or no version, or an array, is unsupported_record', () => {
    for (const raw of [
      '{"version":3,"mode":"sepia","nextThing":true}',
      '{"version":1}',
      '{"version":"2"}',
      '{"mode":"dark"}',
      '[1,2]',
    ]) {
      const { storage, backing } = memory({ appearance: raw })
      expect(readVersionedRecord(storage, V2, NOW), raw).toEqual({
        status: 'quarantined',
        reason: 'unsupported_record',
        raw,
      })
      expect(envelopeOf(backing).raw).toBe(raw)
    }
  })

  test('an unversioned schema accepts any object and quarantines the rest', () => {
    const schema = { key: 'cortana.appearance' }
    const ok = memory({ 'cortana.appearance': '{"appearance":"dark"}' })
    expect(readVersionedRecord(ok.storage, schema, NOW).status).toBe('record')
    const array = memory({ 'cortana.appearance': '[]' })
    expect(readVersionedRecord(array.storage, schema, NOW)).toMatchObject({
      status: 'quarantined',
      reason: 'unsupported_record',
    })
    // The recovery key defaults to `<key>.recovery`.
    expect(array.backing.has('cortana.appearance.recovery')).toBe(true)
  })

  test('quarantine is idempotent: the same bytes are kept, the capture refreshed', () => {
    const { storage, backing } = memory({ appearance: 'not-json-at-all' })
    readVersionedRecord(storage, V2, () => new Date('2026-01-01T00:00:00.000Z'))
    readVersionedRecord(storage, V2, NOW)
    const envelope = envelopeOf(backing)
    expect(envelope.raw).toBe('not-json-at-all')
    expect(envelope.capturedAt).toBe('2026-10-13T08:00:00.000Z')
  })

  test('a later valid write does not destroy the quarantined original', () => {
    const corrupt = '{"version":2,"mode":"da'
    const { storage, backing } = memory({ appearance: corrupt })
    readVersionedRecord(storage, V2, NOW)
    expect(writeVersionedRecord(storage, 'appearance', { version: 2, mode: 'dark' })).toBe(true)
    expect(envelopeOf(backing).raw).toBe(corrupt)
    expect(readVersionedRecord(storage, V2, NOW).status).toBe('record')
  })

  test('a store that cannot be read is unavailable, and one that cannot be written still answers', () => {
    expect(readVersionedRecord(blocked, V2, NOW)).toEqual({ status: 'unavailable' })
    const writeOnlyBlocked: PreferenceStorage = {
      getItem: () => 'not json',
      setItem: blocked.setItem,
    }
    expect(readVersionedRecord(writeOnlyBlocked, V2, NOW)).toMatchObject({
      status: 'quarantined',
      reason: 'corrupt_json',
    })
  })
})

describe('recovery keys', () => {
  test('the default is derived from the key, an explicit one wins', () => {
    expect(recoveryKeyFor({ key: 'appearance' })).toBe('appearance.recovery')
    expect(recoveryKeyFor({ key: 'appearance', recoveryKey: 'appearance.library.recovery' })).toBe(
      'appearance.library.recovery'
    )
  })

  test('two documents with their own recovery keys do not overwrite each other', () => {
    const { storage, backing } = memory({
      appearance: '{bad',
      'appearance.library': '{"version":9}',
    })
    readVersionedRecord(storage, V2, NOW)
    quarantineRecord(
      storage,
      'appearance.library.recovery',
      backing.get('appearance.library')!,
      'unsupported_record',
      NOW
    )
    expect(envelopeOf(backing).raw).toBe('{bad')
    expect(envelopeOf(backing, 'appearance.library.recovery')).toMatchObject({
      reason: 'unsupported_record',
      raw: '{"version":9}',
    })
  })

  test('the envelope has exactly the stored shape', () => {
    expect(Object.keys(recoveryEnvelope('x', 'corrupt_json', NOW())).toSorted()).toEqual([
      'capturedAt',
      'raw',
      'reason',
      'schemaVersion',
    ])
  })

  test('quarantine into a store that cannot be written never throws', () => {
    expect(() => quarantineRecord(blocked, 'r', 'x', 'corrupt_json')).not.toThrow()
  })
})

describe('legacy and writing', () => {
  test('the legacy value is read as stored, and a blocked store reads as nothing', () => {
    expect(readLegacyValue(memory({ theme: 'dark' }).storage, 'theme')).toBe('dark')
    expect(readLegacyValue(memory().storage, 'theme')).toBeNull()
    expect(readLegacyValue(blocked, 'theme')).toBeNull()
  })

  test('writeVersionedRecord stores JSON and reports a failure instead of throwing', () => {
    const { storage, backing } = memory()
    expect(writeVersionedRecord(storage, 'appearance', { version: 2 })).toBe(true)
    expect(backing.get('appearance')).toBe('{"version":2}')
    expect(writeVersionedRecord(blocked, 'appearance', { version: 2 })).toBe(false)
  })
})

describe('defaultPreferenceStorage', () => {
  test('is localStorage where there is one', () => {
    const installed = installLocalStorage({ a: '1' })
    try {
      expect(defaultPreferenceStorage()?.getItem('a')).toBe('1')
    } finally {
      installed.restore()
    }
  })

  test('is nothing where the global is absent or blocked', () => {
    const restoreBlocked = blockLocalStorage()
    try {
      expect(defaultPreferenceStorage()).toBeUndefined()
    } finally {
      restoreBlocked()
    }
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    delete (globalThis as { localStorage?: unknown }).localStorage
    try {
      expect(defaultPreferenceStorage()).toBeUndefined()
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    }
  })
})

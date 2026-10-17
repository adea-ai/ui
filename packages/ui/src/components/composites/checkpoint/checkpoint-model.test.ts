import { describe, expect, test } from 'bun:test'
import {
  checkpointLabel,
  checkpointStatus,
  restoreControl,
  restoreDialogCopy,
} from './checkpoint-model'

const RLO = String.fromCharCode(0x202e)

describe('checkpointLabel', () => {
  test('falls back to the plain word', () => {
    expect(checkpointLabel(undefined)).toBe('Checkpoint')
    expect(checkpointLabel('   ')).toBe('Checkpoint')
  })

  test('bounds and cleans a hostile label', () => {
    expect(checkpointLabel(`Before${RLO}fdp refactor`)).toBe('Beforefdp refactor')
    expect(checkpointLabel('x'.repeat(500)).length).toBe(81)
  })
})

describe('checkpointStatus', () => {
  test('an untouched checkpoint says nothing', () => {
    expect(checkpointStatus('idle')).toBeUndefined()
  })

  test('says each state in words', () => {
    expect(checkpointStatus('restoring')).toBe('Restoring…')
    expect(checkpointStatus('restored')).toBe('Restored')
  })

  test('a failure carries the reason when there is one', () => {
    expect(checkpointStatus('failed')).toBe('Restore failed')
    expect(checkpointStatus('failed', 'The workspace is locked.')).toBe(
      'Restore failed: The workspace is locked.'
    )
  })

  test('a disabled reason is shown while idle, and only then', () => {
    expect(checkpointStatus('idle', undefined, 'Wait for the run to finish.')).toBe(
      'Wait for the run to finish.'
    )
    expect(checkpointStatus('restored', undefined, 'Wait for the run to finish.')).toBe('Restored')
  })
})

describe('restoreDialogCopy', () => {
  test('uses the host consequence verbatim', () => {
    const copy = restoreDialogCopy('Before refactor', 'Undoes 14 file edits made after 10:02.')
    expect(copy.title).toBe('Restore to “Before refactor”?')
    expect(copy.description).toBe('Undoes 14 file edits made after 10:02.')
  })

  test('does not invent a consequence', () => {
    expect(restoreDialogCopy(undefined, undefined)).toEqual({
      title: 'Restore to “Checkpoint”?',
      description: 'Restoring returns to this checkpoint.',
    })
  })

  test('bounds a long consequence', () => {
    expect(restoreDialogCopy('a', 'z'.repeat(5000)).description.length).toBe(401)
  })
})

describe('restoreControl', () => {
  test('is absent without a handler, whatever the state', () => {
    for (const state of ['idle', 'restoring', 'restored', 'failed'] as const) {
      expect(restoreControl(false, state, undefined).visible).toBe(false)
    }
  })

  test('is present and usable with a handler while idle or after a failure', () => {
    expect(restoreControl(true, 'idle', undefined)).toEqual({ visible: true, disabled: false })
    expect(restoreControl(true, 'failed', undefined)).toEqual({ visible: true, disabled: false })
  })

  test('is disabled while restoring or when the host says why not', () => {
    expect(restoreControl(true, 'restoring', undefined).disabled).toBe(true)
    expect(restoreControl(true, 'idle', 'Read-only replay.').disabled).toBe(true)
  })

  test('goes once restored', () => {
    expect(restoreControl(true, 'restored', undefined).visible).toBe(false)
  })
})

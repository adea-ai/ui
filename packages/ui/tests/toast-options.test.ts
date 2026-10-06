import { describe, expect, test } from 'bun:test'
import { errorToastOptions } from '../src/components/ui/toast/toast'

describe('toast.error options', () => {
  test('an error toast persists until dismissed by default', () => {
    const options = errorToastOptions('Sync failed')

    expect(options.tone).toBe('destructive')
    expect(options.persistent).toBe(true)
    expect(options.title).toBe('Sync failed')
  })

  test('the caller owns persistence, and a timed error keeps its duration', () => {
    const options = errorToastOptions('Check failed again', {
      persistent: false,
      duration: 7000,
    })

    expect(options.persistent).toBe(false)
    expect(options.duration).toBe(7000)
    expect(options.tone).toBe('destructive')
  })

  test('an explicit persistent error is honoured, not re-defaulted', () => {
    expect(errorToastOptions('Must be seen', { persistent: true }).persistent).toBe(true)
  })
})

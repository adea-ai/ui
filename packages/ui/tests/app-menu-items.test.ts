import { describe, expect, test } from 'bun:test'
import { createAppMenuItems } from '../src/components/composites/account-menu'

const callback = () => {}

describe('shared app menu model', () => {
  test('host-specific first entry precedes the same ordered support destinations', () => {
    const options = {
      onAbout: callback,
      onHelp: callback,
      onFeedback: callback,
      onUpdates: callback,
      onSettings: callback,
      settingsShortcut: '⌘,',
    }
    const cortana = createAppMenuItems({ ...options, primaryItem: { id: 'index', label: 'Index' } })
    const adea = createAppMenuItems({
      ...options,
      primaryItem: { id: 'mobile', label: 'Get Adea mobile', disabled: true },
    })
    expect(cortana.map((item) => item.label)).toEqual([
      'Index',
      'About',
      'Help Center',
      'Send Feedback',
      'Updates',
      'Settings',
    ])
    expect(adea.slice(1)).toEqual(cortana.slice(1))
    expect(cortana.find((item) => item.id === 'updates')?.platform).toBe('desktop')
    expect(cortana.find((item) => item.id === 'settings')?.shortcut).toBe('⌘,')
  })
  test('destinations defer to the stable trigger after menu closure', () => {
    let selected: HTMLButtonElement | undefined
    const onHelp = (opener: HTMLButtonElement | undefined) => {
      selected = opener
    }
    const items = createAppMenuItems({ onHelp })
    const help = items.find((item) => item.id === 'help')!
    const trigger = {} as HTMLButtonElement
    expect(help.onSelect).toBeUndefined()
    help.onSelectAfterClose?.(trigger)
    expect(selected).toBe(trigger)
    expect(items.find((item) => item.id === 'feedback')?.disabled).toBe(true)
    expect(help.disabled).toBe(false)
  })
})

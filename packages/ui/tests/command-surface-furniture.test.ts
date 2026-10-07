import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The pending-update indicator and the command footer furniture.
 *
 * The unit lane has no DOM, so — like `menu-item-indicator.test.ts` — this
 * holds the contracts in source. Both behaviours are exercised against a real
 * render in the storybook lane (`component-account-menu-focus.spec.ts`), but
 * the source assertions keep the token-only, statically readable class contract
 * and the data-slot hooks from drifting quietly.
 */
const root = resolve(import.meta.dirname, '../src/components')
const accountMenu = readFileSync(resolve(root, 'composites/account-menu/account-menu.tsx'), 'utf8')
const command = readFileSync(resolve(root, 'ui/command/command.tsx'), 'utf8')

describe('account menu pending-update indicator', () => {
  test('declares updateAvailable and extends the accessible names with words', () => {
    expect(accountMenu).toContain('updateAvailable?: boolean')
    // The dot is aria-hidden, so the state is announced: the trigger and the
    // updates row both gain ", update available".
    const nameExtensions = accountMenu.match(/, update available/g) ?? []
    expect(nameExtensions.length).toBe(2)
    expect(accountMenu).toContain("item.id === 'updates'")
  })

  test('draws exactly two dots, both token-styled and hooked for hosts', () => {
    const dots = accountMenu.match(/data-slot="account-menu-update-dot"/g) ?? []
    expect(dots.length).toBe(2)
    // The accent dot is a semantic token, never a raw palette colour or an
    // arbitrary value; each dot's own class list carries it.
    const dotClassLists = [
      ...accountMenu.matchAll(/data-slot="account-menu-update-dot"[\s\S]*?class="([^"]+)"/g),
    ].map((match) => match[1])
    expect(dotClassLists.length).toBe(2)
    for (const classes of dotClassLists) {
      expect(classes).toContain('bg-primary')
      expect(classes).not.toMatch(/\w-\[/)
    }
  })

  test('marks the trigger with a host hook', () => {
    expect(accountMenu.match(/data-slot="account-menu-trigger"/g)?.length).toBe(2)
  })
})

describe('command footer furniture', () => {
  test('the status line and the hint are hooked, muted paragraphs', () => {
    expect(command).toContain('data-slot="command-status"')
    expect(command).toContain('data-slot="command-hint"')
    const status = command.slice(command.indexOf('data-slot="command-status"'))
    expect(status).toContain('text-muted-foreground')
    const hint = command.slice(command.indexOf('data-slot="command-hint"'))
    expect(hint).toContain('text-muted-foreground')
    expect(hint).toContain('text-right')
  })
})

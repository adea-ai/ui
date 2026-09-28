import { expect, test } from 'bun:test'
import { cn } from '../src/lib/utils'

// Class-merger fixtures from the published token namespace; the app linter
// reads only its local theme schema, so unknown-class findings do not apply.
/* oxlint-disable shadcn/no-unknown-classes */
test('token-derived utilities conflict-resolve within their family', () => {
  expect(cn('h-control-md', 'h-control-sm')).toBe('h-control-sm')
  expect(cn('w-sidebar', 'w-sidebar-compact')).toBe('w-sidebar-compact')
  expect(cn('size-control-lg', 'size-control-sm')).toBe('size-control-sm')
})

test('different families and non-conflicting utilities are all kept', () => {
  expect(cn('h-control-md', 'w-rail')).toBe('h-control-md w-rail')
  expect(cn('p-2', 'flex')).toBe('p-2 flex')
})

test('standard Tailwind conflicts resolve and conditional inputs still compose', () => {
  expect(cn('p-2', 'p-4')).toBe('p-4')
  expect(cn('p-2', { 'p-4': true, hidden: false }, 'global-hook')).toBe('p-4 global-hook')
  const active = true as boolean
  expect(cn('base', active && 'is-active')).toBe('base is-active')
})
/* oxlint-enable shadcn/no-unknown-classes */

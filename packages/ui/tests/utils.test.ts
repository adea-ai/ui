import { expect, test } from 'bun:test'
import { buttonVariants } from '../src/components/ui/button/button'
import { cn } from '../src/lib/utils'
import { controlSize, controlSizeIcon, controlSizes } from '../src/lib/variants'

// Class-merger fixtures from the published token namespace; the app linter
// reads only its local theme schema, so unknown-class findings do not apply.
/* oxlint-disable shadcn/no-unknown-classes */
test('token-derived utilities conflict-resolve within their family', () => {
  expect(cn('h-control-md', 'h-control-sm')).toBe('h-control-sm')
  expect(cn('h-control-xl', 'h-control-2xl')).toBe('h-control-2xl')
  expect(cn('w-sidebar', 'w-sidebar-compact')).toBe('w-sidebar-compact')
  expect(cn('size-control-lg', 'size-control-sm')).toBe('size-control-sm')
  expect(cn('size-control-xl', 'size-control-2xl')).toBe('size-control-2xl')
})

// The token utilities used to sit in groups of their own, which conflict only with
// themselves: `cn('h-control-sm', 'h-auto')` kept both and stylesheet order chose
// the control height, so ThemePicker's options were 28px tall with squashed
// previews. They now extend Tailwind's own groups and inherit their conflicts.
test('token-derived utilities conflict with the standard utilities of the same property', () => {
  expect(cn('h-control-sm', 'h-auto')).toBe('h-auto')
  expect(cn('h-auto', 'h-control-sm')).toBe('h-control-sm')
  expect(cn('h-row-md', 'h-10')).toBe('h-10')
  expect(cn('min-h-row-sm', 'min-h-0')).toBe('min-h-0')
  expect(cn('w-rail', 'w-auto')).toBe('w-auto')
  expect(cn('size-control-sm', 'size-auto')).toBe('size-auto')
  expect(cn('size-control-sm', 'h-auto')).toBe('size-control-sm h-auto')
  expect(cn('px-control-sm', 'p-0')).toBe('p-0')
  expect(cn('px-control-sm', 'px-control-md')).toBe('px-control-md')
  expect(cn('h-control-sm px-control-sm', 'h-auto p-0')).toBe('h-auto p-0')
})

test('the stable 2xl control rung uses shared 48px tokens for text and icon buttons', () => {
  expect(controlSizes).toContain('2xl')
  expect(controlSize['2xl']).toContain('h-control-2xl')
  expect(controlSizeIcon['2xl']).toContain('size-control-2xl')
})

test('comfortable touch target is opt-in and preserves the chosen icon rung', () => {
  const standard = buttonVariants({ size: 'icon-md' })
  const comfortable = buttonVariants({ size: 'icon-md', touchTarget: 'comfortable' })

  expect(standard).not.toContain('touch-target-comfortable')
  expect(comfortable).toContain('touch-target-comfortable')
  expect(comfortable).toContain('size-control-md')
  expect(comfortable).toContain('[&_svg]:size-4')
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

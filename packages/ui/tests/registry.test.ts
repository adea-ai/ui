import { describe, expect, test } from 'bun:test'
import { designTokens } from '../src/lib/tokens'
import { registryItems } from '../scripts/registry-core'
import { validateRegistry } from '../scripts/validate-registry'

/**
 * The registry is the distribution contract.
 *
 * These tests run the same checks as `bun run registry:validate`, from the same
 * implementation, so a component cannot be added without appearing in the
 * registry, and the committed registry cannot be left stale.
 */
describe('registry', () => {
  test('is valid against the source, the manifest and the public exports', () => {
    const findings = validateRegistry()

    expect(
      findings,
      'A registry finding means a consumer installing a component would get a payload ' +
        'that does not compile or does not resolve. See scripts/validate-registry.ts for ' +
        'what each check defends against.'
    ).toEqual([])
  })

  test('covers every component folder, plus the theme', () => {
    const names = registryItems.map((item) => item.name)

    // 53 component folders is not the assertion — the assertion is that the
    // theme is present (a component without tokens is unusable) and that the
    // catalogue is not trivially small.
    expect(names).toContain('theme')
    expect(names.length).toBeGreaterThan(50)
  })

  test('ships no stories or documentation as consumer source', () => {
    const offenders = registryItems.flatMap((item) =>
      item.files
        .filter((file) => file.path.endsWith('.stories.tsx') || file.path.endsWith('.mdx'))
        .map((file) => `${item.name}/${file.path}`)
    )

    expect(
      offenders,
      "A copied component must not bring our stories into someone else's project."
    ).toEqual([])
  })

  test('declares the peer item for every cross-component import', () => {
    // These two genuinely reach into another component's folder: Sheet reuses the
    // dialog's overlay so the two scrims cannot diverge, and ToggleGroup reuses the
    // Toggle's variants so a group item and a standalone toggle cannot drift. If
    // cross-item detection ever stops working, they are what notices.
    //
    // The rail used to be a third: it reused Tooltip. It no longer does — the
    // collapsed rail's flyout is its own portalled element, because a standard
    // tooltip could not be made flush with the row or carry the icon and the chord.
    // This assertion is what noticed the dependency had gone.
    const sheet = registryItems.find((item) => item.name === 'sheet')
    const toggleGroup = registryItems.find((item) => item.name === 'toggle-group')

    expect(sheet?.registryDependencies ?? []).toContain('@adea-ai/ui/dialog')
    expect(toggleGroup?.registryDependencies ?? []).toContain('@adea-ai/ui/toggle')
  })

  test('a component that composes around a slot rather than importing controls has no peers', () => {
    // `settings` is label, description and a control slot. It takes whatever the
    // caller passes, so it must not depend on the controls a particular page uses —
    // a peer here would drag Switch and Input into a project that wanted neither.
    const settings = registryItems.find((item) => item.name === 'settings')

    expect(settings?.registryDependencies ?? []).toEqual([])
  })

  test('every style item ships the whole token set', () => {
    const theme = registryItems.find((item) => item.name === 'theme')

    expect(theme?.files.map((file) => file.path).toSorted()).toEqual([
      'src/styles/base.css',
      'src/styles/fonts.css',
      'src/styles/globals.css',
      'src/styles/theme.css',
    ])
  })
})

/**
 * The token manifest is the design system's own contract, and two consumers read
 * it: the Storybook galleries and `tests/tokens.test.ts`. These assertions guard
 * the parts of it a gallery depends on structurally.
 */
describe('token manifest shape', () => {
  test('every group is non-empty and every token is described', () => {
    for (const [group, tokens] of Object.entries(designTokens)) {
      expect(tokens.length, `${group} is empty`).toBeGreaterThan(0)

      for (const token of tokens) {
        expect(token.description.length, `${token.name} has no description`).toBeGreaterThan(10)
      }
    }
  })

  test('token names are unique across the manifest', () => {
    const names = designTokens.color
      .concat(
        designTokens.radius,
        designTokens.typography,
        designTokens.density,
        designTokens.elevation,
        designTokens.motion,
        designTokens.zIndex
      )
      .map((token) => token.name)

    const duplicates = names.filter((name, index) => names.indexOf(name) !== index)
    expect(duplicates).toEqual([])
  })
})

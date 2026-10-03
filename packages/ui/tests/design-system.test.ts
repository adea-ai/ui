import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * The design-system artifact shows every shared component. Its inventory is the
 * contract: every `registry:ui` item has at least one card, every card has a live
 * preview, and no preview is orphaned. A new component that skips the artifact fails
 * here rather than quietly going missing from the page the team reviews.
 */

const PACKAGE = resolve(import.meta.dirname, '..')
const SOURCE = join(PACKAGE, 'design-system')

type Card = { card: string; group: string; source?: string }
const inventory = JSON.parse(readFileSync(join(SOURCE, 'inventory.json'), 'utf8')) as {
  items: Record<string, Card[]>
}
const registry = JSON.parse(readFileSync(join(PACKAGE, 'registry.json'), 'utf8')) as {
  items: { name: string; type: string }[]
}
const cards = Object.values(inventory.items).flat()
const GROUPS = new Set([
  'Actions',
  'Forms',
  'Feedback',
  'Data display',
  'Navigation',
  'Overlays',
  'Layout',
  'Code',
  'Shell',
  'Composites',
  'Conversation',
  'Theming',
  'Motion',
  'Typography',
])

describe('design-system inventory', () => {
  test('covers every registry:ui item, and nothing else', () => {
    const ui = registry.items.filter((item) => item.type === 'registry:ui').map((item) => item.name)
    expect(Object.keys(inventory.items).toSorted()).toEqual(ui.toSorted())
  })

  test('gives every item at least one card, and every card a unique name', () => {
    for (const [item, entries] of Object.entries(inventory.items)) {
      expect(entries.length, item).toBeGreaterThan(0)
    }
    expect(new Set(cards.map((card) => card.card)).size).toBe(cards.length)
  })

  test('files every card under a known group', () => {
    for (const card of cards) expect(GROUPS.has(card.group), card.card).toBe(true)
  })

  test('points every explicit source at a file that exists', () => {
    for (const card of cards) {
      if (card.source) {
        expect(existsSync(join(PACKAGE, 'src/components', card.source)), card.card).toBe(true)
      }
    }
  })
})

describe('design-system previews', () => {
  const folders = readdirSync(join(SOURCE, 'components'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

  test('exist for every card, with the card marker on line 1 naming its group', () => {
    for (const card of cards) {
      const path = join(SOURCE, 'components', card.card, 'preview.html')
      expect(existsSync(path), `${card.card} has no preview.html`).toBe(true)
      const marker = readFileSync(path, 'utf8').split('\n')[0] ?? ''
      expect(marker, card.card).toMatch(/^<!-- @dsCard /)
      expect(marker, card.card).toContain(`group="${card.group}"`)
    }
  })

  test('belong to a card in the inventory, apart from the cover', () => {
    const known = new Set([...cards.map((card) => card.card), 'Cover'])
    for (const folder of folders)
      expect(known.has(folder), `${folder} is not in the inventory`).toBe(true)
  })

  test('load nothing from the network', () => {
    for (const card of cards) {
      const html = readFileSync(join(SOURCE, 'components', card.card, 'preview.html'), 'utf8')
      expect(html, card.card).not.toMatch(/<iframe|\bfetch\(|src="https?:/)
    }
  })
})

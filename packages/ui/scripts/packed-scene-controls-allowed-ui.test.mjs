// The packed scene-controls gate fails on any retained UI module outside this
// allow-list. The tooltip's own focus gate is shipped infrastructure; every
// other lib module, and components that belong to the other fixture, must still
// be rejected.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allowedPackedUi } from './packed-scene-controls-allowed-ui.mjs'

const base = '/tmp/c/node_modules/@adea-ai/ui'
const fixtures = ['scene-controls', 'action-button-touch', 'action-button-tooltip']

test('allows the tooltip focus gate the shared tooltip imports, compiled and Solid', () => {
  for (const name of fixtures)
    for (const path of [
      `${base}/dist/lib/tooltip-focus-gate.js`,
      `${base}/src/lib/tooltip-focus-gate.ts`,
    ])
      assert.equal(allowedPackedUi(name).test(path), true, `${name} ${path}`)
})

test('still allows the lib modules it allowed before', () => {
  for (const name of fixtures)
    for (const lib of ['cn-tables.generated', 'overlay', 'utils', 'variants'])
      assert.equal(allowedPackedUi(name).test(`${base}/dist/lib/${lib}.js`), true, `${name} ${lib}`)
})

test('rejects unrelated lib modules, including near-misses of the allowed names', () => {
  for (const name of fixtures)
    for (const lib of [
      'themes',
      'terminal-bytes',
      'tooltip-focus-gate-extra',
      'tooltip-focus',
      'my-tooltip-focus-gate',
      'overlay-extra',
    ])
      assert.equal(
        allowedPackedUi(name).test(`${base}/dist/lib/${lib}.js`),
        false,
        `${name} ${lib}`
      )
  // The module name is only allowed as a lib module, not as a path segment elsewhere.
  assert.equal(
    allowedPackedUi('scene-controls').test(`${base}/dist/components/ui/tooltip-focus-gate.js`),
    false
  )
})

test("keeps each fixture's component allow-list narrow", () => {
  assert.equal(
    allowedPackedUi('scene-controls').test(`${base}/dist/components/ui/popover/popover.js`),
    false
  )
  assert.equal(
    allowedPackedUi('scene-controls').test(`${base}/dist/components/ui/dropdown-menu/menu.js`),
    false
  )
  assert.equal(
    allowedPackedUi('action-button-tooltip').test(`${base}/dist/components/ui/popover/popover.js`),
    true
  )
  assert.equal(
    allowedPackedUi('action-button-tooltip').test(`${base}/dist/components/ui/dialog/dialog.js`),
    false
  )
})

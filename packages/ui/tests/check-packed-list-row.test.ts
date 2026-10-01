import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { findUnrelatedPackedRowModules } from '../scripts/packed-row-modules'

const checker = resolve(import.meta.dir, '../scripts/check-packed-list-row.ts')

test('packed ListRow guard allows the traced Tooltip utilities and rejects unrelated Corvu modules', () => {
  const defaultTooltipUtility =
    '/Users/runner/.bun/install/cache/links/@corvu+utils@0.4.2+lockhash/node_modules/@corvu/utils/dist/chunk/ZV6G25TT.js'
  const solidTooltipUtility =
    '/Users/runner/.bun/install/cache/links/@corvu+utils@0.4.2+lockhash/node_modules/@corvu/utils/dist/chunk/U42ECMND.jsx'
  const drawer = '/tmp/consumer/node_modules/@corvu/drawer/dist/index.js'
  const unverifiedUtility = '/tmp/consumer/node_modules/@corvu/utils/dist/scroll/index.js'
  const unknownUtilityChunk =
    '/Users/runner/.bun/install/cache/links/@corvu+utils@0.4.2+lockhash/node_modules/@corvu/utils/dist/chunk/UNKNOWN.jsx'
  const changedVersionUtility =
    '/Users/runner/.bun/install/cache/links/@corvu+utils@0.5.0+lockhash/node_modules/@corvu/utils/dist/chunk/ZV6G25TT.js'
  const changedVersionSolidUtility =
    '/Users/runner/.bun/install/cache/links/@corvu+utils@0.5.0+lockhash/node_modules/@corvu/utils/dist/chunk/U42ECMND.jsx'
  // When the consumer installs on another filesystem than bun's cache (as CI's
  // /tmp consumer does) packages are copied, so the module ID carries no
  // inlined version and only the chunk identity can be matched.
  const copiedTooltipUtility = '/tmp/consumer/node_modules/@corvu/utils/dist/chunk/ZV6G25TT.js'
  const copiedSolidTooltipUtility =
    '/tmp/consumer/node_modules/@corvu/utils/dist/chunk/U42ECMND.jsx'
  const copiedUnknownUtilityChunk = '/tmp/consumer/node_modules/@corvu/utils/dist/chunk/UNKNOWN.jsx'

  expect(
    findUnrelatedPackedRowModules([
      defaultTooltipUtility,
      solidTooltipUtility,
      copiedTooltipUtility,
      copiedSolidTooltipUtility,
      drawer,
      unverifiedUtility,
      unknownUtilityChunk,
      changedVersionUtility,
      changedVersionSolidUtility,
      copiedUnknownUtilityChunk,
    ])
  ).toEqual([
    drawer,
    unverifiedUtility,
    unknownUtilityChunk,
    changedVersionUtility,
    changedVersionSolidUtility,
    copiedUnknownUtilityChunk,
  ])
})

for (const [name, override] of [
  ['a test filter', { ADEA_LIST_ROW_TEST_GREP: 'keyboard tooltips' }],
  ['repeated cases', { ADEA_LIST_ROW_REPEAT_EACH: '3' }],
] as const) {
  test(`CI rejects ${name} in the packed ListRow gate`, () => {
    const result = spawnSync('bun', [checker], {
      env: { ...process.env, CI: 'true', ...override },
      encoding: 'utf8',
      timeout: 10_000,
    })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(
      'CI must run the complete packed ListRow browser suite exactly once'
    )
  })
}

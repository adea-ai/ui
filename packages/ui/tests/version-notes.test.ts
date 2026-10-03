import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { formatReleaseDate } from '../src/lib/version-notes'

// The defect only shows west of UTC, so the formatter runs in a subprocess with a
// pinned zone rather than trusting whatever zone the test machine happens to use.
const modulePath = resolve(import.meta.dirname, '../src/lib/version-notes.ts')

function formatIn(timeZone: string, value: string): string {
  const result = Bun.spawnSync({
    cmd: [
      process.execPath,
      '-e',
      `const { formatReleaseDate } = await import(${JSON.stringify(modulePath)}); process.stdout.write(String(formatReleaseDate(${JSON.stringify(value)})))`,
    ],
    env: { ...process.env, TZ: timeZone },
  })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return result.stdout.toString()
}

const twentyFourth = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
}).format(Date.UTC(2026, 8, 24))

test('a date-only release keeps its calendar day in every zone', () => {
  for (const zone of ['America/Los_Angeles', 'Pacific/Honolulu', 'UTC', 'Pacific/Kiritimati']) {
    expect(formatIn(zone, '2026-09-24')).toBe(twentyFourth)
  }
})

test('a full timestamp is still formatted in the reader zone', () => {
  // 02:00Z on the 24th is still the 23rd in Los Angeles.
  expect(formatIn('America/Los_Angeles', '2026-09-24T02:00:00Z')).not.toBe(twentyFourth)
  expect(formatIn('UTC', '2026-09-24T02:00:00Z')).toBe(twentyFourth)
})

test('an unparseable date is shown verbatim and an empty one is dropped', () => {
  expect(formatReleaseDate('next tuesday')).toBe('next tuesday')
  expect(formatReleaseDate(null)).toBeNull()
})

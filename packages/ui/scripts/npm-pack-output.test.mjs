// `npm pack --json` prints an array on npm <= 11 and an object keyed by package
// name on npm 12. Every packed gate reads the tarball name through
// parseNpmPackEntry, so both shapes (and the failures) are pinned here.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseNpmPackEntry } from './npm-pack-output.mjs'

const entry = {
  id: '@adea-ai/ui@0.146.3',
  name: '@adea-ai/ui',
  filename: 'adea-ai-ui-0.146.3.tgz',
  files: [{ path: 'package.json' }],
}

test('reads the array shape of npm 11 and earlier', () => {
  assert.deepEqual(parseNpmPackEntry(JSON.stringify([entry])), entry)
})

test('reads the object keyed by package name that npm 12 prints', () => {
  assert.deepEqual(parseNpmPackEntry(JSON.stringify({ '@adea-ai/ui': entry })), entry)
})

test('reads a bare entry', () => {
  assert.deepEqual(parseNpmPackEntry(JSON.stringify(entry)), entry)
})

test('takes the first entry that names a tarball', () => {
  const other = { ...entry, name: 'other', filename: 'other-1.0.0.tgz' }
  assert.equal(
    parseNpmPackEntry(JSON.stringify([{ name: 'no-file' }, other, entry])).filename,
    'other-1.0.0.tgz'
  )
})

test('refuses a report that names no tarball', () => {
  for (const raw of ['[]', '{}', 'null', '"x"', '{"a":{"filename":""}}', '[{"name":"x"}]']) {
    assert.throws(() => parseNpmPackEntry(raw), /did not report an artifact filename/, raw)
  }
})

test('refuses output that is not JSON instead of guessing', () => {
  assert.throws(() => parseNpmPackEntry('npm notice nothing'), SyntaxError)
})

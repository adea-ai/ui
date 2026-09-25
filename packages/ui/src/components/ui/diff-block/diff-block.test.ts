import { describe, expect, test } from 'bun:test'
import { diffStats, diffTargetPath, parseDiff } from './diff-block'

const patch = [
  'diff --git a/src/app.tsx b/src/app.tsx',
  'index 1a2b3c4..5d6e7f8 100644',
  '--- a/src/app.tsx',
  '+++ b/src/app.tsx',
  '@@ -10,7 +10,8 @@ export function App() {',
  '   const [count, setCount] = createSignal(0)',
  '-  const label = "count"',
  '-  return <p>{label}: {count()}</p>',
  '+  const label = "total"',
  '+  const suffix = "!"',
  '+  return <p>{label}: {count()}{suffix}</p>',
  ' }',
  '\\ No newline at end of file',
].join('\n')

describe('parseDiff', () => {
  test('classifies the file header, hunk, additions, deletions and context', () => {
    const kinds = parseDiff(patch).map((line) => line.kind)
    expect(kinds).toEqual([
      'header',
      'header',
      'header',
      'header',
      'hunk',
      'context',
      'delete',
      'delete',
      'add',
      'add',
      'add',
      'context',
      'meta',
    ])
  })

  /**
   * The case a prefix-only renderer gets wrong: inside a hunk, a line whose
   * content begins with `++` is an addition, not a file header.
   */
  test('a +++ line inside a hunk is an addition, not a file header', () => {
    const inner = ['@@ -1,2 +1,2 @@', ' context', '+++ plusplus'].join('\n')
    const lines = parseDiff(inner)
    expect(lines[2]!.kind).toBe('add')
    expect(lines[2]!.text).toBe('++ plusplus')
  })

  test('the --- line before the first hunk is a file header', () => {
    const lines = parseDiff('--- a/x\n+++ b/x\n@@ -1 +1 @@\n-a\n+b')
    expect(lines[0]!.kind).toBe('header')
    expect(lines[1]!.kind).toBe('header')
  })

  test('numbers both sides', () => {
    const lines = parseDiff(patch).filter(
      (line) => line.kind === 'context' || line.kind === 'add' || line.kind === 'delete'
    )
    // Hunk starts at old 10 / new 10.
    expect(lines[0]!.oldLine).toBe(10)
    expect(lines[0]!.newLine).toBe(10)
    // The first deletion is old-side only, at 11.
    expect(lines[1]!.oldLine).toBe(11)
    expect(lines[1]!.newLine).toBeUndefined()
    // The first addition is new-side only, at 11.
    expect(lines[3]!.newLine).toBe(11)
    expect(lines[3]!.oldLine).toBeUndefined()
  })

  test('a bare newline is not an extra line', () => {
    expect(parseDiff('@@ -1 +1 @@\n-a\n+b\n')).toHaveLength(3)
  })

  test('an empty patch yields no lines', () => {
    expect(parseDiff('')).toHaveLength(1)
    expect(parseDiff('').every((line) => line.kind === 'meta')).toBe(true)
  })

  test('a metadata line before a hunk is not a file header', () => {
    const lines = parseDiff('mode change 100644 => 100755 src/x.ts\n@@ -1 +1 @@\n-a\n+b')
    expect(lines[0]!.kind).toBe('meta')
  })
})

describe('diffStats', () => {
  test('counts additions and removals and nothing else', () => {
    expect(diffStats(parseDiff(patch))).toEqual({ added: 3, removed: 2 })
  })
})

describe('diffTargetPath', () => {
  test('prefers the +++ b/ side', () => {
    expect(diffTargetPath(patch)).toBe('src/app.tsx')
  })

  test('reads a plain unified diff without the a/ b/ prefixes', () => {
    expect(diffTargetPath('--- old/x.ts\n+++ new/x.ts\n@@ -1 +1 @@\n-a\n+b')).toBe('new/x.ts')
  })

  test('skips /dev/null, which names no file', () => {
    expect(diffTargetPath('--- /dev/null\n+++ b/added.ts\n@@ -0,0 +1 @@\n+x')).toBe('added.ts')
  })

  test('falls back to the diff --git header', () => {
    expect(diffTargetPath('diff --git a/deep/path/f.ts b/deep/path/f.ts')).toBe('deep/path/f.ts')
  })

  test('a +++ line inside a hunk is not treated as a header', () => {
    expect(diffTargetPath('@@ -1 +1 @@\n+++ not/a/path')).toBeNull()
  })

  test('returns null when nothing names a file', () => {
    expect(diffTargetPath('some random text')).toBeNull()
  })
})

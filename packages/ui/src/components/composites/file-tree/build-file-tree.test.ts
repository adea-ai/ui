import { describe, expect, test } from 'bun:test'
import {
  buildFileTree,
  clampWindow,
  countChanges,
  describeChanges,
  FILE_TREE_MAX_DEPTH,
  flattenFileTree,
  indexFileTree,
  initialExpanded,
  normalizePath,
  revealInWindow,
  typeaheadIndex,
  type FileTreeNode,
} from './build-file-tree'

/** Names of a level, directories marked with a trailing slash. */
const names = (nodes: readonly FileTreeNode[]) =>
  nodes.map((node) => (node.kind === 'directory' ? `${node.name}/` : node.name))

describe('normalizePath', () => {
  test('accepts posix and windows separators', () => {
    expect(normalizePath('src/lib/a.ts')).toEqual(['src', 'lib', 'a.ts'])
    expect(normalizePath('src\\lib\\a.ts')).toEqual(['src', 'lib', 'a.ts'])
    expect(normalizePath('src/lib\\a.ts')).toEqual(['src', 'lib', 'a.ts'])
  })

  test('drops empty and current-directory segments and leading or trailing separators', () => {
    expect(normalizePath('/src//lib/./a.ts/')).toEqual(['src', 'lib', 'a.ts'])
    expect(normalizePath('./a.ts')).toEqual(['a.ts'])
    expect(normalizePath('C:\\repo\\a.ts')).toEqual(['C:', 'repo', 'a.ts'])
  })

  test('rejects parent-directory segments anywhere', () => {
    expect(normalizePath('../a.ts')).toBeNull()
    expect(normalizePath('src/../../etc/passwd')).toBeNull()
    expect(normalizePath('src\\..\\a.ts')).toBeNull()
    expect(normalizePath('a/..')).toBeNull()
  })

  test('keeps names that merely contain dots', () => {
    expect(normalizePath('a/..b/c..')).toEqual(['a', '..b', 'c..'])
    expect(normalizePath('.github/workflows/ci.yml')).toEqual(['.github', 'workflows', 'ci.yml'])
  })

  test('rejects empty paths, non-strings and control or bidirectional characters', () => {
    for (const bad of [
      '',
      '/',
      '//',
      '.',
      './.',
      undefined,
      null,
      5,
      {},
      'a\nb',
      'a\u0000b',
      'a\u202Eb',
      'a\u0085b',
    ]) {
      expect(normalizePath(bad)).toBeNull()
    }
  })

  test('rejects over-long segments and over-deep paths', () => {
    expect(normalizePath('a'.repeat(5000))).toBeNull()
    expect(
      normalizePath(Array.from({ length: FILE_TREE_MAX_DEPTH }, () => 'd').join('/'))
    ).not.toBeNull()
    expect(
      normalizePath(Array.from({ length: FILE_TREE_MAX_DEPTH + 1 }, () => 'd').join('/'))
    ).toBeNull()
  })
})

describe('buildFileTree', () => {
  test('builds folders and files, folders first, case-insensitively sorted', () => {
    const { roots } = buildFileTree(
      ['b.ts', 'src/z.ts', 'A.ts', 'src/a.ts', 'docs/readme.md', 'c.ts'],
      {
        compact: false,
      }
    )
    expect(names(roots)).toEqual(['docs/', 'src/', 'A.ts', 'b.ts', 'c.ts'])
    expect(names(roots[1]!.children)).toEqual(['a.ts', 'z.ts'])
  })

  test('ids are normalised paths, so windows and posix spellings meet', () => {
    const { roots, duplicates, fileCount } = buildFileTree([
      'src\\lib\\a.ts',
      'src/lib/a.ts',
      './src//lib/a.ts',
    ])
    expect(duplicates).toBe(2)
    expect(fileCount).toBe(1)
    expect(roots[0]!.id).toBe('src/lib')
    expect(roots[0]!.children[0]!.id).toBe('src/lib/a.ts')
  })

  test('the first of two duplicates wins', () => {
    const { roots } = buildFileTree([
      { path: 'a.ts', change: 'added' },
      { path: 'a.ts', change: 'deleted' },
    ])
    expect(roots[0]!.change).toBe('added')
  })

  test('rejected paths are returned as given and nothing else is lost', () => {
    const { roots, rejected, fileCount } = buildFileTree([
      'ok.ts',
      '../escape.ts',
      '',
      'a/../b',
      'fine/also.ts',
    ])
    expect(rejected).toEqual(['../escape.ts', '', 'a/../b'])
    expect(fileCount).toBe(2)
    expect(names(roots)).toEqual(['fine/', 'ok.ts'])
  })

  test('reads change kinds and counts, and ignores nonsense', () => {
    const { roots } = buildFileTree([
      { path: 'a.ts', change: 'added', additions: 10, deletions: 0 },
      {
        path: 'b.ts',
        change: 'renamed',
        renamedFrom: 'old/b.ts',
        additions: -3,
        deletions: Number.NaN,
      },
      { path: 'c.ts', change: 'exploded' as never },
    ])
    expect(roots[0]).toMatchObject({ change: 'added', additions: 10, deletions: 0 })
    expect(roots[1]).toMatchObject({ change: 'renamed', renamedFrom: 'old/b.ts' })
    expect(roots[1]!.additions).toBeUndefined()
    expect(roots[1]!.deletions).toBeUndefined()
    expect(roots[2]!.change).toBeUndefined()
  })

  test('a path that is both a file and a folder is a folder that keeps its change', () => {
    const { roots } = buildFileTree([{ path: 'a', change: 'deleted' }, 'a/b.ts'])
    expect(roots[0]).toMatchObject({ kind: 'directory', change: 'deleted', name: 'a' })
    expect(names(roots[0]!.children)).toEqual(['b.ts'])
  })

  test('counts files below each folder', () => {
    const { roots } = buildFileTree(['a/b/1.ts', 'a/b/2.ts', 'a/3.ts', '4.ts'], { compact: false })
    const a = roots[0]!
    expect(a.fileCount).toBe(3)
    expect(a.children[0]!.fileCount).toBe(2)
  })

  test('compacts a chain of single-folder parents into one row', () => {
    const { roots } = buildFileTree([
      'packages/ui/src/a.ts',
      'packages/ui/src/b.ts',
      'packages/ui/README.md',
    ])
    expect(roots[0]!.name).toBe('packages/ui')
    expect(roots[0]!.id).toBe('packages/ui')
    expect(names(roots[0]!.children)).toEqual(['src/', 'README.md'])
  })

  test('does not compact across a folder that carries its own change', () => {
    const { roots } = buildFileTree([{ path: 'a', change: 'renamed' }, 'a/b/c.ts'])
    expect(roots[0]!.name).toBe('a')
    expect(roots[0]!.children[0]!.name).toBe('b')
  })

  test('empty input', () => {
    expect(buildFileTree([])).toEqual({ roots: [], rejected: [], duplicates: 0, fileCount: 0 })
  })

  test('a very deep path builds without recursion', () => {
    const folders = Array.from({ length: FILE_TREE_MAX_DEPTH - 1 }, (_, i) => `d${i}`)
    const { roots, fileCount } = buildFileTree([[...folders, 'x.ts'].join('/')], { compact: false })
    expect(fileCount).toBe(1)
    let depth = 0
    let node: FileTreeNode | undefined = roots[0]
    while (node) {
      depth += 1
      node = node.children[0]
    }
    expect(depth).toBe(FILE_TREE_MAX_DEPTH)
  })

  test('a path with a hundred thousand segments is rejected without trouble', () => {
    const path = Array.from({ length: 100_000 }, () => 'd').join('/')
    const { roots, rejected } = buildFileTree([path])
    expect(roots).toEqual([])
    expect(rejected.length).toBe(1)
  })

  test('5 000 files build quickly and project only what is expanded', () => {
    const files = Array.from({ length: 5000 }, (_, i) => `pkg${i % 50}/module${i % 7}/file${i}.ts`)
    const started = performance.now()
    const { roots, fileCount } = buildFileTree(files)
    expect(fileCount).toBe(5000)
    expect(roots.length).toBe(50)
    expect(flattenFileTree(roots, new Set()).length).toBe(50)
    expect(performance.now() - started).toBeLessThan(1000)
  })

  test('folder names that collide with Object prototype keys are ordinary names', () => {
    const { roots } = buildFileTree(['__proto__/a.ts', 'constructor/b.ts', 'toString'])
    expect(names(roots)).toEqual(['__proto__/', 'constructor/', 'toString'])
  })
})

describe('flattenFileTree', () => {
  const { roots } = buildFileTree(['src/a.ts', 'src/lib/b.ts', 'src/lib/c.ts', 'README.md'], {
    compact: false,
  })

  test('shows only what is expanded, in reading order, with levels and parents', () => {
    expect(
      flattenFileTree(roots, new Set()).map((row) => [row.node.id, row.level, row.parentId])
    ).toEqual([
      ['src', 1, null],
      ['README.md', 1, null],
    ])
    expect(
      flattenFileTree(roots, new Set(['src'])).map((row) => [
        row.node.id,
        row.level,
        row.parentId,
        row.expanded,
      ])
    ).toEqual([
      ['src', 1, null, true],
      ['src/lib', 2, 'src', false],
      ['src/a.ts', 2, 'src', false],
      ['README.md', 1, null, false],
    ])
  })

  test('an expanded id that is a file or unknown is ignored', () => {
    expect(flattenFileTree(roots, new Set(['README.md', 'nope'])).length).toBe(2)
  })

  test('expanding everything lists every node once', () => {
    const all = new Set(indexFileTree(roots).keys())
    expect(flattenFileTree(roots, all).length).toBe(indexFileTree(roots).size)
  })
})

describe('initialExpanded', () => {
  const { roots, fileCount } = buildFileTree(['a/b/c/d.ts', 'a/b/e.ts', 'a/f.ts', 'g/h.ts'], {
    compact: false,
  })

  test('true opens every folder, false none', () => {
    expect([...initialExpanded(roots, true, fileCount)].toSorted()).toEqual([
      'a',
      'a/b',
      'a/b/c',
      'g',
    ])
    expect(initialExpanded(roots, false, fileCount).size).toBe(0)
  })

  test('a number opens folders down to that level', () => {
    expect([...initialExpanded(roots, 1, fileCount)].toSorted()).toEqual(['a', 'g'])
    expect([...initialExpanded(roots, 2, fileCount)].toSorted()).toEqual(['a', 'a/b', 'g'])
    expect(initialExpanded(roots, 0, fileCount).size).toBe(0)
    expect(initialExpanded(roots, -4, fileCount).size).toBe(0)
  })

  test('a list opens exactly those ids', () => {
    expect([...initialExpanded(roots, ['a/b'], fileCount)]).toEqual(['a/b'])
  })

  test('unset opens a small tree fully and a large one only at the top', () => {
    expect(initialExpanded(roots, undefined, fileCount).size).toBe(4)
    expect([...initialExpanded(roots, undefined, 5000)].toSorted()).toEqual(['a', 'g'])
  })
})

describe('countChanges and describeChanges', () => {
  test('counts files by change kind, separately from files with none given', () => {
    const { roots } = buildFileTree([
      { path: 'a/1.ts', change: 'added' },
      { path: 'a/2.ts', change: 'added' },
      { path: 'b/3.ts', change: 'modified' },
      { path: '4.ts', change: 'deleted' },
      { path: '5.ts' },
    ])
    expect(countChanges(roots)).toEqual({
      total: 5,
      added: 2,
      modified: 1,
      deleted: 1,
      renamed: 0,
      unspecified: 1,
    })
  })

  test('describes only what occurs', () => {
    const base = { total: 0, added: 0, modified: 0, deleted: 0, renamed: 0, unspecified: 0 }
    expect(describeChanges(base)).toBe('No changed files')
    expect(describeChanges({ ...base, total: 1, modified: 1 })).toBe('1 file changed: 1 modified')
    expect(describeChanges({ ...base, total: 12, added: 3, modified: 8, deleted: 1 })).toBe(
      '12 files changed: 3 added, 8 modified, 1 deleted'
    )
    expect(describeChanges({ ...base, total: 3, unspecified: 3 })).toBe('3 files changed')
  })

  test('counts a directory with its own change as a folder, not a file', () => {
    const { roots } = buildFileTree([{ path: 'a', change: 'deleted' }, 'a/b.ts'])
    expect(countChanges(roots).total).toBe(1)
  })
})

describe('typeaheadIndex', () => {
  const labels = ['src', 'scripts', 'README.md', 'sample.ts']

  test('a single letter searches after the active row and cycles', () => {
    expect(typeaheadIndex(labels, 0, 's')).toBe(1)
    expect(typeaheadIndex(labels, 1, 's')).toBe(3)
    expect(typeaheadIndex(labels, 3, 's')).toBe(0)
  })

  test('a longer prefix refines from the active row', () => {
    expect(typeaheadIndex(labels, 0, 'sc')).toBe(1)
    expect(typeaheadIndex(labels, 1, 'scr')).toBe(1)
    expect(typeaheadIndex(labels, 2, 'sa')).toBe(3)
  })

  test('repeating one letter cycles through its matches', () => {
    expect(typeaheadIndex(labels, 0, 'ss')).toBe(1)
    expect(typeaheadIndex(labels, 1, 'ss')).toBe(3)
  })

  test('ignores case and returns -1 when nothing matches', () => {
    expect(typeaheadIndex(labels, 0, 'R')).toBe(2)
    expect(typeaheadIndex(labels, 0, 'zzz-nothing')).toBe(-1)
    expect(typeaheadIndex(labels, 0, '')).toBe(-1)
    expect(typeaheadIndex([], 0, 'a')).toBe(-1)
  })
})

describe('clampWindow', () => {
  test('keeps a window inside the rows that exist and at least a page wide', () => {
    expect(clampWindow({ start: 0, end: 500 }, 5000, 500)).toEqual({ start: 0, end: 500 })
    expect(clampWindow({ start: 0, end: 500 }, 120, 500)).toEqual({ start: 0, end: 120 })
    expect(clampWindow({ start: 4000, end: 4500 }, 100, 500)).toEqual({ start: 99, end: 100 })
    expect(clampWindow({ start: -5, end: 10 }, 5000, 500)).toEqual({ start: 0, end: 500 })
    expect(clampWindow({ start: 0, end: 500 }, 0, 500)).toEqual({ start: 0, end: 0 })
  })
})

describe('revealInWindow', () => {
  const window = { start: 500, end: 1000 }

  test('a row inside the window changes nothing', () => {
    expect(revealInWindow(window, 500, 5000, 500)).toEqual(window)
    expect(revealInWindow(window, 999, 5000, 500)).toEqual(window)
  })

  test('the row just past either edge grows the window by one page', () => {
    expect(revealInWindow(window, 1000, 5000, 500)).toEqual({ start: 500, end: 1500 })
    expect(revealInWindow(window, 499, 5000, 500)).toEqual({ start: 0, end: 1000 })
    expect(revealInWindow({ start: 0, end: 500 }, 500, 520, 500)).toEqual({ start: 0, end: 520 })
  })

  test('a far row moves the window to its page instead of mounting everything between', () => {
    expect(revealInWindow({ start: 0, end: 500 }, 4999, 5000, 500)).toEqual({
      start: 4500,
      end: 5000,
    })
    expect(revealInWindow(window, 0, 5000, 500)).toEqual({ start: 0, end: 500 })
    expect(revealInWindow({ start: 0, end: 500 }, 2750, 5000, 500)).toEqual({
      start: 2500,
      end: 3000,
    })
  })

  test('an index that does not exist changes nothing', () => {
    expect(revealInWindow(window, -1, 5000, 500)).toEqual(window)
    expect(revealInWindow(window, 5000, 5000, 500)).toEqual(window)
  })
})

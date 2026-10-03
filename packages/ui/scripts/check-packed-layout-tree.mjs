/** Read-only tree imports must stay small and work without optional UI peers. */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { sharedPackedUiArchive } from './packed-artifact.mjs'

const root = resolve(import.meta.dirname, '../../..')
const consumer = mkdtempSync(join(tmpdir(), 'adea-packed-layout-tree-'))
const entry = '@adea-ai/ui/components/layout/split-layout/tree'
const run = (command, args, cwd = consumer) => {
  console.log(JSON.stringify({ owner: 'packed-layout-tree', command, args, cwd }))
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe', timeout: 180_000 })
}

try {
  const sharedArchive = sharedPackedUiArchive()
  const pack = sharedArchive
    ? { filename: sharedArchive }
    : JSON.parse(
        run('npm', ['pack', '--json', '--pack-destination', consumer], join(root, 'packages/ui'))
      )[0]
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: { '@adea-ai/ui': `file:${sharedArchive ?? join(consumer, pack.filename)}` },
    })
  )
  run('bun', ['install', '--ignore-scripts', '--omit', 'peer', '--omit', 'optional'])
  writeFileSync(
    join(consumer, 'probe.mjs'),
    `import * as tree from '${entry}';
const first = { kind: 'leaf', id: 'first', payload: { terminalId: 'opaque' } };
const second = { kind: 'leaf', id: 'second' };
const node = { kind: 'split', id: 'root', direction: 'row', ratio: 0.5, children: [first, second] };
if (tree.listLeaves(node)[0] !== first || tree.listLeaves(node)[0].payload !== first.payload || tree.countLeaves(node) !== 2 || tree.layoutDepth(node) !== 2) throw Error('packed opaque tree traversal failed');
if (tree.MAX_LAYOUT_LEAVES !== 8 || tree.MAX_LAYOUT_DEPTH !== 8 || tree.MIN_SPLIT_RATIO !== 0.1 || tree.MAX_SPLIT_RATIO !== 0.9) throw Error('packed limits drifted');
if ('splitPane' in tree || 'movePane' in tree || 'SplitLayout' in tree) throw Error('read-only tree entry exposes editing or renderer code');
console.log(JSON.stringify({ result: 'packed layout tree passed', resolved: import.meta.resolve('${entry}') }));`
  )
  const results = [
    JSON.parse(run('node', ['probe.mjs'])),
    JSON.parse(run('bun', ['--conditions=solid', 'probe.mjs'])),
  ]
  if (!results[0].resolved.includes('/dist/') || !results[1].resolved.includes('/src/'))
    throw new Error('Packed tree export conditions did not resolve compiled and Solid entries')
  for (const condition of ['import', 'solid']) {
    run('bun', [
      'build',
      'probe.mjs',
      '--target=browser',
      '--format=esm',
      `--conditions=${condition}`,
      '--outfile=tree-bundle.mjs',
    ])
    const source = readFileSync(join(consumer, 'tree-bundle.mjs'), 'utf8')
    const bytes = gzipSync(source).byteLength
    if (bytes > 1536) throw new Error(`Packed ${condition} tree exceeds 1.5 KiB gzip: ${bytes}`)
    if (/solid-js|@kobalte|@corvu|createLayoutState|function splitPane/.test(source))
      throw new Error(`Packed ${condition} tree includes a UI runtime or editing implementation`)
    console.log(JSON.stringify({ condition, gzipBytes: bytes, peers: 'omitted' }))
  }
} finally {
  rmSync(consumer, { recursive: true, force: true })
}

/** Pure public model contract against the installed archive, without UI peers. */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const root = resolve(import.meta.dirname, '../../..')
const consumer = mkdtempSync(join(tmpdir(), 'adea-packed-paste-model-'))
const entry = '@adea-ai/ui/components/conversation/paste-tokens'
const run = (command, args, cwd = consumer) => {
  console.log(JSON.stringify({ owner: 'packed-paste-model', command, args, cwd }))
  return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' })
}

try {
  const [pack] = JSON.parse(
    run('npm', ['pack', '--json', '--pack-destination', consumer], join(root, 'packages/ui'))
  )
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: { '@adea-ai/ui': `file:${join(consumer, pack.filename)}` },
    })
  )
  run('bun', ['install', '--ignore-scripts', '--omit', 'peer', '--omit', 'optional'])
  const installed = join(consumer, 'node_modules/@adea-ai/ui')
  for (const file of ['LICENSE', 'NOTICE']) {
    if (
      readFileSync(join(installed, 'dist', file), 'utf8') !== readFileSync(join(root, file), 'utf8')
    )
      throw new Error(`Packed ${file} differs from the reviewed source; rebuild before packing`)
  }
  const notice = readFileSync(join(installed, 'dist/NOTICE'), 'utf8')
  if (
    !notice.includes('Paste-token model translated from KiroCrew (issue #532)') ||
    !notice.includes('Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.')
  )
    throw new Error('Packed paste-token donor attribution is missing')

  const probe = `import { formatToken, findTokenRanges, expandAll, recollapsePastes, pruneBlocks, shouldCollapse, isPasteBlock } from '${entry}';
const block = { id: 'host:paste-1', seq: 1, lines: 3, content: 'one\\ntwo\\nthree' };
const token = formatToken(block);
const text = 'before ' + token + ' after';
if (!isPasteBlock(block) || !shouldCollapse(block.content)) throw Error('public model shape failed');
const ranges = findTokenRanges(text, [block]);
if (ranges.length !== 1 || ranges[0].start !== 7 || ranges[0].block !== block) throw Error('token range identity failed');
const expanded = expandAll(text, [block]);
if (expanded !== 'before ' + block.content + ' after' || recollapsePastes(expanded, [block]) !== text) throw Error('packed round trip failed');
if (pruneBlocks(text, [block, { ...block, id: 'stale', seq: 2 }]).length !== 1) throw Error('stale block pruning failed');
if (expandAll(token, [block, { ...block, id: 'ambiguous' }]) !== token || isPasteBlock({ ...block, seq: 0 })) throw Error('untrusted metadata was accepted');
console.log(JSON.stringify({ entry: import.meta.resolve('${entry}'), result: 'packed paste model passed' }));`
  writeFileSync(join(consumer, 'probe.mjs'), probe)
  const outputs = [
    JSON.parse(run('node', ['probe.mjs'])),
    JSON.parse(run('bun', ['--conditions=solid', 'probe.mjs'])),
  ]
  if (!outputs[0].entry.includes('/dist/') || !outputs[1].entry.includes('/src/'))
    throw new Error('Packed paste model export conditions were mixed')

  writeFileSync(
    join(consumer, 'probe.ts'),
    `import { type PasteBlock, formatToken, findTokenRanges, expandAll } from '${entry}';
const block: PasteBlock = { id: 'typed:1', seq: 1, lines: 3, content: 'one\\ntwo\\nthree' };
const text: string = expandAll(formatToken(block), [block]);
const ranges: Array<{ start: number; end: number; block: PasteBlock }> = findTokenRanges(text, [block]);
void ranges;`
  )
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022'],
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        types: [],
      },
      include: ['probe.ts'],
    })
  )
  run('node', [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'])
  const model = readFileSync(
    join(installed, 'dist/components/conversation/paste-tokens.js'),
    'utf8'
  )
  if (/\b(?:import\s|import\(|require\(|export\s[^;]*?\bfrom\s)/.test(model))
    throw new Error('Pure paste model retained a runtime dependency')
  const gzipBytes = gzipSync(model).length
  if (gzipBytes > 3 * 1024) throw new Error(`Pure paste model exceeds 3 KiB gzip: ${gzipBytes}`)
  console.log(
    JSON.stringify({
      result: 'packed pure paste model passed',
      outputs,
      modelJsBytes: Buffer.byteLength(model),
      modelGzipBytes: gzipBytes,
      gzipBudget: 3 * 1024,
      runtimeImports: 0,
      typedConsumer: 'passed without UI peer or ambient types',
      attribution: 'packed LICENSE and NOTICE match the reviewed source',
      limitations:
        'Pure direct subpath only; composer editing and application adoption remain separate.',
    })
  )
} finally {
  rmSync(consumer, { recursive: true, force: true })
}

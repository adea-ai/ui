/** Actual packed model subpath proof; it does not waive the separate root/license gates. */
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { installCancellationHandlers, runCommand } from './packed-layout-process.mjs'
import { sharedPackedUiArchive } from './packed-artifact.mjs'

const root = resolve(import.meta.dirname, '../../..')
const packageDirectory = join(root, 'packages/ui')
const cancellation = installCancellationHandlers()
let consumer

try {
  consumer = mkdtempSync(join(tmpdir(), 'adea-packed-layout-'))

  let archivePath = sharedPackedUiArchive()
  if (archivePath) {
    console.log(JSON.stringify({ stage: 'use verified shared UI archive', archivePath }))
  } else {
    const pack = await runCommand('npm', ['pack', '--json', '--pack-destination', consumer], {
      stage: 'npm pack local UI package',
      cwd: packageDirectory,
      timeoutMs: 120_000,
      signal: cancellation.signal,
      displayArgs: ['pack', '--json', '--pack-destination', '<consumer-temp>'],
      displayCwd: '<workspace>/packages/ui',
    })
    const [packedArtifact] = JSON.parse(pack.stdout)
    if (!packedArtifact?.filename) throw Error('npm pack did not return a tarball filename')
    archivePath = join(consumer, packedArtifact.filename)
  }

  const packageManifest = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8'))
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: {
        '@adea-ai/ui': `file:${archivePath}`,
        'solid-js': packageManifest.peerDependencies['solid-js'],
      },
    })
  )
  await runCommand('bun', ['install', '--ignore-scripts', '--omit', 'optional'], {
    stage: 'install packed UI consumer',
    cwd: consumer,
    timeoutMs: 300_000,
    signal: cancellation.signal,
    displayArgs: ['install', '--ignore-scripts', '--omit', 'optional'],
  })

  const installed = join(consumer, 'node_modules/@adea-ai/ui')
  const license = readFileSync(join(installed, 'dist/LICENSE'), 'utf8')
  const notice = readFileSync(join(installed, 'dist/NOTICE'), 'utf8')
  if (
    !license.includes('Apache License') ||
    !notice.includes('Copyright (c) 2026 Michael Yong') ||
    !notice.includes('Copyright (c) 2026 Muxy') ||
    !notice.includes('Permission is hereby granted, free of charge')
  )
    throw Error('Packed layout license or MIT attribution is missing')

  const probe = `import { createLayoutState, splitPane, splitPaneBalanced, closePane, undoClosePane, movePane, countLeaves, listLeaves } from '@adea-ai/ui/components/layout/split-layout/model';
 const first={kind:'leaf',id:'first',opaque:{fixture:true}};
 const second={kind:'leaf',id:'second',opaque:{fixture:false}};
 const state=splitPane(createLayoutState(first),'first',{direction:'row',placement:'after',leaf:second,splitId:'root'});
 const moved=movePane(state,'second','first','before','column','move');
 if(countLeaves(moved.center)!==2||listLeaves(moved.center)[0]!==second) throw Error('identity move failed');
 const restored=undoClosePane(closePane(moved,'second',()=>({kind:'leaf',id:'placeholder'})));
 if(restored.focusedLeafId!=='second'||listLeaves(restored.center)[0]!==second) throw Error('undo failed');
 let balanced=createLayoutState(first);
 for(let index=2;index<=8;index++) balanced=splitPaneBalanced(balanced,balanced.focusedLeafId,{placement:'after',leaf:{kind:'leaf',id:'balanced-'+index},splitId:'balanced-split-'+index});
 if(countLeaves(balanced.center)!==8||listLeaves(balanced.center)[0]!==first) throw Error('balanced leaf ownership failed');
 const rows=node=>node.kind==='leaf'?[[node.id]]:node.direction==='column'?[...rows(node.children[0]),...rows(node.children[1])]:[[...rows(node.children[0])[0],...rows(node.children[1])[0]]];
 if(JSON.stringify(rows(balanced.center).map(row=>row.length))!=='[4,4]') throw Error('balanced grid failed');
 console.log(JSON.stringify({entry:import.meta.resolve('@adea-ai/ui/components/layout/split-layout/model'),result:'packed model behavior passed'}));`
  writeFileSync(join(consumer, 'probe.mjs'), probe)

  const nodeProbe = await runCommand(process.execPath, ['probe.mjs'], {
    stage: 'Node import-condition model probe',
    cwd: consumer,
    timeoutMs: 30_000,
    signal: cancellation.signal,
    displayFile: 'node',
    displayArgs: ['probe.mjs'],
  })
  const bunProbe = await runCommand('bun', ['--conditions=solid', 'probe.mjs'], {
    stage: 'Bun Solid import-condition model probe',
    cwd: consumer,
    timeoutMs: 30_000,
    signal: cancellation.signal,
    displayArgs: ['--conditions=solid', 'probe.mjs'],
  })
  const outputs = [nodeProbe.stdout, bunProbe.stdout]
  const entries = outputs.map((output) => JSON.parse(output).entry)
  if (!entries[0].includes('/dist/') || !entries[1].includes('/src/'))
    throw Error('Packed model export conditions were mixed')
  const model = readFileSync(
    join(consumer, 'node_modules/@adea-ai/ui/dist/components/layout/split-layout/model.js'),
    'utf8'
  )
  const tree = readFileSync(join(installed, 'dist/components/layout/split-layout/tree.js'), 'utf8')
  // The extracted read-only tree is part of the same pure model graph. Check
  // its dependencies and charge both modules against the original byte cap.
  const dependencies = [...model.matchAll(/^(?:import|export).*?from ["']([^"']+)["']/gm)]
  const imports = [...model.matchAll(/^import\s.*$/gm)]
  if (
    dependencies.some((match) => match[1] !== './tree.js') ||
    imports.some((match) => !/from ["']\.\/tree\.js["']/.test(match[0])) ||
    /\bimport\s*\(/.test(model + tree) ||
    /^import\s/m.test(tree)
  )
    throw Error('Pure model retained a runtime dependency')
  if (/^export.*?from ["']/m.test(tree)) throw Error('Pure tree retained a transitive dependency')
  const modelGraph = model + '\n' + tree
  if (gzipSync(modelGraph).length > 3 * 1024)
    throw Error('Packed pure model exceeded its 3 KiB gzip budget')
  console.log(
    JSON.stringify({
      outputs,
      modelJsBytes: Buffer.byteLength(modelGraph),
      modelGzipBytes: gzipSync(modelGraph).length,
      runtimeImports: 0,
      internalTreeImports: imports.length,
      gzipBudget: 3 * 1024,
      attribution: 'packed Apache LICENSE and full MIT donor NOTICE retained',
      limitations:
        'Direct model subpath only; required root compatibility and app gates remain separate.',
    })
  )
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'packed-layout-gate-failure',
      stage: error.stage,
      code: error.code,
      message: error.message,
    })
  )
  process.exitCode = 1
} finally {
  if (consumer) {
    rmSync(consumer, { recursive: true, force: true })
    console.log(JSON.stringify({ event: 'packed-layout-temp-cleanup', result: 'removed' }))
  }
  cancellation.dispose()
}

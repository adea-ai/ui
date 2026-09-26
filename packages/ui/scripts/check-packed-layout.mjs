/** Actual packed model subpath proof; it does not waive the separate root/license gates. */
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
const root = resolve(import.meta.dirname, '../../..')
const consumer = mkdtempSync(join(tmpdir(), 'adea-packed-layout-'))
try {
  const [pack] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', consumer], {
      cwd: join(root, 'packages/ui'),
      encoding: 'utf8',
    })
  )
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: { '@adea-ai/ui': `file:${join(consumer, pack.filename)}` },
    })
  )
  execFileSync('bun', ['install', '--ignore-scripts', '--omit', 'peer', '--omit', 'optional'], {
    cwd: consumer,
    stdio: 'pipe',
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
  const probe = `import { createLayoutState, splitPane, closePane, undoClosePane, movePane, countLeaves, listLeaves } from '@adea-ai/ui/components/layout/split-layout/model';
 const first={kind:'leaf',id:'first',opaque:{fixture:true}};
 const second={kind:'leaf',id:'second',opaque:{fixture:false}};
 const state=splitPane(createLayoutState(first),'first',{direction:'row',placement:'after',leaf:second,splitId:'root'});
 const moved=movePane(state,'second','first','before','column','move');
 if(countLeaves(moved.center)!==2||listLeaves(moved.center)[0]!==second) throw Error('identity move failed');
 const restored=undoClosePane(closePane(moved,'second',()=>({kind:'leaf',id:'placeholder'})));
 if(restored.focusedLeafId!=='second'||listLeaves(restored.center)[0]!==second) throw Error('undo failed');
 console.log(JSON.stringify({entry:import.meta.resolve('@adea-ai/ui/components/layout/split-layout/model'),result:'packed model behavior passed'}));`
  writeFileSync(join(consumer, 'probe.mjs'), probe)
  const outputs = [
    execFileSync(process.execPath, ['probe.mjs'], { cwd: consumer, encoding: 'utf8' }),
    execFileSync('bun', ['--conditions=solid', 'probe.mjs'], { cwd: consumer, encoding: 'utf8' }),
  ]
  const entries = outputs.map((output) => JSON.parse(output).entry)
  if (!entries[0].includes('/dist/') || !entries[1].includes('/src/'))
    throw Error('Packed model export conditions were mixed')
  const model = readFileSync(
    join(consumer, 'node_modules/@adea-ai/ui/dist/components/layout/split-layout/model.js'),
    'utf8'
  )
  if (/^import\s/m.test(model)) throw Error('Pure model retained a runtime dependency')
  if (gzipSync(model).length > 3 * 1024)
    throw Error('Packed pure model exceeded its 3 KiB gzip budget')
  console.log(
    JSON.stringify({
      outputs,
      modelJsBytes: Buffer.byteLength(model),
      modelGzipBytes: gzipSync(model).length,
      imports: 0,
      gzipBudget: 3 * 1024,
      attribution: 'packed Apache LICENSE and full MIT donor NOTICE retained',
      limitations:
        'Direct model subpath only; required root compatibility and app gates remain separate.',
    })
  )
} finally {
  rmSync(consumer, { recursive: true, force: true })
}

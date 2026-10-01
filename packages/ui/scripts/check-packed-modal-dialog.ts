/** Installed-tarball type and Chromium/WebKit contract for ModalDialog settings sizing. */
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { sharedPackedUiArchive } from './packed-artifact.mjs'

const packageRoot = resolve(import.meta.dir, '..')
const root = resolve(packageRoot, '../..')
const storybookRoot = join(root, 'apps/storybook')
const consumer = mkdtempSync(join(tmpdir(), 'adea-packed-modal-dialog-'))
const active = new Set<ReturnType<typeof spawn>>()
console.log(
  JSON.stringify({ owner: 'packed-modal-dialog-check', runnerPid: process.pid, consumer })
)

async function run(
  command: string,
  args: string[],
  cwd: string,
  environment: Record<string, string> = {},
  capture = false
): Promise<string> {
  console.log(JSON.stringify({ owner: 'packed-modal-dialog-check', command, args, cwd }))
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...environment },
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  })
  active.add(child)
  console.log(JSON.stringify({ owner: 'packed-modal-dialog-check', childPid: child.pid }))
  let output = ''
  if (capture) child.stdout?.on('data', (chunk) => (output += String(chunk)))
  return await new Promise((resolveRun, reject) => {
    child.once('error', (error) => {
      active.delete(child)
      reject(error)
    })
    child.once('close', (code, signal) => {
      active.delete(child)
      console.log(
        JSON.stringify({ owner: 'packed-modal-dialog-check', settledPid: child.pid, code, signal })
      )
      if (code === 0) resolveRun(output)
      else reject(new Error(`${command} failed: ${code ?? signal}`))
    })
  })
}

try {
  const suppliedArchive = sharedPackedUiArchive()
  let archivePath = suppliedArchive
  if (!archivePath) {
    const packed = JSON.parse(
      await run('npm', ['pack', '--json', '--pack-destination', consumer], packageRoot, {}, true)
    ) as [{ filename: string }]
    const archive = packed[0]
    if (!archive) throw new Error('npm pack did not return a tarball')
    archivePath = join(consumer, archive.filename)
  }
  const archiveHash = createHash('sha256').update(readFileSync(archivePath)).digest('hex')
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
    peerDependencies: Record<string, string>
  }
  const solidVersion = manifest.peerDependencies['solid-js']
  if (!solidVersion) throw new Error('The packed package must declare SolidJS as a peer')
  const tailwindVersion = JSON.parse(
    readFileSync(join(root, 'node_modules/tailwindcss/package.json'), 'utf8')
  ).version as string

  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: {
        '@adea-ai/ui': `file:${archivePath}`,
        'solid-js': solidVersion,
        tailwindcss: tailwindVersion,
      },
    })
  )
  await run(
    'bun',
    [
      'install',
      '--ignore-scripts',
      '--omit',
      'optional',
      '--cache-dir',
      join(consumer, 'bun-cache'),
    ],
    consumer
  )

  const packageRootInConsumer = join(consumer, 'node_modules/@adea-ai/ui')
  for (const path of [
    'dist/components/ui/modal-dialog/modal-dialog.d.ts',
    'dist/components/ui/dialog/dialog.d.ts',
    'dist/components/ui/sheet/sheet.d.ts',
    'src/components/ui/modal-dialog/modal-dialog.tsx',
    'src/components/ui/dialog/dialog.tsx',
    'src/components/ui/sheet/sheet.tsx',
  ]) {
    if (!existsSync(join(packageRootInConsumer, path)))
      throw new Error(`Packed dialog contract file missing: ${path}`)
  }

  writeFileSync(
    join(consumer, 'consumer.tsx'),
    `import type { ComponentProps } from 'solid-js'
import { DialogContent } from '@adea-ai/ui/components/ui/dialog'
import { ModalDialog } from '@adea-ai/ui/components/ui/modal-dialog'
import { Sheet, SheetContent, SheetTitle, type SheetContentProps } from '@adea-ai/ui/components/ui/sheet'

const size: ComponentProps<typeof ModalDialog>['size'] = 'settings'
const positioner: ComponentProps<typeof DialogContent>['positioner'] = 'inset'
const restoreFocusRef: NonNullable<SheetContentProps['restoreFocusRef']> = () => undefined

export function PackedDialogConsumer() {
  return <>
    <ModalDialog open={false} onClose={() => undefined} title="Workspace settings" size={size} />
    <ModalDialog open={false} onClose={() => undefined} title="A short task" />
    <DialogContent positioner={positioner}>Constrained composition</DialogContent>
    <Sheet open={false} onOpenChange={() => undefined}>
      <SheetContent side="start" restoreFocusRef={restoreFocusRef}>
        <SheetTitle>Workspace navigation</SheetTitle>
      </SheetContent>
    </Sheet>
  </>
}
`
  )
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        jsx: 'preserve',
        jsxImportSource: 'solid-js',
        noEmit: true,
        skipLibCheck: true,
        lib: ['ES2022', 'DOM'],
      },
      include: ['consumer.tsx'],
    })
  )
  await run(
    join(root, 'node_modules/.bin/tsc'),
    ['--project', join(consumer, 'tsconfig.json')],
    consumer
  )

  const sourceFixture = readFileSync(join(packageRoot, 'tests/fixtures/modal-dialog.tsx'), 'utf8')
    .replace(
      '../../src/components/ui/modal-dialog/modal-dialog',
      '@adea-ai/ui/components/ui/modal-dialog'
    )
    .replace('../../src/styles/globals.css', './style.css')
  writeFileSync(join(consumer, 'modal.tsx'), sourceFixture)
  const sheetFixture = readFileSync(join(packageRoot, 'tests/fixtures/sheet-focus.tsx'), 'utf8')
    .replace(
      '../../src/components/ui/modal-dialog/modal-dialog',
      '@adea-ai/ui/components/ui/modal-dialog'
    )
    .replace('../../src/components/ui/sheet/sheet', '@adea-ai/ui/components/ui/sheet')
    .replace('../../src/styles/globals.css', './style.css')
  writeFileSync(join(consumer, 'sheet.tsx'), sheetFixture)
  writeFileSync(
    join(consumer, 'style.css'),
    [
      "@import 'tailwindcss' source(none);",
      "@import '@adea-ai/ui/theme.css';",
      "@import '@adea-ai/ui/base.css';",
      "@source './modal.tsx';",
      "@source './sheet.tsx';",
      "@source './node_modules/@adea-ai/ui/src/components/ui/{dialog,modal-dialog,sheet}';",
      "@source './node_modules/@adea-ai/ui/src/lib/overlay.ts';",
    ].join('\n')
  )

  for (const condition of ['compiled', 'solid'] as const) {
    await run(
      join(root, 'apps/storybook/node_modules/.bin/playwright'),
      [
        'test',
        '--config=playwright.components.config.ts',
        'component-modal-dialog.spec.ts',
        '--grep=settings surface',
        `--output=${join(consumer, `results-${condition}`)}`,
      ],
      storybookRoot,
      {
        ADEA_MODAL_DIALOG_PACKED_ROOT: consumer,
        ADEA_MODAL_DIALOG_PACKED_CONDITION: condition,
      }
    )
    await run(
      join(root, 'apps/storybook/node_modules/.bin/playwright'),
      [
        'test',
        '--config=playwright.components.config.ts',
        'component-sheet-focus.spec.ts',
        '--grep=stable external opener|nested (non-modal|modal) dialog',
        `--output=${join(consumer, `sheet-results-${condition}`)}`,
      ],
      storybookRoot,
      {
        ADEA_SHEET_FOCUS_PACKED_ROOT: consumer,
        ADEA_SHEET_FOCUS_PACKED_CONDITION: condition,
      }
    )
  }

  console.log(
    JSON.stringify({
      owner: 'packed-modal-dialog-check',
      result: 'passed',
      archivePath,
      archiveSha256: archiveHash,
      packageConditions: ['compiled', 'solid'],
      browsers: ['chromium', 'webkit'],
      assertions: [
        'typed size and positioner exports',
        'typed Sheet restoreFocusRef and stable external-opener restoration',
        '320/390px',
        '200% root font',
        'scroll viewport',
      ],
      retainedConsumer: false,
    })
  )
} finally {
  for (const child of active) child.kill('SIGTERM')
  rmSync(consumer, { recursive: true, force: true })
}

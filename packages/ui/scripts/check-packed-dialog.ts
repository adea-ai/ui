/** Test the dialog close-button anchor against a packed package in both exports and browsers. */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const root = resolve(import.meta.dirname, '../../..')
const uiRoot = join(root, 'packages/ui')
const storybookRoot = join(root, 'apps/storybook')
const consumer = mkdtempSync(join(tmpdir(), 'adea-packed-dialog-'))
const packageSpec = process.env['ADEA_MODAL_DIALOG_PACKAGE_SPEC']
const active = new Set<ReturnType<typeof spawn>>()

console.log(JSON.stringify({ ownedRunnerPid: process.pid, consumer, owner: 'packed-dialog-check' }))

async function run(
  command: string,
  args: string[],
  cwd: string,
  extraEnv: Record<string, string> = {},
  capture = false
): Promise<string> {
  console.log(JSON.stringify({ plannedCommand: command, args, cwd, owner: 'packed-dialog-check' }))
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, PLAYWRIGHT_HEADLESS: '1', ...extraEnv },
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  })
  active.add(child)
  console.log(JSON.stringify({ childPid: child.pid, owner: 'packed-dialog-check' }))
  let output = ''
  if (capture)
    child.stdout?.on('data', (chunk) => {
      output += String(chunk)
    })
  return new Promise((resolveRun, reject) => {
    child.once('error', (error) => {
      active.delete(child)
      reject(error)
    })
    child.once('close', (code, signal) => {
      active.delete(child)
      console.log(JSON.stringify({ settledChildPid: child.pid, code, signal }))
      if (code === 0) resolveRun(output)
      else reject(new Error(`${command} failed: ${code ?? signal}`))
    })
  })
}

const replaceImports = (source: string) =>
  source
    .replaceAll(
      '../../src/components/ui/modal-dialog/modal-dialog',
      '@adea-ai/ui/components/ui/modal-dialog'
    )
    .replaceAll('../../src/styles/globals.css', './style.css')

try {
  if (!packageSpec && !existsSync(join(uiRoot, 'dist/components/ui/modal-dialog/index.js')))
    throw new Error('Build @adea-ai/ui before checking its local packed dialog artifact')

  const packArgs = packageSpec
    ? ['pack', packageSpec, '--json', '--pack-destination', consumer]
    : ['pack', '--json', '--pack-destination', consumer]
  const [archive] = JSON.parse(await run('npm', packArgs, uiRoot, {}, true))
  const manifest = JSON.parse(readFileSync(join(uiRoot, 'package.json'), 'utf8'))
  const solidVersion = JSON.parse(
    readFileSync(join(storybookRoot, 'node_modules/solid-js/package.json'), 'utf8')
  ).version
  const tailwindVersion = JSON.parse(
    readFileSync(join(storybookRoot, 'node_modules/tailwindcss/package.json'), 'utf8')
  ).version
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: {
        '@adea-ai/ui': `file:${join(consumer, archive.filename)}`,
        '@adea-ai/themes': manifest.dependencies['@adea-ai/themes'],
        'solid-js': solidVersion,
        tailwindcss: tailwindVersion,
      },
    })
  )
  await run('bun', ['install', '--ignore-scripts'], consumer, {}, true)

  const fixture = readFileSync(join(uiRoot, 'tests/fixtures/modal-dialog.tsx'), 'utf8')
  writeFileSync(join(consumer, 'modal.tsx'), replaceImports(fixture))
  writeFileSync(
    join(consumer, 'style.css'),
    [
      "@import 'tailwindcss';",
      "@import '@adea-ai/ui/theme.css';",
      "@import '@adea-ai/ui/base.css';",
      "@source './modal.tsx';",
      "@source './node_modules/@adea-ai/ui/src/components/ui/{button,dialog,modal-dialog}';",
      "@source './node_modules/@adea-ai/ui/src/lib/{variants,overlay}.ts';",
      '',
    ].join('\n')
  )

  for (const condition of ['compiled', 'solid']) {
    await run(
      join(storybookRoot, 'node_modules/.bin/playwright'),
      [
        'test',
        '--config=playwright.components.config.ts',
        'component-modal-dialog.spec.ts',
        '--grep=default modal close',
        '--output',
        `test-results/packed-dialog-${condition}`,
      ],
      storybookRoot,
      { ADEA_MODAL_DIALOG_PACKED_ROOT: consumer, ADEA_MODAL_DIALOG_PACKED_CONDITION: condition }
    )
  }

  console.log(
    JSON.stringify({
      result: 'packed DialogContent close anchor passed',
      packageSpec: packageSpec ?? manifest.version,
      browserConditions: ['compiled', 'solid'],
      browserEngines: ['chromium', 'webkit'],
      checks: 4,
      assertion:
        'default ModalDialog close control remains panel-relative after entrance animations finish',
    })
  )
} finally {
  for (const child of active) child.kill('SIGTERM')
  rmSync(consumer, { recursive: true, force: true })
}

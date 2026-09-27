/** Install the actual tarball and exercise NativeSelect in both package conditions and browser engines. */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { sharedPackedUiArchive } from './packed-artifact.mjs'

const root = resolve(import.meta.dir, '../../..')
const uiRoot = join(root, 'packages/ui')
const consumer = mkdtempSync(join(tmpdir(), 'adea-packed-native-select-'))
const active = new Set<ReturnType<typeof spawn>>()

console.log(
  JSON.stringify({ owner: 'packed-native-select-check', runnerPid: process.pid, consumer })
)

async function run(
  command: string,
  args: string[],
  cwd: string,
  extraEnv: Record<string, string> = {},
  capture = false
): Promise<string> {
  console.log(JSON.stringify({ owner: 'packed-native-select-check', command, args, cwd }))
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  })
  active.add(child)
  console.log(JSON.stringify({ owner: 'packed-native-select-check', childPid: child.pid }))

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
        JSON.stringify({ owner: 'packed-native-select-check', settledPid: child.pid, code, signal })
      )
      if (code === 0) resolveRun(output)
      else reject(new Error(`${command} failed: ${code ?? signal}`))
    })
  })
}

const replaceImports = (source: string) =>
  source
    .replaceAll('../../src/components/ui/native-select', '@adea-ai/ui/components/ui/native-select')
    .replaceAll('../../src/styles/globals.css', './style.css')

try {
  const sharedArchive = sharedPackedUiArchive()
  let archivePath = sharedArchive
  if (!archivePath) {
    const [archive] = JSON.parse(
      await run('npm', ['pack', '--json', '--pack-destination', consumer], uiRoot, {}, true)
    )
    archivePath = join(consumer, archive.filename)
  }
  const solidVersion = JSON.parse(
    readFileSync(join(uiRoot, 'node_modules/solid-js/package.json'), 'utf8')
  ).version
  const tailwindVersion = JSON.parse(
    readFileSync(join(root, 'node_modules/tailwindcss/package.json'), 'utf8')
  ).version

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
  await run('bun', ['install', '--ignore-scripts'], consumer)

  const packedUi = join(consumer, 'node_modules/@adea-ai/ui')
  for (const name of ['LICENSE', 'NOTICE']) {
    const packed = readFileSync(join(packedUi, 'dist', name), 'utf8')
    if (packed !== readFileSync(join(root, name), 'utf8')) {
      throw new Error(`Packed ${name} differs from repository attribution`)
    }
  }
  const unusedOptionalPeers = [
    'chart.js',
    'solid-chartjs',
    'embla-carousel',
    'embla-carousel-solid',
  ].filter((name) => existsSync(join(consumer, 'node_modules', name)))
  if (unusedOptionalPeers.length) {
    throw new Error(
      `NativeSelect consumer installed optional peers: ${unusedOptionalPeers.join(', ')}`
    )
  }

  const browserFixture = readFileSync(join(uiRoot, 'tests/fixtures/native-select.tsx'), 'utf8')
  writeFileSync(join(consumer, 'main.tsx'), replaceImports(browserFixture))
  writeFileSync(
    join(consumer, 'style.css'),
    "@import 'tailwindcss';\n" +
      "@import '@adea-ai/ui/theme.css';\n" +
      "@import '@adea-ai/ui/base.css';\n" +
      "@source './main.tsx';\n" +
      "@source './node_modules/@adea-ai/ui/src/components/ui/native-select';\n"
  )

  const playwright = join(root, 'apps/storybook/node_modules/.bin/playwright')
  for (const condition of ['compiled', 'solid'] as const) {
    await run(
      playwright,
      [
        'test',
        '--config=playwright.components.config.ts',
        'component-native-select.spec.ts',
        '--output',
        `test-results/packed-native-select-${condition}`,
      ],
      join(root, 'apps/storybook'),
      {
        ADEA_NATIVE_SELECT_PACKED_ROOT: consumer,
        ADEA_NATIVE_SELECT_PACKED_CONDITION: condition,
      }
    )
  }

  console.log(
    JSON.stringify({
      result: 'packed native select passed',
      packageConditions: ['compiled', 'solid'],
      browserEngines: ['chromium', 'webkit'],
      browserTestCases: 12,
      assertionsPerBrowserCondition: 21,
      attribution: 'packed Apache LICENSE and source-specific shadcn MIT NOTICE match',
      optionalPeers: 'not installed',
    })
  )
} finally {
  for (const child of active) child.kill('SIGTERM')
  rmSync(consumer, { recursive: true, force: true })
}

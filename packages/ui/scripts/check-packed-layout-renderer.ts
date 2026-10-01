/** Actual installed tarball, reused source interactions, both browser conditions and required Solid SSR. */
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { sharedPackedUiArchive } from './packed-artifact.mjs'
const root = resolve(import.meta.dirname, '../../..')
const uiRoot = join(root, 'packages/ui')
const consumer = mkdtempSync(join(tmpdir(), 'adea-packed-layout-renderer-'))
const active = new Set<ReturnType<typeof spawn>>()
console.log(
  JSON.stringify({ ownedRunnerPid: process.pid, consumer, owner: 'packed-layout-renderer-check' })
)
async function run(
  command: string,
  args: string[],
  cwd: string,
  extraEnv: Record<string, string> = {},
  capture = false
): Promise<string> {
  console.log(
    JSON.stringify({ plannedCommand: command, args, cwd, owner: 'packed-layout-renderer-check' })
  )
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  })
  active.add(child)
  console.log(JSON.stringify({ childPid: child.pid, owner: 'packed-layout-renderer-check' }))
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
      '../../src/components/layout/split-layout/split-layout',
      '@adea-ai/ui/components/layout/split-layout'
    )
    .replaceAll(
      '../../src/components/layout/split-layout/model',
      '@adea-ai/ui/components/layout/split-layout/model'
    )
    .replaceAll(
      '../../src/components/layout/sidebar-nav/sidebar-nav-resize-handle',
      '@adea-ai/ui/components/layout/sidebar-nav'
    )
    .replaceAll(
      '../../src/components/layout/sidebar-nav/sidebar-nav',
      '@adea-ai/ui/components/layout/sidebar-nav'
    )
    .replaceAll('../../src/components/ui/button/button', '@adea-ai/ui/components/ui/button')
    .replaceAll('../../src/components/ui/dropdown-menu', '@adea-ai/ui/components/ui/dropdown-menu')
    .replaceAll('../../src/components/layout/top-bar', '@adea-ai/ui/components/layout/top-bar')
    .replaceAll(
      '../../src/components/composites/action-button',
      '@adea-ai/ui/components/composites/action-button'
    )
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
  const manifest = JSON.parse(readFileSync(join(uiRoot, 'package.json'), 'utf8'))
  const solidVersion = JSON.parse(
    readFileSync(join(uiRoot, 'node_modules/solid-js/package.json'), 'utf8')
  ).version
  const tailwindVersion = JSON.parse(
    readFileSync(join(root, 'node_modules/tailwindcss/package.json'), 'utf8')
  ).version
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'adea-packed-layout-consumer',
      private: true,
      type: 'module',
      dependencies: {
        '@adea-ai/ui': `file:${archivePath}`,
        'solid-js': solidVersion,
        tailwindcss: tailwindVersion,
        'lucide-solid': manifest.dependencies['lucide-solid'],
      },
    })
  )
  if (!manifest.exports['./components/layout/split-layout/model'])
    throw new Error('Explicit packed-model export prerequisite missing')
  await run('bun', ['install', '--ignore-scripts', '--omit', 'optional'], consumer, {}, true)
  for (const name of ['chart.js', 'solid-chartjs', 'embla-carousel', 'embla-carousel-solid'])
    if (existsSync(join(consumer, 'node_modules', name)))
      throw new Error(`Unused optional peer installed: ${name}`)
  const renderer = readFileSync(
    join(consumer, 'node_modules/@adea-ai/ui/dist/components/layout/split-layout/split-layout.js'),
    'utf8'
  )
  for (const dependency of ['solid-js', 'solid-js/web', '@corvu/resizable'])
    if (!renderer.includes(`from "${dependency}"`) && !renderer.includes(`from '${dependency}'`))
      throw new Error(`Compiled renderer did not externalize ${dependency}`)
  const license = readFileSync(join(consumer, 'node_modules/@adea-ai/ui/dist/LICENSE'), 'utf8')
  const notice = readFileSync(join(consumer, 'node_modules/@adea-ai/ui/dist/NOTICE'), 'utf8')
  for (const text of [
    'Copyright (c) 2026 Michael Yong',
    'Copyright (c) 2026 Muxy',
    'Permission is hereby granted, free of charge',
    'Binary frame renderer continuation',
    'pane-drag continuation',
  ])
    if (!notice.includes(text)) throw new Error(`Packed NOTICE lost ${text}`)
  if (!license.includes('Apache License')) throw new Error('Packed Apache LICENSE missing')
  for (const [name, fixture] of [
    ['main.tsx', 'split-layout.tsx'],
    ['server.tsx', 'split-layout-ssr.tsx'],
    ['sidebar.tsx', 'sidebar-nav.tsx'],
    ['topbar.tsx', 'top-bar.tsx'],
  ] as const)
    writeFileSync(
      join(consumer, name),
      replaceImports(readFileSync(join(uiRoot, 'tests/fixtures', fixture), 'utf8')).replaceAll(
        './style.css',
        name === 'sidebar.tsx'
          ? './sidebar-style.css'
          : name === 'topbar.tsx'
            ? './topbar-style.css'
            : './style.css'
      )
    )
  // The renderer's only shared Button is ghost/icon-xs. Discover its complete
  // class contract from the actual installed public helper, including base and
  // tactile classes, without emitting unrelated Button variants. Browser cases
  // require the real close control's square geometry and keyboard focus ring.
  const closeButtonClasses = JSON.parse(
    await run(
      'node',
      [
        '--input-type=module',
        '-e',
        "import { buttonVariants } from '@adea-ai/ui/components/ui/button'; console.log(JSON.stringify(buttonVariants({variant:'ghost',size:'icon-xs'})))",
      ],
      consumer,
      {},
      true
    )
  ) as string
  writeFileSync(
    join(consumer, 'topbar-style.css'),
    "@import 'tailwindcss' source(none);\n@import '@adea-ai/ui/theme.css';\n@import '@adea-ai/ui/base.css';\n" +
      "@source './topbar.tsx';\n@source './node_modules/@adea-ai/ui/src/components/layout/top-bar';\n@source './node_modules/@adea-ai/ui/src/components/composites/action-button';\n@source './node_modules/@adea-ai/ui/src/components/ui/button';\n@source './node_modules/@adea-ai/ui/src/components/ui/tooltip';\n"
  )
  writeFileSync(
    join(consumer, 'style.css'),
    "@import 'tailwindcss' source(none);\n@import '@adea-ai/ui/theme.css';\n@import '@adea-ai/ui/base.css';\n@source './main.tsx';\n@source './node_modules/@adea-ai/ui/src/components/layout/split-layout/split-layout.tsx';\n" +
      `@source inline(${JSON.stringify(closeButtonClasses)});\n`
  )
  writeFileSync(
    join(consumer, 'sidebar-style.css'),
    "@import 'tailwindcss' source(none);\n@import '@adea-ai/ui/theme.css';\n@import '@adea-ai/ui/base.css';\n" +
      "@source './sidebar.tsx';\n@source './node_modules/@adea-ai/ui/src/components/layout/sidebar-nav';\n@source './node_modules/@adea-ai/ui/src/components/ui/button';\n@source './node_modules/@adea-ai/ui/src/components/ui/collapsible';\n"
  )
  for (const condition of ['compiled', 'solid']) {
    await run(
      join(root, 'apps/storybook/node_modules/.bin/playwright'),
      [
        'test',
        '--config=playwright.layout.config.ts',
        'component-split-layout.spec.ts',
        '--output',
        `test-results/packed-layout-${condition}`,
      ],
      join(root, 'apps/storybook'),
      { ADEA_LAYOUT_PACKED_ROOT: consumer, ADEA_LAYOUT_PACKED_CONDITION: condition }
    )
    await run(
      join(root, 'apps/storybook/node_modules/.bin/playwright'),
      [
        'test',
        '--config=playwright.components.config.ts',
        'component-sidebar-nav.spec.ts',
        '--output',
        `test-results/packed-sidebar-${condition}`,
      ],
      join(root, 'apps/storybook'),
      { ADEA_SIDEBAR_PACKED_ROOT: consumer, ADEA_SIDEBAR_PACKED_CONDITION: condition }
    )
    await run(
      join(root, 'apps/storybook/node_modules/.bin/playwright'),
      [
        'test',
        '--config=playwright.components.config.ts',
        'component-top-bar.spec.ts',
        '--output',
        `test-results/packed-topbar-${condition}`,
      ],
      join(root, 'apps/storybook'),
      { ADEA_TOPBAR_PACKED_ROOT: consumer, ADEA_TOPBAR_PACKED_CONDITION: condition }
    )
  }
  console.log(
    JSON.stringify({
      result: 'packed renderer passed',
      browserConditions: ['compiled', 'solid'],
      serverCondition: 'Solid source SSR -> native Node',
      browserEngines: ['chromium', 'webkit'],
      checks: 76,
      sidebarBrowserCases: 36,
      topbarBrowserCases: 4,
      attribution: 'Apache LICENSE and full donor MIT NOTICE',
      limitations:
        'Selected binary renderer; full shell, required root compatibility, app migrations and native/manual AT remain separate.',
    })
  )
} finally {
  for (const child of active) child.kill('SIGTERM')
  rmSync(consumer, { recursive: true, force: true })
}

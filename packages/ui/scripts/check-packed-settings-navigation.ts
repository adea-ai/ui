/** Install the npm artifact and check SettingsNavigation under both public conditions and engines. */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dir, '../../..')
const consumer = mkdtempSync(join(tmpdir(), 'adea-packed-settings-navigation-'))

try {
  const [archive] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', consumer], {
      cwd: join(root, 'packages/ui'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    })
  ) as [{ filename: string }]
  const manifest = JSON.parse(readFileSync(join(root, 'packages/ui/package.json'), 'utf8')) as {
    dependencies: Record<string, string>
    peerDependencies: Record<string, string>
  }
  const tailwindVersion = JSON.parse(
    readFileSync(join(root, 'node_modules/tailwindcss/package.json'), 'utf8')
  ) as { version: string }

  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'adea-packed-settings-navigation-consumer',
      private: true,
      type: 'module',
      dependencies: {
        '@adea-ai/ui': `file:${join(consumer, archive.filename)}`,
        'lucide-solid': manifest.dependencies['lucide-solid'],
        'solid-js': manifest.peerDependencies['solid-js'],
        tailwindcss: tailwindVersion.version,
      },
    })
  )
  execFileSync('bun', ['install', '--ignore-scripts', '--omit=optional'], {
    cwd: consumer,
    stdio: 'inherit',
    timeout: 120_000,
  })

  const fixture = readFileSync(
    join(root, 'packages/ui/tests/fixtures/settings-navigation.tsx'),
    'utf8'
  )
  const packageFixture = fixture
    .replace('../../src/components/ui/button/button', '@adea-ai/ui/components/ui/button')
    .replace('../../src/components/ui/tabs/tabs', '@adea-ai/ui/components/ui/tabs')
    .replace(
      '../../src/components/composites/settings',
      '@adea-ai/ui/components/composites/settings'
    )
    .replace('../../src/styles/globals.css', './style.css')
  writeFileSync(join(consumer, 'main.tsx'), packageFixture)
  writeFileSync(
    join(consumer, 'type-probe.tsx'),
    `import { createSignal } from 'solid-js'
import { SettingsLayout, type SettingsNavigationGroup } from '@adea-ai/ui/components/composites/settings'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@adea-ai/ui/components/ui/tabs'

const groups: readonly SettingsNavigationGroup[] = [{
  label: 'Workspace',
  items: [{ value: 'account', label: 'Account' }],
}]

export function PackedSettingsConsumer() {
  const [value, setValue] = createSignal('account')
  return (
    <SettingsLayout
      id="packed-settings"
      aria-label="Settings sections"
      groups={groups}
      value={value()}
      onChange={setValue}
      onReselect={(next) => setValue(next)}
    >
      <TabsContent id="account-panel" value="account" />
    </SettingsLayout>
  )
}

export function PackedCustomTabsConsumer() {
  const [value, setValue] = createSignal('account')
  return (
    <Tabs id="custom-tabs" orientation="vertical" value={value()} onChange={setValue}>
      <TabsList aria-label="Custom settings sections">
        <TabsTrigger id="custom-account-trigger" value="account">Account</TabsTrigger>
      </TabsList>
      <TabsContent
        id="custom-account-panel"
        aria-labelledby="custom-account-trigger"
        value="account"
      />
    </Tabs>
  )
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
        noEmit: true,
        jsx: 'preserve',
        jsxImportSource: 'solid-js',
        skipLibCheck: true,
        lib: ['ES2022', 'DOM'],
      },
      include: ['type-probe.tsx'],
    })
  )
  execFileSync(resolve(root, 'node_modules/.bin/tsc'), ['-p', join(consumer, 'tsconfig.json')], {
    cwd: consumer,
    stdio: 'inherit',
    timeout: 120_000,
  })

  writeFileSync(
    join(consumer, 'style.css'),
    [
      "@import 'tailwindcss';",
      "@import '@adea-ai/ui/theme.css';",
      "@import '@adea-ai/ui/base.css';",
      "@source './main.tsx';",
      "@source './node_modules/@adea-ai/ui/src/components/composites/settings';",
      "@source './node_modules/@adea-ai/ui/src/components/layout/sidebar-nav';",
      "@source './node_modules/@adea-ai/ui/src/components/ui/button';",
      "@source './node_modules/@adea-ai/ui/src/components/ui/tabs';",
      "@source './node_modules/@adea-ai/ui/dist/components/composites/settings';",
      "@source './node_modules/@adea-ai/ui/dist/components/layout/sidebar-nav';",
      "@source './node_modules/@adea-ai/ui/dist/components/ui/button';",
      "@source './node_modules/@adea-ai/ui/dist/components/ui/tabs';",
    ].join('\n')
  )

  const storybook = join(root, 'apps/storybook')
  for (const condition of ['compiled', 'solid'] as const) {
    execFileSync(
      'bun',
      [
        'run',
        '--cwd',
        storybook,
        'test:components',
        '--',
        'tests/component-settings-navigation.spec.ts',
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          ADEA_SETTINGS_NAV_PACKED_ROOT: consumer,
          ADEA_SETTINGS_NAV_PACKED_CONDITION: condition,
        },
        stdio: 'inherit',
        timeout: 180_000,
      }
    )
  }

  const installed = join(consumer, 'node_modules/@adea-ai/ui')
  for (const path of [
    'dist/components/composites/settings/index.js',
    'dist/components/composites/settings/index.d.ts',
    'dist/components/composites/settings/settings-navigation.js',
    'src/components/composites/settings/index.ts',
    'src/components/composites/settings/settings-navigation.tsx',
  ]) {
    if (!existsSync(join(installed, path))) throw new Error(`Packed entry missing: ${path}`)
  }
  console.log(
    JSON.stringify({
      result: 'packed SettingsNavigation passed',
      conditions: ['compiled', 'solid'],
      engines: ['chromium', 'webkit'],
      nativeTypes: 'passed',
      optionalPeers: 'not installed',
    })
  )
} finally {
  rmSync(consumer, { recursive: true, force: true })
}

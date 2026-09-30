import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const consumer = mkdtempSync(join(tmpdir(), 'adea-packed-floating-preview-'))
console.log(
  JSON.stringify({ ownerPid: process.pid, consumer, owner: 'packed-floating-preview-check' })
)
try {
  const [packed] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', consumer], {
      cwd: root,
      encoding: 'utf8',
    })
  ) as { filename: string }[]
  if (!packed?.filename) throw new Error('npm pack did not return an artifact filename')
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    peerDependencies: Record<string, string>
  }
  const workspaceManifest = JSON.parse(
    readFileSync(resolve(root, '../..', 'package.json'), 'utf8')
  ) as {
    devDependencies: Record<string, string>
  }
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: {
        '@adea-ai/ui': `file:${join(consumer, packed.filename)}`,
        'solid-js': manifest.peerDependencies['solid-js'],
        tailwindcss: workspaceManifest.devDependencies['tailwindcss'],
      },
    })
  )
  execFileSync('bun', ['install', '--ignore-scripts', '--omit', 'optional'], {
    cwd: consumer,
    stdio: 'inherit',
  })
  const fixture = readFileSync(join(root, 'tests/fixtures/floating-preview.tsx'), 'utf8')
    .replace('../../src/components/ui/button', '@adea-ai/ui/components/ui/button')
    .replace(
      '../../src/components/layout/floating-preview',
      '@adea-ai/ui/components/layout/floating-preview'
    )
    .replace('../../src/styles/globals.css', './style.css')
  writeFileSync(join(consumer, 'main.tsx'), fixture)
  writeFileSync(
    join(consumer, 'style.css'),
    [
      "@import 'tailwindcss' source(none);",
      "@import '@adea-ai/ui/theme.css';",
      "@import '@adea-ai/ui/base.css';",
      "@source './main.tsx';",
      "@source './node_modules/@adea-ai/ui/src';",
    ].join('\n')
  )
  const playwright = resolve(root, '../../apps/storybook/node_modules/.bin/playwright')
  for (const condition of ['compiled', 'solid']) {
    execFileSync(
      playwright,
      [
        'test',
        '--config=playwright.layout.config.ts',
        'component-split-layout.spec.ts',
        '--grep',
        'floating preview',
      ],
      {
        cwd: resolve(root, '../../apps/storybook'),
        env: {
          ...process.env,
          ADEA_FLOATING_PACKED_ROOT: consumer,
          ADEA_FLOATING_PACKED_CONDITION: condition,
        },
        stdio: 'inherit',
      }
    )
  }
} finally {
  rmSync(consumer, { recursive: true, force: true })
}

/** Run the real Oxlint canaries against the archive's public lint export. */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { sharedPackedUiArchive } from './packed-artifact.mjs'

const packageRoot = resolve(import.meta.dirname, '..')
const workspaceRoot = resolve(packageRoot, '../..')
const consumer = mkdtempSync(join(tmpdir(), 'adea-packed-lint-'))

try {
  const sharedArchive = sharedPackedUiArchive()
  if (!sharedArchive && !existsSync(join(packageRoot, 'dist/lint.js')))
    throw new Error('Packed lint check requires a library build; run bun run build first')
  const archive =
    sharedArchive ??
    join(
      consumer,
      JSON.parse(
        execFileSync('npm', ['pack', '--json', '--pack-destination', consumer], {
          cwd: packageRoot,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'inherit'],
        })
      )[0].filename
    )
  execFileSync('tar', ['-xzf', archive, '-C', consumer])
  const installed = join(consumer, 'package')
  const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'))
  const entry = manifest.exports?.['./lint']?.default
  if (manifest.name !== '@adea-ai/ui' || typeof entry !== 'string')
    throw new Error('Packed UI archive lacks its public lint export')
  const plugin = resolve(installed, entry)
  if (!plugin.startsWith(installed + sep) || !existsSync(plugin))
    throw new Error('Packed lint export must resolve to a file inside the archive')
  execFileSync('bun', ['test', '--conditions=browser', 'packages/ui/tests/lint-plugin.test.ts'], {
    cwd: workspaceRoot,
    env: { ...process.env, ADEA_UI_LINT_PLUGIN: plugin },
    stdio: 'inherit',
  })
  console.log('packed lint: all real Oxlint canaries passed against ' + entry)
} finally {
  rmSync(consumer, { recursive: true, force: true })
}

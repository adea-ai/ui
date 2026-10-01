import { build } from 'cn/build'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cnTablesHeader } from './cn-tables-header'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tempDir = mkdtempSync(join(tmpdir(), 'adea-ui-cn-tables-check-'))

try {
  const outputPath = join(tempDir, 'cn-tables.generated.ts')
  const result = await build({
    cwd: packageRoot,
    config: 'cn.config.ts',
    out: outputPath,
    full: true,
    css: false,
  })

  if (result.usedGroups !== null || result.totalGroups !== null || result.scannedFiles !== 0)
    throw new Error('The cn table check must compile the full config without source scanning')

  const checkedInSource = readFileSync(
    resolve(packageRoot, 'src/lib/cn-tables.generated.ts'),
    'utf8'
  )
  if (`${cnTablesHeader}${result.source}` !== checkedInSource)
    throw new Error('Generated cn tables are stale; run `bun run --cwd packages/ui cn:build`')

  console.log(
    `Verified full cn tables (${Object.keys(result.fullConfig.classGroups).length} class groups)`
  )
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}

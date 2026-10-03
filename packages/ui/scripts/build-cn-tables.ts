import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { build } from 'cn/build'
import { cnTablesHeader } from './cn-tables-header'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(packageRoot, 'src/lib/cn-tables.generated.ts')
const tempDir = mkdtempSync(join(tmpdir(), 'adea-ui-cn-tables-build-'))

try {
  const result = await build({
    cwd: packageRoot,
    config: 'cn.config.ts',
    out: join(tempDir, 'cn-tables.generated.ts'),
    full: true,
    css: false,
  })

  if (result.usedGroups !== null || result.totalGroups !== null || result.scannedFiles !== 0)
    throw new Error(
      'Design-system class merger must compile the full config without source scanning'
    )

  // The design-system utilities live inside Tailwind's own groups (see
  // cn.config.ts), so the guard is that those groups actually carry them.
  for (const [group, token] of [
    ['h', 'control-sm'],
    ['w', 'rail'],
    ['size', 'control-sm'],
  ] as const) {
    if (!JSON.stringify(result.fullConfig.classGroups[group] ?? []).includes(`"${token}"`))
      throw new Error(`Generated cn config is missing ${group}-${token} in group ${group}`)
  }
  if (!JSON.stringify(result.fullConfig.theme['spacing'] ?? []).includes('"control-sm"'))
    throw new Error('Generated cn config is missing the control rungs on the spacing scale')

  const generatedSource = `${cnTablesHeader}${result.source}`
  let previousSource: string | null = null
  try {
    previousSource = readFileSync(outputPath, 'utf8')
  } catch {
    // The first generation has no checked-in output yet.
  }
  const changed = previousSource !== generatedSource
  if (changed) writeFileSync(outputPath, generatedSource)

  const sourceBytes = Buffer.byteLength(generatedSource)
  const gzipBytes = gzipSync(generatedSource).byteLength
  console.log(
    `Generated full cn tables (${Object.keys(result.fullConfig.classGroups).length} class groups, ${sourceBytes} source bytes, ${gzipBytes} gzip bytes, changed=${changed})`
  )
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}

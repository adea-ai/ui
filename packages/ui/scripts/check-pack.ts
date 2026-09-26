/**
 * The tarball gate.
 *
 * `npm publish` is irreversible and `dist/` is gitignored, so a mistake here is
 * not caught by a reviewer reading a diff — it is caught by whoever installs
 * the package next. This asserts the three things that have actually broken:
 *
 *   1. `dist/` is in the archive. The `exports` map serves `./dist/index.js` and
 *      `./dist/index.d.ts`; without them the package installs and then fails to
 *      resolve its own entry point. Nothing in the package enforces this,
 *      because `dist/` is built output rather than source.
 *   2. Every entry point the `exports` map names is present. A typo in `exports`
 *      is invisible until resolution fails at runtime, in someone else's app.
 *   3. No story, MDX or test source ships. Those are the review surface, not
 *      consumer source, and `registry.test.ts` already holds the same line for
 *      the registry payloads.
 *
 * It reads `npm pack --dry-run --json` rather than walking the filesystem, so it
 * measures the archive npm would actually upload — including the `files` globs
 * and `.npmignore` rules, which is where a leak actually happens.
 *
 * Run `bun run --cwd packages/ui build` first. This does not build, because a
 * check that silently builds is a check that hides a broken build.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const packageRoot = resolve(import.meta.dir, '..')
const manifest: {
  files?: string[]
  exports: Record<string, string | Record<string, string>>
  name: string
  version: string
  private?: boolean
} = await Bun.file(resolve(packageRoot, 'package.json')).json()

if (!existsSync(resolve(packageRoot, 'dist'))) {
  console.error('pack:check — dist/ is absent. Run `bun run build` first.')
  process.exit(1)
}

const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], {
  cwd: packageRoot,
  encoding: 'utf8',
  // npm writes its own summary to stderr; only stdout is the report.
  stdio: ['ignore', 'pipe', 'ignore'],
})

const [archive] = JSON.parse(raw)
const files: string[] = archive.files.map((file: { path: string }) => file.path)
const failures: string[] = []

/** The paths a consumer's bundler resolves before any code runs. */
const entryPoints = [
  'dist/index.js',
  'dist/index.d.ts',
  'src/index.ts',
  'package.json',
  'dist/NOTICE',
  'dist/LICENSE',
  ...(manifest.files ?? []).filter((entry: string) => entry.endsWith('.css')),
]

// Expand the public conditions against source files, not against whatever the
// build happened to emit. A missing component entry must fail rather than vanish
// from the set being checked.
const sourceFiles = readdirSync(resolve(packageRoot, 'src'), { recursive: true })
  .map(String)
  .filter((file) => !/\.(stories|test)\.|\.mdx$/.test(file))
const componentEntries = sourceFiles.filter(
  (file) => file.startsWith('components/') && file.endsWith('/index.ts')
)
for (const source of componentEntries) {
  const component = source.slice('components/'.length, -'/index.ts'.length)
  const conditions = manifest.exports['./components/*']
  if (!conditions || typeof conditions === 'string')
    throw new Error('Missing component export conditions')
  for (const target of Object.values(conditions) as string[]) {
    entryPoints.push(target.replace('./', '').replace('*', component))
  }
}
for (const source of sourceFiles.filter(
  (file) => file.startsWith('lib/') && file.endsWith('.ts')
)) {
  const lib = source.slice('lib/'.length, -'.ts'.length)
  const conditions = manifest.exports['./lib/*']
  if (!conditions || typeof conditions === 'string')
    throw new Error('Missing library export conditions')
  for (const target of Object.values(conditions)) {
    entryPoints.push(target.replace('./', '').replace('*', lib))
  }
}
for (const [specifier, entry] of Object.entries(manifest.exports)) {
  if (specifier.includes('*')) continue
  for (const target of typeof entry === 'string' ? [entry] : Object.values(entry)) {
    if (typeof target === 'string') entryPoints.push(target.replace('./', ''))
  }
}

for (const entry of entryPoints) {
  if (!files.includes(entry)) failures.push(`entry point missing from the tarball: ${entry}`)
}

const leaked = files.filter((file) => /\.(stories|test)\.|\.mdx$/.test(file))
if (leaked.length > 0) {
  failures.push(
    `review surface shipped to consumers: ${leaked.slice(0, 8).join(', ')}${
      leaked.length > 8 ? ` (+${leaked.length - 8} more)` : ''
    }`
  )
}

if (manifest.private === true) failures.push('the manifest is private, so `npm publish` would fail')

if (failures.length > 0) {
  console.error(
    `pack:check — ${failures.length} problem(s) with ${manifest.name}@${manifest.version}:`
  )
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(
  `pack:check — ${manifest.name}@${manifest.version} is publishable: ${files.length} files, ${entryPoints.length} entry points verified.`
)

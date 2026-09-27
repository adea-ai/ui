import { appendFileSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const fullCoverage = () => ({
  registry: true,
  workshop: true,
  components: true,
  pages: true,
  pagesBuild: true,
})
const validImmutableRef = (ref) => /^[a-f0-9]{40}$/.test(ref ?? '') && ref !== '0'.repeat(40)
const pageOnlyPaths = new Set([
  'apps/storybook/.storybook/manager.ts',
  '.github/workflows/registry-pages.yml',
  '.github/scripts/registry-pages.mjs',
  '.github/scripts/registry-pages.test.ts',
])
const versionOnlyReleasePaths = new Set([
  'package.json',
  'packages/ui/package.json',
  '.release-please-manifest.json',
  'CHANGELOG.md',
])
const packageMetadataPaths = ['package.json', 'packages/ui/package.json']
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function readJsonAtRef(ref, path) {
  const content = execFileSync('git', ['show', `${ref}:${path}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  return JSON.parse(content)
}

function onlyPackageVersionChanged(before, after) {
  if (
    !before ||
    !after ||
    typeof before !== 'object' ||
    Array.isArray(before) ||
    typeof after !== 'object' ||
    Array.isArray(after) ||
    !versionPattern.test(before.version ?? '') ||
    !versionPattern.test(after.version ?? '') ||
    before.version === after.version
  ) {
    return false
  }
  const { version: _beforeVersion, ...beforeFields } = before
  const { version: _afterVersion, ...afterFields } = after
  return stableJson(beforeFields) === stableJson(afterFields)
}

function isVersionOnlyReleaseMetadata(paths, base, head) {
  const pathSet = new Set(paths)
  if (
    paths.length !== versionOnlyReleasePaths.size ||
    pathSet.size !== versionOnlyReleasePaths.size ||
    [...versionOnlyReleasePaths].some((path) => !pathSet.has(path))
  ) {
    return false
  }

  try {
    const packageVersions = packageMetadataPaths.map((path) => [
      readJsonAtRef(base, path),
      readJsonAtRef(head, path),
    ])
    if (!packageVersions.every(([before, after]) => onlyPackageVersionChanged(before, after))) {
      return false
    }

    const [beforeRoot, afterRoot] = packageVersions[0]
    const [beforeUi, afterUi] = packageVersions[1]
    const beforeManifest = readJsonAtRef(base, '.release-please-manifest.json')
    const afterManifest = readJsonAtRef(head, '.release-please-manifest.json')
    return (
      beforeRoot.version === beforeUi.version &&
      afterRoot.version === afterUi.version &&
      beforeRoot.version !== afterRoot.version &&
      beforeManifest &&
      typeof beforeManifest === 'object' &&
      !Array.isArray(beforeManifest) &&
      Object.keys(beforeManifest).length === 1 &&
      beforeManifest['.'] === beforeRoot.version &&
      afterManifest &&
      typeof afterManifest === 'object' &&
      !Array.isArray(afterManifest) &&
      Object.keys(afterManifest).length === 1 &&
      afterManifest['.'] === afterRoot.version
    )
  } catch {
    return false
  }
}

/** Conservative impact map. Unknown inputs retain every gate. */
export function classifyDesignSystemChanges(paths) {
  const result = {
    registry: false,
    workshop: false,
    components: false,
    pages: false,
    pagesBuild: false,
  }
  for (const path of paths) {
    if (pageOnlyPaths.has(path)) {
      result.pages = true
      result.pagesBuild = true
    } else if (/^(?:LICENSE|NOTICE)(?:\.|$)/.test(path)) {
      result.registry = true
    } else if (path === 'packages/ui/registry.json' || path.startsWith('packages/ui/public/r/')) {
      result.registry = true
      result.pages = true
    } else if (path.startsWith('packages/ui/') && path.endsWith('.md')) {
      result.registry = true
    } else if (path.endsWith('.md') && !path.startsWith('packages/ui/')) {
      // Markdown documentation is not part of the Storybook source glob (MDX is).
      continue
    } else if (
      path.startsWith('apps/storybook/tests/component-') ||
      path === 'apps/storybook/playwright.components.config.ts' ||
      path === 'apps/storybook/playwright.layout.config.ts'
    ) {
      result.components = true
    } else if (
      [
        'apps/storybook/tests/a11y.spec.ts',
        'apps/storybook/tests/interactions.spec.ts',
        'apps/storybook/tests/stories.ts',
        'apps/storybook/tests/story-readiness.spec.ts',
        'apps/storybook/playwright.config.ts',
      ].includes(path)
    ) {
      result.workshop = true
    } else if (path.startsWith('apps/storybook/')) {
      result.workshop = true
      result.components = true
      result.pages = true
    } else if (path.startsWith('packages/ui/public/') || path.startsWith('packages/ui/scripts/')) {
      result.registry = true
    } else {
      // Includes component/token source, dependency/toolchain configuration,
      // this workflow/filter, and new paths we have not classified yet.
      return fullCoverage()
    }
  }
  return result
}

if (import.meta.main) {
  let result = fullCoverage()
  try {
    const eventName = process.env['GITHUB_EVENT_NAME']
    if (eventName === 'pull_request' || eventName === 'push') {
      const event = JSON.parse(readFileSync(process.env['GITHUB_EVENT_PATH'], 'utf8'))
      const base = eventName === 'pull_request' ? event.pull_request?.base?.sha : event.before
      const head = eventName === 'pull_request' ? event.pull_request?.head?.sha : event.after
      if (!validImmutableRef(base) || !validImmutableRef(head))
        throw new Error('Missing immutable diff refs')
      // PRs compare their branch to the merge base. Pushes compare the actual
      // before/after trees so every commit in a batched push contributes paths.
      const range = eventName === 'pull_request' ? [`${base}...${head}`] : [base, head]
      const paths = execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', ...range], {
        encoding: 'utf8',
      })
        .split('\0')
        .filter(Boolean)
      const comparisonBase =
        eventName === 'pull_request'
          ? execFileSync('git', ['merge-base', base, head], { encoding: 'utf8' }).trim()
          : base
      result = isVersionOnlyReleaseMetadata(paths, comparisonBase, head)
        ? { registry: true, workshop: false, components: false, pages: false, pagesBuild: false }
        : classifyDesignSystemChanges(paths)
    }
  } catch {
    console.warn('::warning::Change filtering unavailable; retaining all design-system gates.')
  }
  const outputs =
    Object.entries(result)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n'
  appendFileSync(process.env['GITHUB_OUTPUT'], outputs)
  console.log(JSON.stringify(result))
}

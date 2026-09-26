import { appendFileSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const fullCoverage = () => ({ registry: true, workshop: true, components: true })

/** Conservative PR impact map. Unknown inputs retain every gate; main is always full. */
export function classifyDesignSystemChanges(paths) {
  const result = { registry: false, workshop: false, components: false }
  for (const path of paths) {
    if (
      /^(?:LICENSE|NOTICE)(?:\.|$)/.test(path) ||
      path === 'packages/ui/registry.json' ||
      path.startsWith('packages/ui/public/r/')
    ) {
      result.registry = true
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
    if (process.env['GITHUB_EVENT_NAME'] === 'pull_request') {
      const event = JSON.parse(readFileSync(process.env['GITHUB_EVENT_PATH'], 'utf8'))
      const base = event.pull_request?.base?.sha
      const head = event.pull_request?.head?.sha
      if (!/^[a-f0-9]{40}$/.test(base ?? '') || !/^[a-f0-9]{40}$/.test(head ?? ''))
        throw new Error('Missing immutable PR refs')
      const paths = execFileSync(
        'git',
        ['diff', '--no-renames', '--name-only', '-z', `${base}...${head}`],
        {
          encoding: 'utf8',
        }
      )
        .split('\0')
        .filter(Boolean)
      result = classifyDesignSystemChanges(paths)
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

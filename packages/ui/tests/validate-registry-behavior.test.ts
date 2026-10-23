import { expect, test } from 'bun:test'
import { registryItems } from '../scripts/registry-core'
import { validateRegistry } from '../scripts/validate-registry'

type RegistryItem = (typeof registryItems)[number]

function withInvalidLib(change: (item: RegistryItem) => void, check: (findings: string[]) => void) {
  const item = registryItems.find((candidate) => candidate.name === 'lib')
  if (!item) throw new Error('the registry fixture needs the existing lib item')
  // Replace arrays rather than mutating their contents. The validator reads the
  // real derived catalogue, and every original reference is restored even when
  // a diagnostic assertion fails. No committed source or served bytes change.
  const original = { ...item }
  try {
    change(item)
    check(validateRegistry())
  } finally {
    Object.assign(item, original)
  }
}

test('registry validation refuses colliding install targets outside the consumer directories', () => {
  const target = '../outside-consumer.ts'
  withInvalidLib(
    (item) => {
      const source = item.files[0]
      if (!source) throw new Error('the lib fixture needs an existing source file')
      item.files = [
        { ...source, target },
        { ...source, target },
      ]
    },
    (findings) => {
      expect(findings).toContain(
        `lib: target "${target}" is outside components/, styles/ or lib/, so the shadcn CLI will refuse it.`
      )
      expect(
        findings.some(
          (finding) =>
            finding.startsWith(`lib: target "${target}" is also assigned to lib/`) &&
            finding.endsWith('install targets must be unique.')
        )
      ).toBe(true)
    }
  )
})

test('registry validation names undeclared versioned packages and invalid peer item references', () => {
  withInvalidLib(
    (item) => {
      item.dependencies = [
        ...item.dependencies,
        'adea-registry-fixture-missing@1.2.3',
        '@adea-registry-fixture/missing@2.0.0',
      ]
      item.registryDependencies = [
        ...item.registryDependencies,
        'lib',
        '@adea-ai/ui/fixture-missing',
      ]
    },
    (findings) => {
      expect(findings).toContain(
        'lib: depends on "adea-registry-fixture-missing", which is not in dependencies or peerDependencies of packages/ui/package.json.'
      )
      expect(findings).toContain(
        'lib: depends on "@adea-registry-fixture/missing", which is not in dependencies or peerDependencies of packages/ui/package.json.'
      )
      expect(findings).toContain('lib: depends on itself.')
      expect(findings).toContain(
        'lib: registry dependency "@adea-ai/ui/fixture-missing" is not an item.'
      )
    }
  )
})

import { resolve } from 'node:path'

const storybookRoot = resolve(import.meta.dirname, '..')
const playwright = resolve(storybookRoot, 'node_modules/.bin/playwright')
const shards = ['1/6', '2/6', '3/6', '4/6', '5/6', '6/6']

function collectInstances(suite, instances = []) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const project = test.projectName ?? test.projectId
      if (typeof project !== 'string' || !project) {
        throw new Error(`Component test has no Playwright project: ${spec.file}:${spec.line}`)
      }
      instances.push(`${project}\0${spec.file}\0${spec.line}\0${spec.title}`)
    }
  }
  for (const child of suite.suites ?? []) collectInstances(child, instances)
  return instances
}

function listTests(shard) {
  const args = [
    'test',
    '--config=playwright.components.config.ts',
    '--list',
    '--reporter=json',
    ...(shard ? [`--shard=${shard}`] : []),
  ]
  const result = Bun.spawnSync([playwright, ...args], {
    cwd: storybookRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stderr = new TextDecoder().decode(result.stderr).trim()
  if (result.exitCode !== 0) {
    throw new Error(
      `Playwright test collection failed${shard ? ` for shard ${shard}` : ''} (${result.exitCode}): ${stderr}`
    )
  }
  const stdout = new TextDecoder().decode(result.stdout)
  try {
    return JSON.parse(stdout)
  } catch {
    throw new Error(
      `Playwright did not return JSON test collection${shard ? ` for shard ${shard}` : ''}: ${stdout.slice(0, 400)}`
    )
  }
}

function uniqueInstances(report, shard) {
  const instances = collectInstances({ suites: report.suites ?? [] })
  if (instances.length === 0) {
    throw new Error(`Playwright collected no component tests${shard ? ` for shard ${shard}` : ''}.`)
  }
  if (new Set(instances).size !== instances.length) {
    throw new Error(
      `Playwright collected duplicate component test instances${shard ? ` for shard ${shard}` : ''}.`
    )
  }
  return instances
}

const completeReport = listTests()
const expectedProjects = (completeReport.config?.projects ?? [])
  .map((project) => project.name)
  .toSorted()
if (expectedProjects.join(',') !== 'chromium,webkit') {
  throw new Error(
    `Component coverage must include Chromium and WebKit; found ${expectedProjects.join(',') || 'none'}.`
  )
}

const expected = new Set(uniqueInstances(completeReport))
const observed = new Set()
const counts = []
for (const shard of shards) {
  const report = listTests(shard)
  const actualProjects = (report.config?.projects ?? []).map((project) => project.name).toSorted()
  if (actualProjects.join(',') !== expectedProjects.join(',')) {
    throw new Error(`Shard ${shard} collected a different browser-project set.`)
  }
  const instances = uniqueInstances(report, shard)
  const fileEngineGroups = new Set(
    instances.map((instance) => {
      const [project, file] = instance.split('\0')
      return `${project}/${file}`
    })
  )
  for (const instance of instances) {
    if (!expected.has(instance)) {
      throw new Error(`Shard ${shard} contains a component test absent from the full suite.`)
    }
    if (observed.has(instance)) {
      throw new Error(
        `Component test instance appeared in more than one shard: ${instance.replaceAll('\0', ' ')}`
      )
    }
    observed.add(instance)
  }
  counts.push(`${shard}: ${instances.length} tests / ${fileEngineGroups.size} file-engine groups`)
}

const missing = [...expected].filter((instance) => !observed.has(instance))
if (missing.length > 0 || observed.size !== expected.size) {
  throw new Error(
    `Four component shards cover ${observed.size}/${expected.size} test instances; first missing: ${missing[0]?.replaceAll('\0', ' ') ?? 'unknown'}.`
  )
}

console.log(
  `Verified all ${expected.size} component test instances across Chromium and WebKit exactly once (${counts.join('; ')}).`
)

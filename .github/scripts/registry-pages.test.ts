import { expect, test } from 'bun:test'
import { selectPagesSource } from './registry-pages.mjs'

const mainSha = 'a'.repeat(40)
const olderSha = 'b'.repeat(40)
const currentMainRun = {
  eventName: 'workflow_run',
  repository: 'adea-ai/ui',
  runEvent: 'push',
  runBranch: 'main',
  runRepository: 'adea-ai/ui',
  runConclusion: 'success',
  runId: '123456789',
  runHeadSha: mainSha,
  mainSha,
}

test('Pages chooses only the exact current-main artifact or current-main build', () => {
  expect(selectPagesSource({ ...currentMainRun, artifactCount: 1 })).toEqual({
    publish: true,
    source: 'workflow_run',
    headSha: mainSha,
  })
  expect(selectPagesSource({ ...currentMainRun, artifactCount: 0 })).toEqual({
    publish: true,
    source: 'current-main',
    headSha: mainSha,
  })

  expect(
    selectPagesSource({
      ...currentMainRun,
      runHeadSha: olderSha,
      artifactCount: 1,
    })
  ).toEqual({ publish: false, source: 'none' })
})

test('Pages rejects forks, PR events and failed main runs', () => {
  for (const input of [
    { ...currentMainRun, runRepository: 'untrusted/ui' },
    { ...currentMainRun, runEvent: 'pull_request' },
    { ...currentMainRun, runConclusion: 'failure' },
  ]) {
    expect(selectPagesSource({ ...input, artifactCount: 1 })).toEqual({
      publish: false,
      source: 'none',
    })
  }
})

test('manual Pages publishing is restricted to the current main ref', () => {
  expect(
    selectPagesSource({
      eventName: 'workflow_dispatch',
      ref: 'refs/heads/feature',
      mainSha,
    })
  ).toEqual({ publish: false, source: 'none' })

  expect(
    selectPagesSource({
      eventName: 'workflow_dispatch',
      ref: 'refs/heads/main',
      mainSha,
    })
  ).toEqual({ publish: true, source: 'manual', headSha: mainSha })
})

test('ambiguous exact-run artifacts fail closed', () => {
  expect(() => selectPagesSource({ ...currentMainRun, artifactCount: 2 })).toThrow(
    'Expected one unexpired storybook-static artifact in the exact run, or none; found 2.'
  )
})

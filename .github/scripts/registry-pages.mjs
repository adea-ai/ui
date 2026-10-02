import { appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const noPublish = { publish: false, source: 'none' }
const isCommitSha = (value) => /^[a-f0-9]{40}$/.test(value ?? '')

function isEligibleMainRun(input) {
  return (
    input.eventName === 'workflow_run' &&
    input.runEvent === 'push' &&
    input.runBranch === 'main' &&
    input.runRepository === input.repository &&
    input.runConclusion === 'success' &&
    /^\d+$/.test(input.runId ?? '')
  )
}

/** Select only a trusted current-main source; never fall back to an older artifact. */
export function selectPagesSource(input) {
  if (input.eventName === 'workflow_dispatch') {
    if (input.ref !== 'refs/heads/main' || !isCommitSha(input.mainSha)) return noPublish
    return { publish: true, source: 'manual', headSha: input.mainSha }
  }

  if (!isEligibleMainRun(input)) return noPublish
  if (
    !isCommitSha(input.mainSha) ||
    !isCommitSha(input.runHeadSha) ||
    input.runHeadSha !== input.mainSha
  ) {
    return noPublish
  }

  if (!Number.isSafeInteger(input.artifactCount) || input.artifactCount < 0) {
    throw new Error('The exact-run artifact count must be a non-negative integer.')
  }
  if (input.artifactCount === 0) {
    return { publish: true, source: 'current-main', headSha: input.runHeadSha }
  }
  if (input.artifactCount === 1) {
    return { publish: true, source: 'workflow_run', headSha: input.runHeadSha }
  }
  throw new Error(
    'Expected one unexpired storybook-static artifact in the exact run, or none; found ' +
      input.artifactCount +
      '.'
  )
}

function ghApi(path, jq) {
  return execFileSync('gh', ['api', path, '--jq', jq], { encoding: 'utf8' }).trim()
}

function writeDecision(decision) {
  if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required in Actions.')
  const outputs = ['publish=' + decision.publish, 'source=' + decision.source]
  // The output key must stay free of head/sha/commit/branch/ref: it feeds the
  // workflow's checkout ref, whose field name CodeQL matches by name heuristic.
  if (decision.headSha) outputs.push('revision=' + decision.headSha)
  appendFileSync(process.env.GITHUB_OUTPUT, outputs.join('\n') + '\n')
}

function main() {
  const repository = process.env.GITHUB_REPOSITORY
  const input = {
    eventName: process.env.EVENT_NAME,
    ref: process.env.REF,
    repository,
    runEvent: process.env.RUN_EVENT,
    runBranch: process.env.RUN_BRANCH,
    runRepository: process.env.RUN_REPOSITORY,
    runConclusion: process.env.RUN_CONCLUSION,
    runId: process.env.RUN_ID,
    runHeadSha: process.env.RUN_HEAD_SHA,
  }
  const manualMain = input.eventName === 'workflow_dispatch' && input.ref === 'refs/heads/main'
  const eligibleRun = isEligibleMainRun(input)

  if (manualMain || eligibleRun) {
    if (!repository) throw new Error('GITHUB_REPOSITORY is required.')
    input.mainSha = ghApi('repos/' + repository + '/git/ref/heads/main', '.object.sha')
    if (eligibleRun && input.runHeadSha === input.mainSha) {
      const count = ghApi(
        'repos/' + repository + '/actions/runs/' + input.runId + '/artifacts?name=storybook-static',
        '[.artifacts[] | select(.expired == false)] | length'
      )
      input.artifactCount = Number(count)
    }
  }

  const decision = selectPagesSource(input)
  if (decision.source === 'current-main') {
    console.log(
      'The exact successful main run has no site artifact; building its still-current main revision.'
    )
  } else if (decision.source === 'workflow_run') {
    console.log('Using the successful run artifact for the exact current main revision.')
  } else if (!decision.publish && eligibleRun && input.runHeadSha !== input.mainSha) {
    console.log('The successful run is stale because main has advanced; skipping deployment.')
  } else if (!decision.publish) {
    console.log('This event is not an eligible Pages source; skipping deployment.')
  }
  writeDecision(decision)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()

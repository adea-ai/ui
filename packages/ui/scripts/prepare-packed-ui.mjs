import { createHash } from 'node:crypto'
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const uiRoot = resolve(import.meta.dirname, '..')
const outputDirectory = process.argv[2] ? resolve(process.argv[2]) : null
if (!outputDirectory) throw new Error('Usage: node prepare-packed-ui.mjs <output-directory>')

mkdirSync(outputDirectory, { recursive: true })
const packagePath = join(uiRoot, 'package.json')
const packageManifest = JSON.parse(readFileSync(packagePath, 'utf8'))
const output = execFileSync('npm', ['pack', '--json', '--pack-destination', outputDirectory], {
  cwd: uiRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
})
const packed = JSON.parse(output)
if (packed.length !== 1) throw new Error(`Expected one npm archive, received ${packed.length}`)

const [archive] = packed
if (archive.name !== packageManifest.name || archive.version !== packageManifest.version)
  throw new Error(
    `Packed identity ${archive.name}@${archive.version} does not match ${packageManifest.name}@${packageManifest.version}`
  )
if (archive.name !== '@adea-ai/ui') throw new Error(`Unexpected package name: ${archive.name}`)

const createdPath = join(outputDirectory, archive.filename)
const bytes = readFileSync(createdPath)
const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
const shasum = createHash('sha1').update(bytes).digest('hex')
const sha256 = createHash('sha256').update(bytes).digest('hex')
if (archive.integrity !== integrity)
  throw new Error('npm pack integrity does not match archive bytes')
if (archive.shasum !== shasum) throw new Error('npm pack SHA-1 does not match archive bytes')

const finalPath = join(outputDirectory, 'package.tgz')
renameSync(createdPath, finalPath)
const manifest = {
  name: archive.name,
  version: archive.version,
  file: 'package.tgz',
  size: statSync(finalPath).size,
  integrity,
  shasum,
  sha256,
  sourceCommit: process.env.GITHUB_SHA ?? null,
}
writeFileSync(join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `version=${manifest.version}\nsha256=${sha256}\nintegrity=${integrity}\nsize=${manifest.size}\n`
  )
}

console.log(JSON.stringify({ result: 'prepared immutable packed UI artifact', ...manifest }))

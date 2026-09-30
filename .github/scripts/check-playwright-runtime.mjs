import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

/** Fail before packed checks when the image and installed engines drift apart. */
export function validatePlaywrightRuntime(
  image,
  installedVersion,
  executables,
  exists = existsSync
) {
  const match = /^mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-noble@sha256:[a-f0-9]{64}$/.exec(
    image ?? ''
  )
  if (!match) throw new Error('The Playwright runtime must use a versioned, digest-pinned image')
  if (match[1] !== installedVersion)
    throw new Error(
      `Installed Playwright ${installedVersion} does not match image ${image}; update the image with the dependency`
    )
  for (const browser of ['chromium', 'webkit']) {
    const path = executables[browser]
    if (!path || !exists(path))
      throw new Error(`The pinned runtime is missing the installed ${browser} executable: ${path}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const require = createRequire(import.meta.url)
  const { chromium, webkit } = require('@playwright/test')
  const { version } = require('@playwright/test/package.json')
  validatePlaywrightRuntime(process.env.PLAYWRIGHT_RUNTIME_IMAGE, version, {
    chromium: chromium.executablePath(),
    webkit: webkit.executablePath(),
  })
  console.log(`Verified Playwright ${version} and both packed-contract engines`)
}

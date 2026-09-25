/**
 * A static file server for the built workshop.
 *
 * The accessibility lane runs against a real build rather than against the dev
 * server, so what is checked is what a reviewer would download. This exists
 * instead of a static-server dependency because the whole job is "serve these
 * files with the right content types", which Bun does in twenty lines.
 *
 * Usage: bun scripts/serve-workshop.ts [port]
 */

import { join, normalize, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '..', 'storybook-static')
const PORT = Number(process.argv[2] ?? 6106)

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  map: 'application/json; charset=utf-8',
}

function contentType(path: string): string {
  const extension = path.split('.').at(-1)?.toLowerCase() ?? ''
  return CONTENT_TYPES[extension] ?? 'application/octet-stream'
}

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url)
    const requested = url.pathname === '/' ? '/index.html' : url.pathname

    // `normalize` collapses `..` before it reaches the file system, so a
    // traversal attempt resolves inside ROOT rather than above it.
    const path = join(ROOT, normalize(requested))
    if (!path.startsWith(ROOT)) {
      return new Response('Forbidden', { status: 403 })
    }

    const file = Bun.file(path)
    if (await file.exists()) {
      return new Response(file, { headers: { 'content-type': contentType(path) } })
    }

    // A single-page app: an unknown path is the shell, not a 404.
    return new Response(Bun.file(join(ROOT, 'index.html')), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  },
})

console.log(`serving ${ROOT} on http://127.0.0.1:${server.port}`)

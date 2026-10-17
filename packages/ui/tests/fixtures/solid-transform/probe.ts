// Run in a cold `bun --preload` process by tests/solid-transform-globals.test.ts. The Solid
// transform runs once per `.tsx` module; the imports below overlap on purpose.
const original = {
  prepareStackTrace: Error.prepareStackTrace,
  stackTraceLimit: Error.stackTraceLimit,
}

await Promise.all(['./a.tsx', './b.tsx', './c.tsx', './d.tsx'].map((file) => import(file)))

const report = {
  prepareStackTraceRestored: Error.prepareStackTrace === original.prepareStackTrace,
  stackTraceLimitRestored: Error.stackTraceLimit === original.stackTraceLimit,
  captureStackTrace: 'ok' as string,
  vite: 'ok' as string,
}
try {
  Error.captureStackTrace({})
} catch (error) {
  report.captureStackTrace = String(error)
}
try {
  await import('vite')
} catch (error) {
  report.vite = String(error)
}
console.log(JSON.stringify(report))

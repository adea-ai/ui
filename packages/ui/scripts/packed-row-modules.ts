/**
 * Locked @corvu/utils@0.4.2 reaches rich Tooltip through Kobalte Tooltip →
 * solid-presence → @corvu/utils/reactivity. Its default export condition
 * retains the `access` helper from ZV6G25TT.js; the Solid export condition
 * retains the same helper from U42ECMND.jsx. Match both exact module IDs.
 * Bun inlines the resolved version into its cache-link paths, so a different
 * version there is rejected outright; when the consumer sits on another
 * filesystem than the cache (CI's /tmp consumer) Bun copies packages into a
 * plain node_modules whose path carries no version — those are accepted on
 * chunk identity alone and check-packed-list-row pins the installed version
 * on disk instead. Any Corvu module or changed chunk identity must be
 * investigated before it is allowed into a row bundle.
 */
const verifiedTooltipUtility =
  /node_modules\/@corvu\/utils\/dist\/chunk\/(?:ZV6G25TT\.js|U42ECMND\.jsx)$/i
const versionedCacheLink = /@corvu\+utils@/i
const lockedCacheLink = /@corvu\+utils@0\.4\.2(?:\+|\/)/i
const corvuModule = /\/node_modules\/@corvu\//i
const heavyUnrelatedModule =
  /(?:chart\.js|embla-carousel|xterm|@codemirror|shiki|storybook|@adea-ai\/themes|\/components\/(?:conversation|layout|theme)\/)/i

export function findUnrelatedPackedRowModules(modules: readonly string[]) {
  return modules.filter((id) => {
    if (heavyUnrelatedModule.test(id)) return true
    if (!corvuModule.test(id)) return false
    if (!verifiedTooltipUtility.test(id)) return true
    return versionedCacheLink.test(id) && !lockedCacheLink.test(id)
  })
}

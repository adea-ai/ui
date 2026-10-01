/**
 * Locked @corvu/utils@0.4.2 reaches rich Tooltip through Kobalte Tooltip →
 * solid-presence → @corvu/utils/reactivity. Its default export condition
 * retains the `access` helper from ZV6G25TT.js; the Solid export condition
 * retains the same helper from U42ECMND.jsx. Match both exact module IDs and
 * the locked package version. Any Corvu module or changed chunk identity must
 * be investigated before it is allowed into a row bundle.
 */
const verifiedTooltipUtility =
  /@corvu\+utils@0\.4\.2\+[^/]+\/node_modules\/@corvu\/utils\/dist\/chunk\/(?:ZV6G25TT\.js|U42ECMND\.jsx)$/i
const corvuModule = /\/node_modules\/@corvu\//i
const heavyUnrelatedModule =
  /(?:chart\.js|embla-carousel|xterm|@codemirror|shiki|storybook|@adea-ai\/themes|\/components\/(?:conversation|layout|theme)\/)/i

export function findUnrelatedPackedRowModules(modules: readonly string[]) {
  return modules.filter(
    (id) =>
      (corvuModule.test(id) && !verifiedTooltipUtility.test(id)) || heavyUnrelatedModule.test(id)
  )
}

/**
 * The no-flash boot script, importable where there is no UI runtime.
 *
 * `themeScript` writes the document attributes before first paint. A host that
 * renders its HTML at build time (a Vite `index.html` served by a desktop shell
 * whose CSP allows no inline script) needs the string in Node, and the provider
 * entries cannot be imported there: they load Solid's client runtime. This entry
 * holds only the script and the types it takes, so it loads anywhere.
 */
export { inlineScriptLiteral, themeScript, type ThemeScriptOptions } from './theme-script'
export type { ThemeStorageSchema } from './theme-persistence'

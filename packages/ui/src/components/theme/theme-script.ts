/*
 * Copyright (c) 2026 Wing
 * Licensed under the MIT License.
 *
 * The options form is rewritten from Adea's accepted port of Zeron's preference
 * store (`appearanceThemeScript` in `packages/ui/src/components/appearance.ts`,
 * https://github.com/zeronsh/zeron) so the boot script reads the document the shared
 * persistence writes. See NOTICE.
 */
import { fontSettingsBootstrapScript } from '#lib/appearance-font-settings'
import { isCustomAccent } from '#lib/accent-roles'
import { safeScriptStringLiteral } from '#lib/safe-script'
import { REDUCED_TRANSPARENCY_QUERY, surfaceAlpha } from '#lib/theme-surface'
import { accentPresets } from '#lib/tokens'
import { builtinThemes, defaultDarkThemeId, defaultLightThemeId } from '#lib/themes'
import type { ThemeStorageSchema } from './theme-persistence'

/**
 * A string as a JavaScript literal that is also safe inside an inline `<script>`.
 *
 * `JSON.stringify` produces a correct JavaScript literal, and it is **not** safe
 * here: it leaves `<` and `>` alone, so a value containing `</script>` ends the tag
 * early and everything after it is parsed as HTML. That is the classic inline-script
 * injection, and it is a real one even though the value is a developer-supplied prop
 * rather than user input — a prop can come from configuration, and a key that happens
 * to contain a closing tag should not be able to execute.
 *
 * The escape is also correct JavaScript: `\u003c` is `<` to the parser, so the value
 * is byte-identical at runtime and inert to the HTML tokenizer. `\u2028` and `\u2029`
 * are escaped for the neighbouring reason — they are legal inside a JSON string and
 * were, before ES2019, line terminators to a JavaScript parser.
 *
 * CodeQL flags the unescaped form as `js/bad-code-sanitization`, which is how this
 * was found; `tests/theme-script.test.ts` pins it so it cannot come back.
 */
export function inlineScriptLiteral(value: string): string {
  return safeScriptStringLiteral(value)
}

/**
 * Options for the host-shaped no-flash script: the document's {@link ThemeStorageSchema}
 * plus what the script paints from it.
 */
export type ThemeScriptOptions = ThemeStorageSchema & {
  /**
   * The accent painted when the document has none, an unrecognised one, or the
   * legacy `theme` spelling — the host's default (adea: `violet`). Without it those
   * cases paint no `data-accent`, which is what the provider writes for `theme`.
   * Setting it means the `[data-accent]` block of the default preset paints on the
   * first frame instead of after hydration.
   */
  defaultAccent?: string
  /**
   * Also resolve the surface axis (`data-surface`, `data-reduce-transparency`,
   * `--surface-alpha`) from the document and the operating system's Reduce
   * Transparency setting. A `translucent` preference resolves to `frosted`: the
   * host's translucency capability is not known until the provider mounts, and the
   * provider re-resolves it then. Match the provider's `surface` prop.
   */
  surface?: boolean
  /**
   * Match the provider's `palette` prop. The attributes written are the same either
   * way: a catalogue variant's palette is the host stylesheet's job (`stylesheet`) or
   * the provider's, at mount (`inline`), and a stored theme's own tokens are written
   * inline in both.
   */
  palette?: 'inline' | 'stylesheet'
  /** The only `version` of the library document read. Default `1`. */
  libraryVersion?: number
}

/**
 * The no-flash script.
 *
 * Rendered inline in `<head>` before any stylesheet that matters. Without it a dark
 * preference paints the light theme first and then swaps, which is the flash every
 * themed application has to solve and the one thing a provider cannot do from
 * inside the body.
 *
 * ## The string form
 *
 * `themeScript('key')` serves a provider that stores an unversioned
 * `localStorage[key]` document. Deliberately tiny and dependency-free: it reads the
 * stored preference, resolves `system`, and sets the class. It does not apply the
 * variant's roles — the default theme in `theme.css` covers the first paint, and the
 * provider writes the rest on mount. Its output is a compatibility surface (a
 * consumer may have it in a snapshot), so it does not change.
 *
 * ## The options form
 *
 * `themeScript({ key, ... })` serves a host with a versioned document (see
 * `createVersionedPersistence`) and writes what the provider will write, so mounting
 * repaints nothing:
 *
 *   - `class="dark"`, `color-scheme`, `data-theme`, `data-appearance` and, for a
 *     compact document, `data-density`;
 *   - `data-accent`: a preset id as stored, `custom` for a `#rrggbb` (never the hex
 *     itself, which is the worst possible attribute content), `defaultAccent` when the
 *     document has none, nothing for a theme-derived `ansi-*` accent (it has no
 *     stylesheet block; the provider paints it inline);
 *   - the theme: the stored id when the catalogue or the stored library holds it, else
 *     the default of the resolved appearance, exactly as the provider resolves it. A
 *     library theme's own tokens are written inline, so an imported theme paints on the
 *     first frame;
 *   - the surface axis, when `surface` is set;
 *   - the font settings, guarded to the document's `version`.
 *
 * The document's `version`, when the schema names one, must match exactly. The legacy
 * key is read only while the main key is absent: an unreadable main document is not
 * "no preference", so it does not resurrect an older value.
 *
 * The script reads values out of `localStorage` and writes them to `dataset` and
 * `style`, which are *property* assignments rather than code: a stored id, accent or
 * token can set an attribute and cannot execute. The values that reach the source as
 * text (keys, ids, the default accent) go through {@link inlineScriptLiteral} for the
 * reason documented there.
 */
export function themeScript(storageKey?: string): string
export function themeScript(options: ThemeScriptOptions): string
export function themeScript(input: string | ThemeScriptOptions = 'adea-appearance'): string {
  if (typeof input === 'string') return stringFormScript(input)
  return optionsFormScript(input)
}

function stringFormScript(storageKey: string): string {
  const script = `(function(){try{var s=localStorage.getItem(${inlineScriptLiteral(storageKey)});var p=s?JSON.parse(s):{};var a=p.appearance||'system';var d=a==='dark'||(a==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';if(p.accent&&p.accent!=='theme')r.dataset.accent=p.accent;if(p.density==='compact')r.dataset.density='compact';}catch(e){}})();`
  return `${script}${fontSettingsBootstrapScript(storageKey)}`
}

const literal = safeScriptStringLiteral

function optionsFormScript(options: ThemeScriptOptions): string {
  const field = options.appearanceField ?? 'appearance'
  const versionGuard =
    options.version === undefined ? '' : `&&x.version===${Number(options.version)}`
  const presets = accentPresets
    .filter((preset) => preset.id !== 'theme')
    .map((preset) => literal(preset.id))
  const defaultAccent =
    options.defaultAccent === undefined
      ? ''
      : isCustomAccent(options.defaultAccent)
        ? 'custom'
        : options.defaultAccent

  const parts: string[] = []
  parts.push(
    `(function(){try{`,
    `var r=document.documentElement,s=r.style;`,
    `var q=function(m){try{return window.matchMedia(m).matches}catch(e){return false}};`,
    `var get=function(k){try{return localStorage.getItem(k)}catch(e){return null}};`,
    // The main document. `raw !== null` rather than truthiness: an empty string is a
    // stored (corrupt) value, so it does not fall through to the legacy key.
    `var raw=get(${literal(options.key)}),doc=null,legacy=null;`,
    `if(raw!==null){try{var x=JSON.parse(raw);if(x&&typeof x==='object'&&!Array.isArray(x)${versionGuard})doc=x}catch(e){}}`
  )
  if (options.legacyAppearanceKey !== undefined) {
    parts.push(`else legacy=get(${literal(options.legacyAppearanceKey)});`)
  }
  parts.push(
    `var m=doc?doc[${literal(field)}]:legacy;`,
    `var mode=m==='light'||m==='dark'?m:'system';`,
    `var dark=mode==='dark'||(mode==='system'&&q('(prefers-color-scheme: dark)'));`,
    `var fallback=dark?${literal(defaultDarkThemeId)}:${literal(defaultLightThemeId)};`,
    `var want=doc?(dark?doc.darkThemeId:doc.lightThemeId):null;`,
    `if(typeof want!=='string')want=fallback;`,
    `var ids=[${builtinThemes.map((theme) => literal(theme.id)).join(',')}];`,
    `var id=ids.indexOf(want)!==-1?want:null,tokens=null;`
  )
  if (options.libraryKey !== undefined) {
    parts.push(
      `if(id===null){try{var lib=JSON.parse(get(${literal(options.libraryKey)})||'null');`,
      `if(lib&&typeof lib==='object'&&lib.version===${Number(options.libraryVersion ?? 1)}&&Array.isArray(lib.themes)){`,
      `for(var i=0;i!==lib.themes.length;i++){var t=lib.themes[i];`,
      `if(t&&t.id===want&&t.flatTokens&&typeof t.flatTokens==='object'){id=want;tokens=t.flatTokens;break}}}}catch(e){}}`
    )
  }
  parts.push(
    `if(id===null)id=fallback;`,
    `r.classList.toggle('dark',dark);`,
    `s.colorScheme=dark?'dark':'light';`,
    `r.dataset.theme=id;`,
    `r.dataset.appearance=dark?'dark':'light';`
  )
  if (options.libraryKey !== undefined) {
    parts.push(
      `if(tokens){for(var n in tokens){if(Object.prototype.hasOwnProperty.call(tokens,n)&&n.slice(0,2)==='--'&&typeof tokens[n]==='string')s.setProperty(n,tokens[n])}}`
    )
  }
  parts.push(
    `var a=doc&&typeof doc.accent==='string'?doc.accent:'';`,
    `var accent=[${presets.join(',')}].indexOf(a)!==-1?a:/^#[0-9a-fA-F]{6}$/.test(a)?'custom':a.slice(0,5)==='ansi-'?'':${literal(defaultAccent)};`,
    `if(accent)r.dataset.accent=accent;`,
    `if(doc&&doc.density==='compact')r.dataset.density='compact';`
  )
  if (options.surface) {
    parts.push(
      // Reduce Transparency forces the opaque surface; a translucent request resolves
      // to frosted because the host's capability is unknown before the provider mounts.
      `var reduce=q(${literal(REDUCED_TRANSPARENCY_QUERY)})||!!(doc&&doc.reduceTransparency===true);`,
      `var surface=reduce?'opaque':doc&&(doc.surface==='frosted'||doc.surface==='translucent')?'frosted':'opaque';`,
      `r.dataset.surface=surface;`,
      `r.dataset.reduceTransparency=reduce?'true':'false';`,
      `s.setProperty('--surface-alpha',${JSON.stringify(surfaceAlpha)}[surface]);`
    )
  }
  parts.push(`}catch(e){}})();`)

  return `${parts.join('')}${fontSettingsBootstrapScript(options.key, options.version)}`
}

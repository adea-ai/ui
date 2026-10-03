import { fontOptions, type FontOption } from './font-catalog'
import { safeScriptStringLiteral } from './safe-script'

export const APPEARANCE_EDITOR_FONT_AXES = ['ui', 'content', 'code'] as const

export type AppearanceEditorFontAxis = (typeof APPEARANCE_EDITOR_FONT_AXES)[number]
export type AppearanceEditorFontFamilyId = FontOption['id']

export type AppearanceEditorFontSetting = Readonly<{
  /** A stable id from the shared font catalogue, never a CSS family string. */
  family: AppearanceEditorFontFamilyId
  /** A pixel size, normalized to the supported range. */
  size: number
}>

/** The host-owned choices edited by the shared appearance composition. */
export type AppearanceEditorFontSettings = Readonly<
  Record<AppearanceEditorFontAxis, AppearanceEditorFontSetting>
>

export const APPEARANCE_EDITOR_FONT_SIZE_MIN = 10
export const APPEARANCE_EDITOR_FONT_SIZE_MAX = 32

/** New preferences use the platform face in each text role. */
export const DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS: AppearanceEditorFontSettings = Object.freeze({
  ui: Object.freeze({ family: 'system', size: 14 }),
  content: Object.freeze({ family: 'system', size: 14 }),
  code: Object.freeze({ family: 'system', size: 12 }),
})

export type NormalizedAppearanceEditorFontSettings = Readonly<{
  settings: AppearanceEditorFontSettings
  /** Axes whose persisted family or size was unavailable or outside its limits. */
  recoveredAxes: readonly AppearanceEditorFontAxis[]
}>

const fontFamilyIds: ReadonlySet<string> = new Set(fontOptions.map((option) => option.id))
const fontOptionsById = Object.freeze(
  Object.fromEntries(fontOptions.map((option) => [option.id, option])) as Record<
    AppearanceEditorFontFamilyId,
    FontOption
  >
)
const fontProjectionById = Object.freeze(
  Object.fromEntries(
    fontOptions.map((option) => [
      option.id,
      {
        familyVariables: option.familyVariables,
        uiTracking: option.uiTracking,
        uiWordSpacing: option.uiWordSpacing,
      },
    ])
  ) as Record<
    AppearanceEditorFontFamilyId,
    Pick<FontOption, 'familyVariables' | 'uiTracking' | 'uiWordSpacing'>
  >
)
const fontAxisProjection = Object.freeze({
  ui: Object.freeze({
    familyAttribute: 'data-ui-font',
    familyProperty: '--font-ui',
    sizeProperty: '--font-ui-size',
    scaleProperty: '--font-ui-scale',
    defaultSize: DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS.ui.size,
  }),
  content: Object.freeze({
    familyAttribute: 'data-content-font',
    familyProperty: '--font-content',
    sizeProperty: '--font-content-size',
    scaleProperty: '--font-content-scale',
    defaultSize: DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS.content.size,
  }),
  code: Object.freeze({
    familyAttribute: 'data-code-font',
    familyProperty: '--font-code',
    sizeProperty: '--font-code-size',
    scaleProperty: '--font-code-scale',
    defaultSize: DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS.code.size,
  }),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function normalizeFamily(value: unknown): AppearanceEditorFontFamilyId | undefined {
  return typeof value === 'string' && fontFamilyIds.has(value)
    ? (value as AppearanceEditorFontFamilyId)
    : undefined
}

function clampFontSize(value: number): number {
  return Math.min(
    APPEARANCE_EDITOR_FONT_SIZE_MAX,
    Math.max(APPEARANCE_EDITOR_FONT_SIZE_MIN, Math.round(value))
  )
}

/** Normalize a single number-input value; invalid edits return the current size. */
export function normalizeAppearanceEditorFontSize(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN
  return Number.isFinite(parsed) ? clampFontSize(parsed) : clampFontSize(fallback)
}

/**
 * Recover persisted font choices against the shared font catalogue.
 *
 * `legacyUiFamily` lets a host migrate its previous single font field into the
 * UI axis. Content and code remain on the new System defaults during that
 * migration. Missing settings are ordinary defaults; an unknown saved id or an
 * invalid size is reported through `recoveredAxes` for the host's notice.
 */
export function normalizeAppearanceEditorFontSettings(
  value: unknown,
  legacyUiFamily?: unknown
): NormalizedAppearanceEditorFontSettings {
  const source = isRecord(value) ? value : undefined
  const malformedRoot = value !== undefined && value !== null && source === undefined
  const recovered = new Set<AppearanceEditorFontAxis>()
  const settings = {} as Record<AppearanceEditorFontAxis, AppearanceEditorFontSetting>

  for (const axis of APPEARANCE_EDITOR_FONT_AXES) {
    const axisPresent = source ? hasOwn(source, axis) : false
    const axisValue = source?.[axis]
    const axisSource = isRecord(axisValue) ? axisValue : undefined
    const fallback = DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS[axis]

    if (malformedRoot || (axisPresent && axisSource === undefined)) recovered.add(axis)

    const hasFamily = axisSource ? hasOwn(axisSource, 'family') : false
    const familyInput = hasFamily
      ? axisSource?.['family']
      : axis === 'ui' && legacyUiFamily !== undefined
        ? legacyUiFamily
        : undefined
    const family = normalizeFamily(familyInput) ?? fallback.family
    if (
      (hasFamily || (axis === 'ui' && legacyUiFamily !== undefined)) &&
      !normalizeFamily(familyInput)
    ) {
      recovered.add(axis)
    }

    const hasSize = axisSource ? hasOwn(axisSource, 'size') : false
    const sizeInput = axisSource?.['size']
    const size = hasSize
      ? normalizeAppearanceEditorFontSize(sizeInput, fallback.size)
      : fallback.size
    if (
      hasSize &&
      (typeof sizeInput !== 'number' || !Number.isFinite(sizeInput) || sizeInput !== size)
    ) {
      recovered.add(axis)
    }

    settings[axis] = Object.freeze({ family, size })
  }

  return Object.freeze({
    settings: Object.freeze(settings),
    recoveredAxes: Object.freeze(APPEARANCE_EDITOR_FONT_AXES.filter((axis) => recovered.has(axis))),
  })
}

/**
 * Project normalized font preferences onto a document root.
 *
 * This is shared by `ThemeProvider` and hosts that own their own appearance
 * persistence, so UI/content/code use the same catalogue ids, theme tokens,
 * sizes, and projected CSS variables. The marker activates the optional role
 * stylesheet and survives CSS import reordering.
 */
export function applyAppearanceFontSettings(
  root: HTMLElement,
  value: unknown
): NormalizedAppearanceEditorFontSettings {
  const normalized = normalizeAppearanceEditorFontSettings(value)
  const { settings } = normalized

  root.removeAttribute('data-font')
  root.setAttribute('data-font-settings', '')
  for (const axis of APPEARANCE_EDITOR_FONT_AXES) {
    const projection = fontAxisProjection[axis]
    const setting = settings[axis]
    const option = fontOptionsById[setting.family]
    if (setting.family === 'system') root.removeAttribute(projection.familyAttribute)
    else root.setAttribute(projection.familyAttribute, setting.family)
    root.style.setProperty(projection.familyProperty, `var(${option.familyVariables[axis]})`)
    root.style.setProperty(projection.sizeProperty, String(setting.size) + 'px')
    root.style.setProperty(projection.scaleProperty, String(setting.size / projection.defaultSize))
    if (axis === 'ui') {
      root.style.setProperty('--ui-tracking', option.uiTracking)
      root.style.setProperty('--ui-word-spacing', option.uiWordSpacing)
    }
  }

  return normalized
}

/**
 * Generate a safe inline prepaint script for a host-owned appearance record.
 *
 * The stored object is read from `localStorage[storageKey].fonts`. A legacy
 * top-level `font` family migrates into UI only; content/code use the shared
 * defaults. The script applies the same catalogue whitelist, limits, attributes,
 * and CSS properties as `applyAppearanceFontSettings` before styles paint. When
 * `persistedVersion` is supplied, only a record with that exact top-level version
 * is used; absent or mismatched records receive the System defaults.
 */
export function fontSettingsBootstrapScript(storageKey: string, persistedVersion?: number): string {
  if (persistedVersion !== undefined && !Number.isSafeInteger(persistedVersion)) {
    throw new RangeError('persistedVersion must be a safe integer')
  }
  const axisConfig = JSON.stringify(fontAxisProjection)
  const fontProjection = JSON.stringify(fontProjectionById)
  const fontIds = `[${fontOptions.map((option) => safeScriptStringLiteral(option.id)).join(',')}]`
  const persistedVersionGuard =
    persistedVersion === undefined
      ? ''
      : `&&parsed.version===Number(${safeScriptStringLiteral(String(persistedVersion))})`

  return `(function(){var r=document.documentElement;var axes=JSON.parse(${safeScriptStringLiteral(axisConfig)});var projection=JSON.parse(${safeScriptStringLiteral(fontProjection)});var ids=${fontIds};var has=function(v,k){return Object.prototype.hasOwnProperty.call(v,k)};var record=function(v){return typeof v==='object'&&v!==null&&!Array.isArray(v)};var p={};try{var raw=localStorage.getItem(${safeScriptStringLiteral(storageKey)});var parsed=raw?JSON.parse(raw):{};if(record(parsed)${persistedVersionGuard})p=parsed;}catch(e){}var saved=record(p.fonts)?p.fonts:{};var valid=function(v,d){return ids.indexOf(v)!==-1?v:d};var size=function(v,d){var n=typeof v==='number'?v:typeof v==='string'&&v.trim()!==''?Number(v):NaN;return Number.isFinite(n)?Math.min(${APPEARANCE_EDITOR_FONT_SIZE_MAX},Math.max(${APPEARANCE_EDITOR_FONT_SIZE_MIN},Math.round(n))):d};r.setAttribute('data-font-settings','');for(var axis in axes){if(!has(axes,axis))continue;var spec=axes[axis];var candidate=saved[axis];var value=record(candidate)?candidate:{};var legacyUi=axis==='ui'&&!has(value,'family');var family=legacyUi?valid(p.font,'system'):valid(value.family,'system');var font=projection[family];if(family==='system')r.removeAttribute(spec.familyAttribute);else r.setAttribute(spec.familyAttribute,family);r.style.setProperty(spec.familyProperty,'var('+font.familyVariables[axis]+')');var px=size(value.size,spec.defaultSize);r.style.setProperty(spec.sizeProperty,px+'px');r.style.setProperty(spec.scaleProperty,String(px/spec.defaultSize));if(axis==='ui'){r.style.setProperty('--ui-tracking',font.uiTracking);r.style.setProperty('--ui-word-spacing',font.uiWordSpacing);}}r.removeAttribute('data-font');})();`
}

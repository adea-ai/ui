/*
 * The manager's bundler transpiles JSX with the classic runtime and does not
 * bind a `React` identifier — see toolbar-icons.tsx. The pragmas route the
 * transform through imported bindings so the bundler rewrites them like any
 * other import.
 */
/* @jsx createElement */
/* @jsxFrag Fragment */
// oxlint-disable-next-line no-unused-vars -- consumed by the JSX pragmas above, invisibly to the linter
import { createElement, Fragment, useState } from 'react'
import { addons, types, useGlobals } from 'storybook/manager-api'
import { Select, Separator, ToggleButton } from 'storybook/internal/components'
import { accentPresets, fontOptions } from '@adea-ai/ui/lib/tokens'
import {
  defaultDarkThemeId,
  defaultLightThemeId,
  themesForAppearance,
  type ThemeAppearance,
} from '@adea-ai/ui/lib/themes'
import { resolveSelection, type WorkshopGlobals } from './appearance-globals'
import { BrushIcon, PaletteIcon, SunMoonIcon, TypeIcon } from './toolbar-icons'

const TOOL_ID = 'workshop/theme-toolbar'

/**
 * The value of the divider option that separates the managed Adea family from the
 * imported themes. Filtered out of `onSelect`, so it cannot be chosen; it exists
 * to be looked at.
 */
const THEME_DIVIDER = 'workshop/theme-divider'

/**
 * The theme options for one appearance: the managed Adea variants pinned first —
 * the catalogue's own sort — then a divider, then the imported themes. The divider
 * renders through the option's `children`, which the Select mounts verbatim.
 */
const themeOptions = (appearance: ThemeAppearance) => {
  const themes = themesForAppearance(appearance)
  const managed = themes.filter((theme) => theme.family === 'adea')
  const imported = themes.filter((theme) => theme.family !== 'adea')
  const option = (theme: (typeof themes)[number]) => ({
    title: `${theme.familyLabel} ${theme.label}`,
    description: theme.description,
    value: theme.id,
  })
  return [
    ...managed.map(option),
    {
      title: '',
      value: THEME_DIVIDER,
      children: <div role="presentation" className="workshop-theme-divider" />,
    },
    ...imported.map(option),
  ]
}

/**
 * The workshop's theme toolbar: one group, flanked by dividers.
 *
 *   - the sun-moon toggle flips the appearance;
 *   - the palette dropdown offers the themes *of that appearance* — a picker that
 *     listed all 30 would put Catppuccin Mocha one click away from a light
 *     canvas, which is how the old all-themes selector produced white-on-white
 *     documents;
 *   - the brush dropdown is the accent axis, with "Theme Default" for the
 *     variant's own primary;
 *   - the type dropdown is the font axis — the same curated `fontOptions` the
 *     `data-font` blocks implement, not a scan of the OS's installed faces,
 *     because the family ladder is a system decision and `system` is already on
 *     it for whoever wants the platform's own face.
 *
 * All three write the same globals the preview's `appearance-globals.ts`
 * resolves, and that resolver is shared, so the toolbar's view of the world and
 * the document's can only disagree if someone edits one of them.
 *
 * The toggle keeps one remembered theme per side in memory: flipping to light
 * and back restores the dark variant you were on, which is the same "a theme per
 * appearance" the applications' preference model holds.
 *
 * The typeface axis is preview-scoped: the manager document does not load the
 * self-hosted faces, so chrome that followed the selection would silently
 * render a fallback while claiming to have changed.
 */
const ThemeToolbar = () => {
  const [globals, updateGlobals] = useGlobals()
  const selection = resolveSelection(globals as WorkshopGlobals)
  const appearance = selection.appearance
  const themeId = appearance === 'dark' ? selection.darkThemeId : selection.lightThemeId
  const [remembered, setRemembered] = useState<Partial<Record<ThemeAppearance, string>>>({})

  const toggleAppearance = () => {
    const next: ThemeAppearance = appearance === 'dark' ? 'light' : 'dark'
    setRemembered((current) => ({ ...current, [appearance]: themeId }))
    updateGlobals({
      appearance: next,
      theme: remembered[next] ?? (next === 'light' ? defaultLightThemeId : defaultDarkThemeId),
    })
  }

  return (
    <>
      <Separator />
      <ToggleButton
        pressed={appearance === 'dark'}
        ariaLabel="Color scheme"
        tooltip={`Dark mode ${appearance === 'dark' ? 'on' : 'off'} — click for ${appearance === 'dark' ? 'light' : 'dark'}`}
        onClick={toggleAppearance}
      >
        <SunMoonIcon />
      </ToggleButton>
      <Select
        key={`theme-${themeId}`}
        icon={<PaletteIcon />}
        ariaLabel="Theme"
        tooltip="Theme"
        defaultOptions={themeId}
        options={themeOptions(appearance)}
        onSelect={(id) => {
          if (id !== THEME_DIVIDER) updateGlobals({ theme: id })
        }}
      >
        Theme
      </Select>
      <Select
        key={`accent-${selection.accent}`}
        icon={<BrushIcon />}
        ariaLabel="Accent"
        tooltip="Accent"
        defaultOptions={selection.accent}
        options={accentPresets.map((preset) => ({
          title: preset.id === 'theme' ? 'Theme Default' : preset.label,
          description: preset.description,
          value: preset.id,
        }))}
        onSelect={(id) => updateGlobals({ accent: id })}
      >
        Accent
      </Select>
      <Select
        key={`font-${selection.font}`}
        icon={<TypeIcon />}
        ariaLabel="Typeface"
        tooltip="Typeface"
        defaultOptions={selection.font}
        options={fontOptions.map((font) => ({
          title: font.label,
          description: font.description,
          value: font.id,
        }))}
        onSelect={(id) => updateGlobals({ font: id })}
      >
        Typeface
      </Select>
      <Separator />
    </>
  )
}

addons.register(TOOL_ID, () => {
  addons.add(`${TOOL_ID}/tool`, {
    title: 'Theme',
    type: types.TOOL,
    match: ({ viewMode, tabId }) => !!(viewMode && viewMode.match(/^(story|docs)$/)) && !tabId,
    render: ThemeToolbar,
  })
})

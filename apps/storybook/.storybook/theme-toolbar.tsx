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
import { accentPresets } from '@adea-ai/ui/lib/tokens'
import {
  defaultDarkThemeId,
  defaultLightThemeId,
  themesForAppearance,
  type ThemeAppearance,
} from '@adea-ai/ui/lib/themes'
import { resolveSelection, type WorkshopGlobals } from './appearance-globals'
import { BrushIcon, PaletteIcon, SunMoonIcon } from './toolbar-icons'

const TOOL_ID = 'workshop/theme-toolbar'

/**
 * The workshop's theme toolbar: one group, flanked by dividers.
 *
 *   - the sun-moon toggle flips the appearance;
 *   - the palette dropdown offers the themes *of that appearance* — a picker that
 *     listed all 30 would put Catppuccin Mocha one click away from a light
 *     canvas, which is how the old all-themes selector produced white-on-white
 *     documents;
 *   - the brush dropdown is the accent axis, with "Theme Default" for the
 *     variant's own primary.
 *
 * All three write the same globals the preview's `appearance-globals.ts`
 * resolves, and that resolver is shared, so the toolbar's view of the world and
 * the document's can only disagree if someone edits one of them.
 *
 * The toggle keeps one remembered theme per side in memory: flipping to light
 * and back restores the dark variant you were on, which is the same "a theme per
 * appearance" the applications' preference model holds.
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
        options={themesForAppearance(appearance).map((theme) => ({
          title: `${theme.familyLabel} ${theme.label}`,
          description: theme.description,
          value: theme.id,
        }))}
        onSelect={(id) => updateGlobals({ theme: id })}
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

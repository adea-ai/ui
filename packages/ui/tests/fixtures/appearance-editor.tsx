import adeaLight from '@adea-ai/themes/themes/adea-light'
import adeaDark from '@adea-ai/themes/themes/adea-dark'
import ayu from '@adea-ai/themes/themes/ayu'
import ayuLight from '@adea-ai/themes/themes/ayu-light'
import ayuMirage from '@adea-ai/themes/themes/ayu-mirage'
import catppuccinFrappe from '@adea-ai/themes/themes/catppuccin-frappe'
import catppuccinLatte from '@adea-ai/themes/themes/catppuccin-latte'
import catppuccinMacchiato from '@adea-ai/themes/themes/catppuccin-macchiato'
import catppuccinMocha from '@adea-ai/themes/themes/catppuccin-mocha'
import dracula from '@adea-ai/themes/themes/dracula'
import everforestDark from '@adea-ai/themes/themes/everforest-dark'
import everforestLight from '@adea-ai/themes/themes/everforest-light'
import gruvboxDark from '@adea-ai/themes/themes/gruvbox-dark'
import gruvboxLight from '@adea-ai/themes/themes/gruvbox-light'
import { createEffect, createMemo, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  ACCENTS,
  accentForeground,
  formatOklch,
  parseColor,
  shadcnVariables,
  themeAccentPresets,
} from '@adea-ai/themes'
import {
  AppearanceEditor,
  AppearancePopover,
  type AppearanceDraft,
} from '../../src/components/composites/appearance-editor'
import '../../src/styles/globals.css'

// A disposable host adapter demonstrates the editor's ports. Product persistence
// and native capability acceptance require the real application composition.
// The catalogue is long enough that a theme menu overflows its fixed cap, so
// the internal scroll the appearance preferences promise is under test, not a
// two-row list that never overflows anything.
const themes = [
  adeaLight,
  adeaDark,
  ayu,
  ayuLight,
  ayuMirage,
  catppuccinFrappe,
  catppuccinLatte,
  catppuccinMacchiato,
  catppuccinMocha,
  dracula,
  everforestDark,
  everforestLight,
  gruvboxDark,
  gruvboxLight,
]
const defaults: AppearanceDraft = {
  mode: 'system',
  lightThemeId: 'adea-light',
  darkThemeId: 'adea-dark',
  terminalThemeId: 'theme',
  accent: 'theme',
  surface: 'theme',
  reduceTransparency: false,
}

function Fixture() {
  const [open, setOpen] = createSignal(false)
  const [committed, setCommitted] = createSignal({ ...defaults })
  const [draft, setDraft] = createSignal({ ...defaults })
  const [saving, setSaving] = createSignal(false)
  const pair = () => ({
    light: themes.find((candidate) => candidate.id === draft().lightThemeId)!,
    dark: themes.find((candidate) => candidate.id === draft().darkThemeId)!,
  })
  const theme = (appearance: 'light' | 'dark') => {
    const record = themes.find((candidate) => candidate.id === draft()[`${appearance}ThemeId`])!
    // A preset, or an accent the selected pair carries itself (`ansi-blue`).
    const accent =
      ACCENTS.find((candidate) => candidate.id === draft().accent) ??
      themeAccentPresets(pair().light, pair().dark).find(
        (candidate) => candidate.id === draft().accent
      )
    const value =
      accent?.[appearance] ?? (/^#[\da-f]{6}$/i.test(draft().accent) ? draft().accent : undefined)
    return value
      ? {
          ...record,
          colors: {
            ...record.colors,
            accent: formatOklch(parseColor(value)!),
            accentForeground: accentForeground(value),
          },
        }
      : record
  }
  const light = createMemo(() => theme('light'))
  const dark = createMemo(() => theme('dark'))
  const active = () => (draft().mode === 'light' ? light() : dark())
  createEffect(() => {
    for (const [name, value] of Object.entries(shadcnVariables(active())))
      document.documentElement.style.setProperty(name, value)
  })
  const custom = () =>
    draft().accent !== 'theme' &&
    !ACCENTS.some((accent) => accent.id === draft().accent) &&
    !draft().accent.startsWith('ansi-')
  const error = () =>
    custom() && !/^#[\da-f]{6}$/i.test(draft().accent) ? 'Use a six-digit hex color.' : undefined
  const dismiss = () => {
    setDraft({ ...committed() })
    setOpen(false)
  }
  return (
    <main>
      <button type="button" id="outside">
        Outside the editor
      </button>
      <div data-live-preview class="bg-background text-primary">
        Visible application
      </div>
      <AppearancePopover
        open={open()}
        onOpen={() => {
          setDraft({ ...committed() })
          setOpen(true)
        }}
        onDismiss={dismiss}
        draft={draft()}
        lightTheme={light()}
        darkTheme={dark()}
        resolvedAppearance="dark"
        themes={themes}
        accentOptions={ACCENTS}
        customAccentError={error()}
        saving={saving()}
        surfaceCapability={{ frosted: false, reason: 'Transparency is unavailable on this host.' }}
        onChange={(patch) => setDraft((value) => ({ ...value, ...patch }))}
        onReset={() => setDraft({ ...defaults })}
        onCancel={dismiss}
        onSave={() => {
          if (document.body.dataset['pendingSave'] === 'true') {
            setSaving(true)
            return
          }
          setCommitted({ ...draft() })
          setOpen(false)
        }}
      />
      <output aria-label="Committed preference">{JSON.stringify(committed())}</output>
      <output aria-label="Draft preference">{JSON.stringify(draft())}</output>
    </main>
  )
}

function InlineFixture() {
  return (
    <main>
      <button type="button">Before the editor</button>
      <AppearanceEditor
        draft={defaults}
        lightTheme={adeaLight}
        darkTheme={adeaDark}
        resolvedAppearance="dark"
        themes={themes}
        accentOptions={ACCENTS}
        surfaceCapability={{ frosted: false }}
        onChange={() => {}}
        onSave={() => {}}
        onCancel={() => {}}
        onReset={() => {}}
      />
      <button type="button">After the editor</button>
    </main>
  )
}

const inlineFixture = document.documentElement.dataset['appearanceFixture'] === 'inline'
render(() => (inlineFixture ? <InlineFixture /> : <Fixture />), document.body)

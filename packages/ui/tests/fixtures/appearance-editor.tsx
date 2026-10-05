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
  type AccentPreset,
  type AdeaTheme,
} from '@adea-ai/themes'
import {
  applyAppearanceFontSettings,
  fontSettingsBootstrapScript,
  normalizeAppearanceEditorFontSettings,
} from '../../src/lib/appearance-font-settings'
import {
  AppearanceEditor,
  AppearancePopover,
  type AppearanceDraft,
} from '../../src/components/composites/appearance-editor'
import '../../src/styles/globals.css'
import '../../src/styles/appearance-font-settings.css'

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

// A real host takes this list from `themeAccentsFor` in `@adea-ai/ui`, which
// applies the catalogue's accent floors through its normalization module. The
// packed renderer gate forbids that module in this bundle, so the disposable host
// pairs the themes' own ANSI slots directly: the editor's contract is to render
// and select whatever list it is handed, and the floors are unit-tested.
function offeredThemeAccents(light: AdeaTheme, dark: AdeaTheme): AccentPreset[] {
  return (['blue', 'magenta', 'cyan', 'green'] as const).map((slot) => ({
    id: `ansi-${slot}`,
    label: slot.charAt(0).toUpperCase() + slot.slice(1),
    description: `The theme's own ${slot} colour.`,
    light: light.ansi[slot],
    dark: dark.ansi[slot],
  }))
}

function Fixture() {
  const fontDefaults = normalizeAppearanceEditorFontSettings(undefined).settings
  const fontBootstrap = fontSettingsBootstrapScript('appearance')
  const fontApiSmoke = [
    `${fontDefaults.ui.size}/${fontDefaults.content.size}/${fontDefaults.code.size}`,
    String(fontBootstrap.includes('data-ui-font')),
  ].join(';')
  const [open, setOpen] = createSignal(false)
  const [committed, setCommitted] = createSignal({ ...defaults })
  const [draft, setDraft] = createSignal({ ...defaults })
  const [saving, setSaving] = createSignal(false)
  const pair = () => ({
    light: themes.find((candidate) => candidate.id === draft().lightThemeId)!,
    dark: themes.find((candidate) => candidate.id === draft().darkThemeId)!,
  })
  const themeAccents = createMemo(() => offeredThemeAccents(pair().light, pair().dark))
  const theme = (appearance: 'light' | 'dark') => {
    const record = themes.find((candidate) => candidate.id === draft()[`${appearance}ThemeId`])!
    // A preset, or an accent the selected pair carries itself (`ansi-blue`).
    const accent =
      ACCENTS.find((candidate) => candidate.id === draft().accent) ??
      themeAccents().find((candidate) => candidate.id === draft().accent)
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
    applyAppearanceFontSettings(document.documentElement, draft().fonts)
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
      <output hidden data-font-settings-api>
        {fontApiSmoke}
      </output>
      <button type="button" id="outside">
        Outside the editor
      </button>
      {/* Drives the stored-preference path the picker no longer offers as a
          swatch: a saved theme-accent id must survive until a choice replaces
          it. The host applies a stored preference, then opens the editor on
          it — so the control restores the draft and opens the sheet, the same
          sequence `onOpen` performs for a committed draft. */}
      <button
        type="button"
        onClick={() => {
          setDraft((value) => ({ ...value, accent: 'ansi-blue' }))
          setOpen(true)
        }}
      >
        Store a theme accent
      </button>
      <div data-live-preview class="bg-background text-primary">
        Visible application
      </div>
      <div aria-label="Typography preview">
        <p data-testid="content-font-preview" class="font-content text-content">
          Reading preview
        </p>
        <code data-testid="code-font-preview" class="font-code text-code">
          const preview = true
        </code>
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
        themeAccentOptions={themeAccents()}
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

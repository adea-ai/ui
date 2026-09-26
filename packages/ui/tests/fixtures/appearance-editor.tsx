import { createEffect, createMemo, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  ACCENTS,
  accentForeground,
  formatOklch,
  getTheme,
  parseColor,
  shadcnVariables,
} from '@adea-ai/themes'
import {
  AppearancePopover,
  type AppearanceDraft,
} from '../../src/components/composites/appearance-editor'
import '../../src/styles/globals.css'

// A disposable host adapter demonstrates the editor's ports. Product persistence
// and native capability acceptance require the real application composition.
const themes = ['adea-light', 'adea-dark', 'dracula', 'catppuccin-latte'].map((id) => getTheme(id)!)
const defaults: AppearanceDraft = {
  mode: 'system',
  lightThemeId: 'adea-light',
  darkThemeId: 'adea-dark',
  accent: 'theme',
  surface: 'theme',
  reduceTransparency: false,
}

function Fixture() {
  const [open, setOpen] = createSignal(false)
  const [committed, setCommitted] = createSignal({ ...defaults })
  const [draft, setDraft] = createSignal({ ...defaults })
  const [saving, setSaving] = createSignal(false)
  const theme = (appearance: 'light' | 'dark') => {
    const record = themes.find((candidate) => candidate.id === draft()[`${appearance}ThemeId`])!
    const accent = ACCENTS.find((candidate) => candidate.id === draft().accent)
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
    draft().accent !== 'theme' && !ACCENTS.some((accent) => accent.id === draft().accent)
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
render(() => <Fixture />, document.body)

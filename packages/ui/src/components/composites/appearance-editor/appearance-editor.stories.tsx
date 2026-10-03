import { ACCENTS } from '@adea-ai/themes'
import { createMemo, createSignal } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import {
  appearancePreviewThemes,
  isThemeAccentId,
  themeAccentsFor,
  themeRecordById,
} from '#lib/themes'
import { AppearanceEditor, AppearancePopover } from './appearance-editor'
import type { AppearanceDraft } from './appearance-types'

// A catalogue long enough that the theme menus exercise their internal
// scroll: a two-row list never overflows the fixed cap, so a regression to
// adaptive sizing would be invisible in the workshop.
const themes = [
  'adea-light',
  'adea-dark',
  'ayu',
  'ayu-light',
  'ayu-mirage',
  'catppuccin-frappe',
  'catppuccin-latte',
  'catppuccin-macchiato',
  'catppuccin-mocha',
  'dracula',
  'everforest-dark',
  'everforest-light',
  'gruvbox-dark',
  'gruvbox-light',
].map((id) => themeRecordById(id)!)
const defaults: AppearanceDraft = {
  mode: 'system',
  lightThemeId: 'adea-light',
  darkThemeId: 'adea-dark',
  terminalThemeId: 'theme',
  accent: 'theme',
  surface: 'theme',
  reduceTransparency: false,
}

// A controlled composition only. Application preview, persistence and native
// transparency are explicit host ports, not library-side global mutations.
function Example(props: {
  popup?: boolean
  saving?: boolean
  recovery?: boolean
  empty?: boolean
}) {
  const [draft, setDraft] = createSignal({ ...defaults })
  const [committed, setCommitted] = createSignal({ ...defaults })
  const [open, setOpen] = createSignal(false)
  // The ids-to-records adapter the package exports: it resolves a preset or a
  // theme-carried accent onto both preview themes, as ThemeProvider would.
  const preview = createMemo(() => appearancePreviewThemes(draft()))
  const cancel = () => {
    setDraft({ ...committed() })
    setOpen(false)
  }
  const editor = () => ({
    draft: draft(),
    lightTheme: preview().lightTheme,
    darkTheme: preview().darkTheme,
    resolvedAppearance: 'dark' as const,
    themes: props.empty ? [] : themes,
    accentOptions: ACCENTS,
    themeAccentOptions: themeAccentsFor(draft().lightThemeId, draft().darkThemeId),
    saving: props.saving,
    recoveryNotice: props.recovery
      ? 'An unavailable saved theme was restored to Adea Dark.'
      : undefined,
    surfaceCapability: { frosted: false, reason: 'Transparency is unavailable on this host.' },
    onChange: (patch: Partial<AppearanceDraft>) => setDraft((value) => ({ ...value, ...patch })),
    onReset: () => setDraft({ ...defaults }),
    onCancel: cancel,
    onSave: () => {
      setCommitted({ ...draft() })
      setOpen(false)
    },
    customAccentError:
      draft().accent !== 'theme' &&
      !ACCENTS.some((accent) => accent.id === draft().accent) &&
      !isThemeAccentId(draft().accent)
        ? 'Custom colors are validated by the host; this example accepts presets.'
        : undefined,
  })
  return (
    <div class="w-full max-w-lg">
      {props.popup ? (
        <AppearancePopover
          {...editor()}
          open={open()}
          onOpen={() => setOpen(true)}
          onDismiss={cancel}
        />
      ) : (
        <AppearanceEditor {...editor()} />
      )}
    </div>
  )
}
const meta = {
  title: 'Composites/AppearanceEditor',
  component: Example,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Example>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { render: () => <Example /> }
export const AnchoredPopup: Story = { render: () => <Example popup /> }
export const PendingSave: Story = { render: () => <Example saving /> }
export const RecoveredPreferences: Story = { render: () => <Example recovery /> }
export const EmptyThemeCatalogue: Story = { render: () => <Example empty /> }

import { ACCENTS, accentForeground, getTheme } from '@adea-ai/themes'
import { createMemo, createSignal } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { AppearanceEditor, AppearancePopover } from './appearance-editor'
import type { AppearanceDraft } from './appearance-types'

const themes = ['adea-light', 'adea-dark', 'dracula', 'catppuccin-latte'].map((id) => getTheme(id)!)
const defaults: AppearanceDraft = {
  mode: 'system',
  lightThemeId: 'adea-light',
  darkThemeId: 'adea-dark',
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
  const theme = (appearance: 'light' | 'dark') => {
    const record = getTheme(draft()[`${appearance}ThemeId`])!
    const accent = ACCENTS.find((option) => option.id === draft().accent)?.[appearance]
    return accent
      ? {
          ...record,
          colors: { ...record.colors, accent, accentForeground: accentForeground(accent) },
        }
      : record
  }
  const light = createMemo(() => theme('light'))
  const dark = createMemo(() => theme('dark'))
  const cancel = () => {
    setDraft({ ...committed() })
    setOpen(false)
  }
  const editor = () => ({
    draft: draft(),
    lightTheme: light(),
    darkTheme: dark(),
    resolvedAppearance: 'dark' as const,
    themes: props.empty ? [] : themes,
    accentOptions: ACCENTS,
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
      draft().accent !== 'theme' && !ACCENTS.some((accent) => accent.id === draft().accent)
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

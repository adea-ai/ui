import { createEffect, createSignal, For, onCleanup, onMount, type JSX } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS } from '#lib/appearance-font-settings'
import { stepAppearanceFontSizes } from '#lib/font-zoom'
import { themeSurfaces, type ThemeSurface } from '#lib/theme-surface'
import { themeById } from '#lib/themes'
import { Button } from '../ui/button/button'
import { useTheme } from './theme-context'
import { ThemeSwatch } from './theme-picker'
import type { ThemeSelection } from './theme-state'

/**
 * The shared provider's axes, shown on the workshop's own provider.
 *
 * Every story holds a *draft* on the document with `preview()` while it is mounted
 * and ends it on cleanup. That is the point of the choice: the workshop mounts one
 * `ThemeProvider` for the whole canvas, a second one would fight it for `<html>`,
 * and a draft is exactly what the provider offers for "show this without
 * committing it". Nothing here writes the stored preference.
 *
 * Provider props are fixed when a provider is created, so `editorRoles`, `palette`,
 * `themes`, `accentContrastFloor` and the `fontZoom` chords cannot be switched on
 * from a story. They are exercised against a real provider in
 * `apps/storybook/tests/component-theme-provider.spec.ts`, and described in
 * `docs/consumption.md`.
 */
const meta = {
  title: 'Composites/Theme provider',
  parameters: { layout: 'padded' },
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

/**
 * The workshop's decorator calls a story's `render` before it mounts the provider
 * (see `.storybook/preview.tsx`), so a component that reads the context has to be
 * created later, as a child, once the provider is above it.
 */
// A function child is what Solid resolves lazily; the cast is only for `JSX.Element`.
const later = (node: () => JSX.Element) => node as unknown as JSX.Element

/** Hold `draft` on the document while the story is mounted, then let it go. */
function useDraft(draft: () => Partial<ThemeSelection> | undefined) {
  const theme = useTheme()
  createEffect(() => theme.preview(draft()))
  onCleanup(() => theme.preview(undefined))
}

/**
 * What the provider wrote to `<html>`, read back from the document itself.
 *
 * Observed rather than derived from signals: the point of the readout is what landed
 * on the element, and the provider's effect and the story's do not run in a fixed
 * order.
 */
function useDocumentReadout(names: readonly string[]) {
  const [values, setValues] = createSignal<Record<string, string>>({})
  const read = () => {
    const root = document.documentElement
    const computed = getComputedStyle(root)
    setValues(
      Object.fromEntries(
        names.map((name) => [
          name,
          name.startsWith('--')
            ? computed.getPropertyValue(name).trim() || '(not set)'
            : (root.getAttribute(name) ?? '(not set)'),
        ])
      )
    )
  }
  onMount(() => {
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true })
    onCleanup(() => observer.disconnect())
  })
  return values
}

function Readout(props: { rows: Record<string, string> }) {
  return (
    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <For each={Object.entries(props.rows)}>
        {([name, value]) => (
          <>
            <dt class="text-muted-foreground font-mono">{name}</dt>
            <dd class="text-foreground font-mono break-all">{value}</dd>
          </>
        )}
      </For>
    </dl>
  )
}

function Choices<T extends string>(props: {
  label: string
  options: readonly T[]
  value: T
  onChange: (next: T) => void
}): JSX.Element {
  return (
    <div role="group" aria-label={props.label} class="flex flex-wrap gap-2">
      <For each={props.options}>
        {(option) => (
          <Button
            size="sm"
            variant="outline"
            aria-pressed={props.value === option}
            onClick={() => props.onChange(option)}
          >
            {option}
          </Button>
        )}
      </For>
    </div>
  )
}

function Section(props: { title: string; children: JSX.Element }) {
  return (
    <section class="border-border bg-card text-card-foreground flex max-w-2xl flex-col gap-4 rounded-lg border p-4">
      <h2 class="text-base font-semibold">{props.title}</h2>
      {props.children}
    </section>
  )
}

function PreviewDemo() {
  const theme = useTheme()
  const [accent, setAccent] = createSignal<string | undefined>()
  useDraft(() => (accent() === undefined ? undefined : { accent: accent()! }))
  return (
    <Section title="Preview a draft">
      <p class="text-muted-foreground text-sm">
        The document follows the draft; <code>selection()</code> still answers with what is stored,
        and ending the draft puts the committed look back without a write.
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setAccent(accent() === 'amber' ? undefined : 'amber')}>
          {accent() === undefined ? 'Preview amber' : 'End preview'}
        </Button>
      </div>
      <Readout
        rows={{
          'previewing()': String(theme.previewing()),
          'selection().accent': theme.selection().accent,
          'draft accent': accent() ?? '(none)',
        }}
      />
    </Section>
  )
}

/** A draft over the committed selection, and the committed selection untouched. */
export const Preview: Story = { render: () => later(() => <PreviewDemo />) }

const SURFACE_PROPS = ['data-surface', 'data-reduce-transparency', '--surface-alpha'] as const

function SurfaceDemo(props: { surface: ThemeSurface; reduce?: boolean }) {
  const [surface, setSurface] = createSignal<ThemeSurface>(props.surface)
  const [reduce, setReduce] = createSignal(props.reduce === true)
  useDraft(() => ({ surface: surface(), reduceTransparency: reduce() }))
  const written = useDocumentReadout(SURFACE_PROPS)
  return (
    <Section title="Surface">
      <Choices
        label="Surface preference"
        options={themeSurfaces}
        value={surface()}
        onChange={setSurface}
      />
      <Button
        size="sm"
        variant="outline"
        aria-pressed={reduce()}
        onClick={() => setReduce(!reduce())}
      >
        Reduce transparency
      </Button>
      {/* The frost rule styles a modal dialog, so a dialog is what shows the axis. */}
      <div class="bg-muted grid grid-cols-4 gap-2 rounded-md p-3">
        <For each={[1, 2, 3, 4, 5, 6, 7, 8]}>{() => <span class="bg-border block h-4" />}</For>
        <div
          role="dialog"
          aria-label="Frost sample"
          class="border-border bg-background text-foreground col-span-4 rounded-md border p-3 text-sm"
        >
          The panel's fill keeps <code>--surface-alpha</code> of the canvas while the preference
          asks for glass, and is opaque under either reduced-transparency path.
        </div>
      </div>
      <p class="text-muted-foreground text-sm">
        This workshop's provider declares no native translucency, so <code>translucent</code> paints
        the tokenized <code>frosted</code> surface.
      </p>
      <Readout rows={written()} />
    </Section>
  )
}

/** The tokenized frost, which the sweep measures in both default themes. */
export const Surface: Story = { render: () => later(() => <SurfaceDemo surface="frosted" />) }
export const Translucent: Story = {
  render: () => later(() => <SurfaceDemo surface="translucent" />),
}
/** The user's own switch forces the opaque surface whatever the preference says. */
export const ReducedTransparency: Story = {
  render: () => later(() => <SurfaceDemo surface="frosted" reduce />),
}

const TERMINAL_PINS = ['theme', 'catppuccin-mocha', 'catppuccin-latte'] as const

function TerminalPinDemo() {
  const theme = useTheme()
  const [pin, setPin] = createSignal<(typeof TERMINAL_PINS)[number]>('catppuccin-mocha')
  useDraft(() => ({ terminalThemeId: pin() }))
  const written = useDocumentReadout(['--terminal-background', '--terminal-foreground'])
  const pinned = () => themeById(pin())
  return (
    <Section title="Pinned terminal palette">
      <Choices label="Terminal theme" options={TERMINAL_PINS} value={pin()} onChange={setPin} />
      <div class="flex items-center gap-3 text-sm">
        <span class="text-muted-foreground">Interface</span>
        <ThemeSwatch theme={theme.variant()} size="sm" />
        <span class="text-muted-foreground">Terminal</span>
        <ThemeSwatch theme={pinned() ?? theme.variant()} size="sm" />
      </div>
      <p class="text-muted-foreground text-sm">
        The pin is written over the interface variant's own <code>--terminal-*</code> properties, so
        a light interface can carry a dark terminal. <code>theme</code> follows the interface.
      </p>
      <Readout rows={written()} />
    </Section>
  )
}

export const TerminalPin: Story = { render: () => later(() => <TerminalPinDemo />) }

const ACCENTS = ['theme', 'violet', 'ansi-blue', '#ff6600', '#202020', '#f0f0f0'] as const

function AccentDemo() {
  const [accent, setAccent] = createSignal<(typeof ACCENTS)[number]>('#202020')
  useDraft(() => ({ accent: accent() }))
  const written = useDocumentReadout(['data-accent', '--primary', '--primary-foreground'])
  return (
    <Section title="Accent">
      <Choices label="Accent" options={ACCENTS} value={accent()} onChange={setAccent} />
      <div class="flex flex-wrap items-center gap-2">
        <Button size="sm">Primary action</Button>
        <Button size="sm" variant="outline">
          Secondary
        </Button>
      </div>
      <p class="text-muted-foreground text-sm">
        A preset, a theme-carried <code>ansi-*</code> slot, or a custom <code>#rrggbb</code>, which
        is raised to the 3:1 floor when it is painted and reported as{' '}
        <code>data-accent=custom</code>. The near-black starts below the floor on a dark canvas and
        the near-white on a light one, so what is painted differs from what is stored.
      </p>
      <Readout rows={written()} />
    </Section>
  )
}

export const Accent: Story = { render: () => later(() => <AccentDemo />) }

function FontZoomDemo() {
  const theme = useTheme()
  const [fonts, setFonts] = createSignal<ThemeSelection['fonts']>()
  useDraft(() => (fonts() === undefined ? undefined : { fonts: fonts() }))
  const current = () =>
    fonts() ?? theme.selection().fonts ?? DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS
  return (
    <Section title="Font zoom">
      <p class="text-muted-foreground text-sm">
        The three text sizes step together, one pixel at a time. With the provider's{' '}
        <code>fontZoom</code> prop the Cmd or Ctrl chords do this; <code>zoomFonts()</code> does it
        from a menu, and persists. The buttons below preview the same step.
      </p>
      <div class="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setFonts(stepAppearanceFontSizes(current(), -1))}
        >
          Zoom out
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setFonts(stepAppearanceFontSizes(current(), 1))}
        >
          Zoom in
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setFonts({ ...DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS })}
        >
          Reset
        </Button>
      </div>
      <Readout
        rows={{
          'ui size': String(current().ui.size),
          'content size': String(current().content.size),
          'code size': String(current().code.size),
        }}
      />
    </Section>
  )
}

export const FontZoom: Story = { render: () => later(() => <FontZoomDemo />) }

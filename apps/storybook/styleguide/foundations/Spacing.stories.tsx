import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Badge, Button, densityTokens, Input, Switch } from '@adea-ai/ui'
import { For } from 'solid-js'
import { TokenTable, TokenRow } from './token-preview'

/**
 * Spacing and density.
 *
 * Spacing is Tailwind's 4px scale, used directly — `gap-2`, `p-4`, `px-3`. There
 * is no second spacing vocabulary, because two of them is how one view ends up
 * with 12px gutters and another with 16px.
 *
 * What the design system *does* own is **density**: the heights of controls and
 * rows, and the inline padding that pairs with each height. Those are tokens
 * because they have to agree across components — a `Button` and a `Select` at
 * the same size are the same height because they read the same token, not
 * because two authors agreed.
 */
const meta = {
  title: 'Foundations/Spacing and density',
  component: () => null,
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const densityRows = [
  { size: '2xs', usage: 'An inline chip control.' },
  { size: 'xs', usage: 'A dense table row action.' },
  {
    size: 'sm',
    usage: 'The toolbar default. 28px is the most common control height in the system.',
  },
  { size: 'md', usage: 'The form default. Button and Input unless told otherwise.' },
  { size: 'lg', usage: 'A primary form action.' },
  { size: 'xl', usage: 'A hero control in an empty state.' },
] as const

/**
 * The control ladder. Everything pressable is one of these six heights — there
 * is no seventh, and a component that needs one is usually two components.
 */
export const ControlSizes: Story = {
  render: () => (
    <div class="flex flex-col gap-5">
      <For each={densityRows}>
        {(row) => (
          <div class="flex items-center gap-6 border-b border-border pb-4 last:border-b-0">
            <div class="w-64 shrink-0">
              <code class="text-xs font-medium">
                size=&quot;{row.size}&quot; ·{' '}
                {
                  (
                    densityTokens.find((t) => t.name === `control-height-${row.size}`)
                      ?.description ?? ''
                  ).split('—')[0]
                }
              </code>
              <p class="text-xs text-muted-foreground">{row.usage}</p>
            </div>
            <div class="flex items-center gap-3">
              <Button size={row.size}>Button</Button>
              <Button size={row.size} variant="outline">
                Outline
              </Button>
              <Badge
                size={
                  row.size === '2xs' || row.size === 'xs' ? 'sm' : row.size === 'sm' ? 'md' : 'lg'
                }
              >
                Badge
              </Badge>
            </div>
          </div>
        )}
      </For>
    </div>
  ),
}

/**
 * Density is how much room the same component takes, not a different component.
 *
 * The compact rung tightens row heights and control padding. Both are legible;
 * the choice is about how much a user is doing at once.
 */
export const Density: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-4">
      <p class="text-sm text-muted-foreground">
        A toolbar of seven controls at <code>size=&quot;sm&quot;</code> is 28px tall and reads as an
        instrument panel. The same seven at <code>size=&quot;xl&quot;</code> is 40px and reads as a
        form. Neither is wrong — the rule is that everything in one row is the same rung.
      </p>
      <div class="flex flex-col gap-3 rounded-xl border border-border p-4">
        <div class="text-sm font-medium">A toolbar: one rung, one row</div>
        <div class="flex flex-wrap items-center gap-2">
          <Button size="sm">Run</Button>
          <Button size="sm" variant="outline">
            Stop
          </Button>
          <Button size="sm" variant="ghost">
            Clear
          </Button>
          <Badge size="md" variant="success">
            3 passed
          </Badge>
          <Badge size="md" variant="warning">
            1 skipped
          </Badge>
        </div>
        <p class="text-xs text-muted-foreground">
          The failure mode this prevents is a row where a 28px button sits beside a 36px select: the
          row looks broken, and no amount of padding fixes it.
        </p>
      </div>
    </div>
  ),
}

/** The heights and inline paddings, with the resolved values. */
export const DensityTokens: Story = {
  render: () => (
    <TokenTable>
      <For each={densityTokens.filter((token) => token.name.startsWith('control-height'))}>
        {(token) => (
          <TokenRow
            token={token}
            preview={
              <div
                class="rounded-sm bg-primary-subtle"
                style={{ height: `var(--${token.name})`, width: '7rem' }}
              />
            }
          />
        )}
      </For>
    </TokenTable>
  ),
}

/** The shell geometry: the fixed widths the window layout is built from. */
export const ShellGeometry: Story = {
  render: () => (
    <TokenTable>
      <For
        each={densityTokens.filter(
          (token) =>
            token.name.includes('rail') ||
            token.name.includes('sidebar-width') ||
            token.name.includes('topbar') ||
            token.name.includes('statusbar') ||
            token.name.includes('row-height')
        )}
      >
        {(token) => (
          <TokenRow
            token={token}
            preview={
              <div
                class="rounded-sm border border-border bg-surface-hover"
                style={{ height: `var(--${token.name})`, width: '7rem' }}
              />
            }
          />
        )}
      </For>
    </TokenTable>
  ),
}

/**
 * A real settings row: the pattern the density tokens exist to serve.
 *
 * Label and description leading, control trailing, one divider between rows.
 * This is the shape every settings page in both applications takes, which is why
 * it is a composite (`SettingsRow`) rather than something each page arranges.
 */
export const SettingsRowPattern: Story = {
  render: () => (
    <div class="w-144 divide-y divide-border rounded-xl border border-border">
      <div class="flex items-center justify-between gap-4 p-4">
        <div class="flex flex-col gap-0.5">
          <div class="text-sm font-medium">Run on a schedule</div>
          <p class="text-sm text-muted-foreground">
            Start the soak lane every night at 02:00 local time.
          </p>
        </div>
        <Switch aria-label="Run on a schedule" defaultChecked />
      </div>
      <div class="flex items-center justify-between gap-4 p-4">
        <div class="flex flex-col gap-0.5">
          <div class="text-sm font-medium">Workspace name</div>
          <p class="text-sm text-muted-foreground">Shown to anyone you invite.</p>
        </div>
        <Input class="w-56" value="Adea" aria-label="Workspace name" />
      </div>
      <div class="flex items-center justify-between gap-4 p-4">
        <div class="flex flex-col gap-0.5">
          <div class="text-sm font-medium">Delete workspace</div>
          <p class="text-sm text-muted-foreground">
            Removes the workspace for everyone. This cannot be undone.
          </p>
        </div>
        <Button variant="destructive">Delete</Button>
      </div>
    </div>
  ),
}

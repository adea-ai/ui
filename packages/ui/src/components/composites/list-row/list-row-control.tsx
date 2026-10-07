import type { PolymorphicProps } from '@kobalte/core/polymorphic'
import { Polymorphic } from '@kobalte/core/polymorphic'
import type { ComponentProps, JSX, ValidComponent } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '#lib/utils'

export type ListRowControlProps<T extends ValidComponent = 'div'> = PolymorphicProps<
  T,
  {
    class?: string
    /** Marks the row as current. Sets `aria-current` for a link row. */
    selected?: boolean
    /** Draw the row at the compact height. */
    dense?: boolean
    /** Leading slot: an avatar, an icon, a checkbox. */
    leading?: JSX.Element
    /** Trailing slot: a count, a menu trigger, a timestamp. */
    trailing?: JSX.Element
    /** A second line that wraps and grows the row to fit its content. */
    description?: string
    /**
     * Whether a described row may drop its trailing slot onto its own line when
     * the row gets narrow (the default). Pass `false` for a short, truncating
     * label whose single action must stay beside it.
     */
    stackTrailing?: boolean
    /** Native button type; defaults to `button` for button rows. */
    type?: ComponentProps<'button'>['type']
  }
>

type ListRowControlBaseProps<T extends ValidComponent = 'div'> = ListRowControlProps<T> & {
  as?: T
}

/** A tree-shakeable ListRow renderer without optional tooltip behavior. */
export function ListRowControl<T extends ValidComponent = 'div'>(props: ListRowControlProps<T>) {
  const [local, rest] = splitProps(props as ListRowControlBaseProps, [
    'as',
    'class',
    'selected',
    'dense',
    'leading',
    'trailing',
    'description',
    'stackTrailing',
    'type',
    'tabIndex',
    'children',
  ])
  const hasClickHandler = () => Boolean(rest.onClick || rest['on:click'])
  const rowAs = () => (local.as ?? (hasClickHandler() ? 'button' : 'div')) as T

  return (
    <Polymorphic
      as={rowAs()}
      data-slot="list-row"
      type={rowAs() === 'button' ? (local.type ?? 'button') : local.type}
      tabIndex={local.tabIndex ?? (rowAs() === 'button' || rowAs() === 'a' ? 0 : undefined)}
      aria-current={local.selected ? 'true' : undefined}
      data-selected={local.selected ? '' : undefined}
      data-description={local.description ? '' : undefined}
      data-stack-trailing={local.stackTrailing === false ? 'never' : undefined}
      class={cn(
        'group/row list-row-description flex min-w-0 items-center gap-2.5 rounded-md px-2 text-sm',
        'transition-colors ease-out outline-none',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        {
          'h-row-sm': local.dense && !local.description,
          'h-row-md': !local.dense && !local.description,
        },
        {
          'bg-primary-subtle text-foreground': local.selected,
          'hover:bg-surface-hover': !local.selected,
        },
        local.class
      )}
      {...(rest as ComponentProps<'div'>)}
    >
      <Show when={local.leading}>
        <span
          data-slot="list-row-leading"
          class="flex shrink-0 items-center justify-center [&_svg]:size-4"
        >
          {local.leading}
        </span>
      </Show>
      <div data-slot="list-row-content" class="flex min-w-0 flex-1 items-center gap-2.5">
        <span data-slot="list-row-label" class="flex min-w-0 flex-1 flex-col">
          <span class="truncate">{local.children}</span>
          <Show when={local.description}>
            <span
              data-slot="list-row-description"
              class={cn(
                'text-xs break-words',
                local.selected ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {local.description}
            </span>
          </Show>
        </span>
        <Show when={local.trailing}>
          <span
            data-slot="list-row-trailing"
            class={cn(
              'ms-auto flex shrink-0 items-center gap-1',
              local.selected ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {local.trailing}
          </span>
        </Show>
      </div>
    </Polymorphic>
  )
}

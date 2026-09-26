import {
  CommandDialog as CmdkDialog,
  CommandEmpty as CmdkEmpty,
  CommandGroup as CmdkGroup,
  CommandInput as CmdkInput,
  CommandItem as CmdkItem,
  CommandList as CmdkList,
  CommandLoading as CmdkLoading,
  CommandRoot as CmdkRoot,
  CommandSeparator as CmdkSeparator,
  useCommandState,
} from 'cmdk-solid'
import { Search } from 'lucide-solid'
import type { ComponentProps } from 'solid-js'
import { createEffect, createSignal, splitProps } from 'solid-js'
import { menuItem } from '../../../lib/overlay'
import { cn } from '../../../lib/utils'

/**
 * Command.
 *
 * The command palette: a filtered list of everything the user can do, ranked
 * by fuzzy match. It is the one place in an app where a keyboard-first surface
 * is the *primary* one, so it carries rules the rest of the system does not:
 *
 *   - Every item must be reachable by typing its name. If a user has to
 *     remember which group it lives in, the palette has failed at its job.
 *   - Groups exist for reading, not for navigation. The ranking crosses them.
 *   - The empty state is not an apology — it should offer the closest thing
 *     the app could guess, or say plainly that nothing matched.
 *
 * cmdk-solid supplies the filter, the scoring, the `aria-activedescendant`
 * wiring and the arrow-key navigation.
 */
export function Command(props: ComponentProps<typeof CmdkRoot>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <CmdkRoot
      class={cn(
        'bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-xl',
        local.class
      )}
      {...rest}
    />
  )
}

export function CommandDialog(props: ComponentProps<typeof CmdkDialog>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <CmdkDialog
      class={cn(
        'bg-popover text-popover-foreground fixed top-1/3 left-1/2 z-(--z-dialog) w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
        'overflow-hidden rounded-xl border border-border shadow-xl',
        'data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95',
        'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
        local.class
      )}
      {...rest}
    />
  )
}

export function CommandInput(props: ComponentProps<typeof CmdkInput>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <div
      data-slot="command-input-wrapper"
      class="flex h-11 items-center gap-2 border-b border-border px-3"
    >
      <Search class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <CmdkInput
        class={cn(
          'h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50',
          local.class
        )}
        {...rest}
      />
    </div>
  )
}

/**
 * The scrolling list.
 *
 * Two DOM corrections, and both are deliberate. cmdk builds a `role="listbox"`
 * whose children include two elements ARIA does not allow there:
 *
 *   - a bare `<div cmdk-list-sizer>` with no role, wrapped around every group;
 *   - a `<div cmdk-separator role="separator">`, and `separator` is a menu and
 *     toolbar role — inside a listbox the only owned elements may be `option`
 *     and `group`.
 *
 * Both are pure presentation: the sizer is layout, and the separator is a
 * hairline between groups that the groups already structure. `role="presentation"`
 * is their accurate role rather than a workaround — each is flattened out of the
 * accessibility tree, and the options inside are reached exactly as before.
 *
 * Written onto the mounted nodes rather than through props, because cmdk owns
 * this markup and does not forward a `ref`; in an effect rather than `onMount`,
 * because cmdk renders the sizer with the first item, after the list itself.
 */
export function CommandList(props: ComponentProps<typeof CmdkList>) {
  const [local, rest] = splitProps(props, ['class'])
  const [wrapper, setWrapper] = createSignal<HTMLDivElement>()
  const resultCount = useCommandState((state) => state.filtered.count)

  createEffect(() => {
    const root = wrapper()
    if (!root) return
    for (const selector of ['[cmdk-list-sizer]', '[cmdk-separator]']) {
      root.querySelector(selector)?.setAttribute('role', 'presentation')
    }

    /*
     * A `listbox` must own at least one `option`, so a listbox with nothing in it
     * is invalid ARIA — which is what a search with no matches produces. When
     * there are no results the list is inert, so it becomes presentational and
     * the empty message carries the information instead. It keeps its `id`, so
     * the input's `aria-controls` still resolves.
     */
    root
      .querySelector('[cmdk-list]')
      ?.setAttribute('role', resultCount() > 0 ? 'listbox' : 'presentation')
  })

  return (
    <div ref={setWrapper} class="contents">
      <CmdkList
        class={cn('max-h-80 scroll-py-1 overflow-y-auto overflow-x-hidden p-1', local.class)}
        {...rest}
      />
    </div>
  )
}

export function CommandEmpty(props: ComponentProps<typeof CmdkEmpty>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <CmdkEmpty
      /*
       * A status rather than plain text: when the list is presentational, this is
       * the only thing that tells a screen reader the search matched nothing.
       */
      role="status"
      class={cn('text-muted-foreground py-8 text-center text-sm', local.class)}
      {...rest}
    />
  )
}

export function CommandGroup(props: ComponentProps<typeof CmdkGroup>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <CmdkGroup
      class={cn(
        'text-foreground overflow-hidden p-1',
        '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase',
        local.class
      )}
      {...rest}
    />
  )
}

export function CommandItem(props: ComponentProps<typeof CmdkItem>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <CmdkItem
      class={cn(
        menuItem,
        'data-[selected=true]:bg-surface-hover data-[selected=true]:text-foreground',
        local.class
      )}
      {...rest}
    />
  )
}

export function CommandSeparator(props: ComponentProps<typeof CmdkSeparator>) {
  const [local, rest] = splitProps(props, ['class'])
  return <CmdkSeparator class={cn('bg-border -mx-1 my-1 h-px', local.class)} {...rest} />
}

export function CommandLoading(props: ComponentProps<typeof CmdkLoading>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <CmdkLoading
      class={cn('text-muted-foreground py-6 text-center text-sm', local.class)}
      {...rest}
    />
  )
}

/** The keyboard hint a palette item usually carries. */
export function CommandShortcut(props: {
  class?: string
  children?: ComponentProps<'span'>['children']
}) {
  return (
    <span
      class={cn('text-muted-foreground ms-auto font-mono text-2xs tracking-widest', props.class)}
    >
      {props.children}
    </span>
  )
}

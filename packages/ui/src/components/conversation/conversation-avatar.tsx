import type { ComponentProps } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { Bot, Sparkles, User } from 'lucide-solid'
import { cn } from '#lib/utils'

/**
 * ConversationAvatar.
 *
 * The speaker's mark in a transcript. Three kinds, and the distinction matters
 * visually: a person, an agent, and the system itself are different *voices*, and a
 * transcript where all three look alike is one the reader has to decode line by
 * line.
 *
 * The avatar is decorative — the speaker's name is in the message's accessible name
 * — so it is `aria-hidden` and carries no text of its own. A caller with a real
 * image passes it as children.
 */
export type ConversationAvatarKind = 'user' | 'agent' | 'system'

export type ConversationAvatarProps = ComponentProps<'span'> & {
  kind: ConversationAvatarKind
  /** Draw the mark larger, for the sender's own messages. */
  size?: 'md' | 'lg'
}

const GLYPHS = { user: User, agent: Bot, system: Sparkles } as const

export function ConversationAvatar(props: ConversationAvatarProps) {
  const [local, rest] = splitProps(props, ['class', 'kind', 'size', 'children'])

  return (
    <span
      data-slot="conversation-avatar"
      aria-hidden="true"
      class={cn(
        'grid shrink-0 place-items-center rounded-full border border-border',
        local.size === 'lg' ? 'size-8' : 'size-7',
        {
          'bg-primary-subtle text-primary': local.kind === 'user',
          'bg-card text-foreground': local.kind === 'agent',
          'bg-muted text-muted-foreground': local.kind === 'system',
        },
        local.class
      )}
      {...rest}
    >
      <Show
        when={local.children}
        fallback={
          <span class="grid size-4 place-items-center [&_svg]:size-4">
            <Dynamic component={GLYPHS[local.kind]} />
          </span>
        }
      >
        {local.children}
      </Show>
    </span>
  )
}

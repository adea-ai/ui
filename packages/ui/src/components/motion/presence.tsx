import type { ComponentProps, JSX } from 'solid-js'
import { Presence as MotionPresence } from 'solid-motionone'

/**
 * Presence.
 *
 * Enter and exit animation with a guarantee the CSS approach cannot make: an exit
 * that is **interrupted** — a menu reopened while it is still closing — returns the
 * element to its shown state instead of finishing the close and then reopening,
 * which is what a class-based `animate-out` does and what makes a fast user's
 * interactions feel like the interface is lagging behind them.
 *
 * The design system uses CSS transitions for state changes (a hover, a press) and
 * this for mounting and unmounting, which is the split that keeps the common case
 * free of a runtime while making the rare case correct.
 *
 *   <Show when={open()}>
 *     <Presence initial={{ opacity: 0, scale: 0.96 }} exit={{ opacity: 0, scale: 0.96 }}>
 *       <div>…</div>
 *     </Presence>
 *   </Show>
 *
 * `Presence` keeps the child mounted until its exit finishes, so the `<Show>` above
 * can stay the only condition in the tree.
 */
export type PresenceProps = ComponentProps<typeof MotionPresence> & {
  children?: JSX.Element
}

export function Presence(props: PresenceProps) {
  return <MotionPresence {...props} />
}

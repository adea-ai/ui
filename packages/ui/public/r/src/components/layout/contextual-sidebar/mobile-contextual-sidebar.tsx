import type { Accessor, JSX } from 'solid-js'
import { cn } from '../../../lib/utils'
import { Sheet, SheetContent } from '../../ui/sheet'

export type MobileContextualSidebarProps = {
  open: boolean
  onOpenChange(open: boolean): void
  label: string
  sheetClass?: string
  restoreFocusRef?: Accessor<HTMLElement | undefined>
  renderSidebar(): JSX.Element
}

/** Sheet wrappers are loaded only when a contextual sidebar enters mobile mode. */
export function MobileSidebar(props: MobileContextualSidebarProps) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side="start"
        aria-label={props.label}
        // The sheet leaves the app rail visible beside it: at most 19rem, never
        // under 9rem, and otherwise the viewport less the rail's width.
        class={cn(
          'w-[min(19rem,max(9rem,calc(100vw-var(--rail-width,3.5rem))))] max-w-[min(19rem,max(9rem,calc(100vw-var(--rail-width,3.5rem))))] gap-0 p-0',
          props.sheetClass
        )}
        restoreFocusRef={props.restoreFocusRef}
      >
        {props.renderSidebar()}
      </SheetContent>
    </Sheet>
  )
}

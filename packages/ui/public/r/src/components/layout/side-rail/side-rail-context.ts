import { createContext, createMemo, useContext } from 'solid-js'

/**
 * The side rail's collapse state, shared with its items.
 *
 * A rail has two forms — icon-only and labelled — and every item has to agree
 * about which is showing. Threading a `collapsed` prop through each item would
 * work in a demo and break in practice, because an app composes its rail from
 * several components (a brand, a section, a footer) and would have to remember
 * to pass the flag to all of them.
 *
 * Context makes the rail's form a property of the rail rather than an argument
 * every caller repeats. The items still decide what to *do* about it: a hidden
 * label must become a tooltip, not simply disappear.
 */
type SideRailContextValue = {
  collapsed: () => boolean
  /** Width the rail occupies, so a layout can reserve it without measuring. */
  width: () => string
}

const SideRailContext = createContext<SideRailContextValue>()

export function useSideRail(): SideRailContextValue {
  const value = useContext(SideRailContext)
  if (!value) {
    throw new Error('useSideRail must be called inside a <SideRail>.')
  }
  return value
}

export { SideRailContext }

export function createSideRailValue(
  collapsed: () => boolean,
  width: () => string
): SideRailContextValue {
  return {
    collapsed: createMemo(() => collapsed()),
    width,
  }
}

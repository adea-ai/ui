import type { ComponentProps } from 'solid-js'
import { createContext, createMemo, splitProps, useContext, type Accessor } from 'solid-js'
import { cn } from '../../../lib/utils'

/** A CSS length or expression used to place an item away from the orbit center. */
export type OrbitRadius = number | string
export type OrbitLayoutMode = 'radial' | 'flow'

const DEFAULT_ORBIT_RADIUS = 'calc(50% - 2rem)'
const OrbitRadiusContext = createContext<Accessor<string>>()
const OrbitModeContext = createContext<Accessor<OrbitLayoutMode>>()

function resolveRadius(radius: OrbitRadius | undefined): string {
  if (typeof radius === 'number') return `${Number.isFinite(radius) ? Math.max(0, radius) : 0}px`
  return radius?.trim() || DEFAULT_ORBIT_RADIUS
}

/**
 * OrbitLayout.
 *
 * Provides a positioned canvas and a shared radius for its OrbitItems. It does
 * not assign list semantics or alter DOM order: callers choose semantics, and
 * keyboard and screen-reader order remain the source order of the children.
 */
export type OrbitLayoutProps = Omit<ComponentProps<'div'>, 'style'> & {
  /** JSX style props are owned by this geometry primitive. */
  style?: never
  /** Responsive radius used by every OrbitItem unless that item overrides it. */
  radius?: OrbitRadius
  /** `flow` places items in source order; `radial` positions them around the host. */
  mode?: OrbitLayoutMode
}

export function OrbitLayout(props: OrbitLayoutProps) {
  const [local, rest] = splitProps(props, ['class', 'radius', 'mode', 'style', 'children'])
  const radius = createMemo(() => resolveRadius(local.radius))
  const mode = createMemo(() => local.mode ?? 'radial')

  return (
    <OrbitRadiusContext.Provider value={radius}>
      <OrbitModeContext.Provider value={mode}>
        <div
          {...rest}
          data-slot="orbit-layout"
          class={cn(mode() === 'flow' ? 'grid gap-3' : 'relative size-full', local.class)}
        >
          {local.children}
        </div>
      </OrbitModeContext.Provider>
    </OrbitRadiusContext.Provider>
  )
}

/**
 * OrbitItem.
 *
 * Positions one ordinary child around its OrbitLayout. This is geometry only:
 * the wrapper has no role, tabindex, or interaction of its own.
 */
export type OrbitItemProps = Omit<ComponentProps<'div'>, 'style'> & {
  /** JSX style props are owned by this geometry primitive. */
  style?: never
  /**
   * Zero-based position in the rendered sequence. Index 0 sits at three o'clock
   * (the positive x axis) and the sequence runs clockwise, because the y axis
   * points down the screen: with four items, 0 is east, 1 south, 2 west, 3 north.
   */
  index: number
  /** Number of items sharing this orbit. */
  count: number
  /** Per-item override for OrbitLayout's responsive radius. */
  radius?: OrbitRadius
}

export function OrbitItem(props: OrbitItemProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'index',
    'count',
    'radius',
    'style',
    'children',
  ])
  const inheritedRadius = useContext(OrbitRadiusContext)
  const inheritedMode = useContext(OrbitModeContext)
  const mode = () => inheritedMode?.() ?? 'radial'
  const radius = () =>
    local.radius !== undefined
      ? resolveRadius(local.radius)
      : (inheritedRadius?.() ?? DEFAULT_ORBIT_RADIUS)
  const angle = createMemo(() => {
    const count = Number.isFinite(local.count) ? Math.max(1, Math.trunc(local.count)) : 1
    const rawIndex = Number.isFinite(local.index) ? Math.trunc(local.index) : 0
    const index = ((rawIndex % count) + count) % count
    return `${(index / count) * Math.PI * 2}rad`
  })
  const positionStyle = () =>
    mode() === 'flow'
      ? undefined
      : {
          top: `calc(50% + sin(${angle()}) * ${radius()})`,
          left: `calc(50% + cos(${angle()}) * ${radius()})`,
          translate: '-50% -50%',
        }

  return (
    <div
      {...rest}
      data-slot="orbit-item"
      class={cn(mode() === 'flow' ? undefined : 'absolute', local.class)}
      style={positionStyle()}
    >
      {local.children}
    </div>
  )
}

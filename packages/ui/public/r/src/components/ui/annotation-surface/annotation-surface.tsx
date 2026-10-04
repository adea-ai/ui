import {
  createEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  Show,
  splitProps,
  type JSX,
} from 'solid-js'
import { cn } from '../../../lib/utils'
import './annotation-surface.css'
import {
  clampSurfaceFraction,
  normalizedSurfacePoint,
  type AnnotationSurfacePoint,
} from './geometry'

export type AnnotationSurfaceRegion = Readonly<{
  x: number
  y: number
  width: number
  height: number
}>

export type AnnotationSurfaceDrag = Readonly<{
  start: AnnotationSurfacePoint
  current: AnnotationSurfacePoint
}>

export type AnnotationSurfaceTool = 'region' | 'point'
export type AnnotationSurfaceDragPhase = 'start' | 'move' | 'end' | 'cancel' | 'keyboard'
export type AnnotationSurfacePointerEvent = PointerEvent & { currentTarget: HTMLDivElement }
export type AnnotationSurfaceKeyboardEvent = KeyboardEvent & { currentTarget: HTMLDivElement }
export type AnnotationSurfaceInputEvent =
  | AnnotationSurfacePointerEvent
  | AnnotationSurfaceKeyboardEvent

type SurfaceElementProps = Pick<JSX.HTMLAttributes<HTMLDivElement>, 'id' | 'aria-describedby'>

export type AnnotationSurfaceProps = SurfaceElementProps & {
  /** Accessible instructions for the keyboard-operated surface. */
  label: string
  /** Region draws a captured drag; point reports a single placement point. */
  tool: AnnotationSurfaceTool
  /** Normalized 0..1 geometry supplied by the host; absent means no region. */
  region?: AnnotationSurfaceRegion
  /** Visible idle guidance. It is hidden while a region is present. */
  hint?: JSX.Element
  /** Disable new drawing while the host is busy. Defaults to true. */
  interactive?: boolean
  /** Changing this value cancels an in-flight drag owned by the host context. */
  resetKey?: string | number
  /** Receives one normalized point in point mode. */
  onPoint?: (point: AnnotationSurfacePoint, event: AnnotationSurfaceInputEvent) => void
  /** Receives drag phases; cancel has no drag and fires at most once per capture. */
  onDragChange?: (
    drag: AnnotationSurfaceDrag | undefined,
    phase: AnnotationSurfaceDragPhase,
    event?: AnnotationSurfaceInputEvent
  ) => void
  /** Domain keyboard policy stays with the host and receives the native event. */
  onKeyDown?: (event: AnnotationSurfaceKeyboardEvent) => void
  /** Ref to the actual focusable and pointer-capturing HTMLDivElement. */
  ref?: (element: HTMLDivElement) => void
  /** Layout only; appearance remains owned by the shared component. */
  class?: string
}

type ActiveDrag = AnnotationSurfaceDrag & {
  pointerId: number
  target: HTMLDivElement
}

function pointFrom(event: PointerEvent, target: HTMLDivElement): AnnotationSurfacePoint {
  const bounds = target.getBoundingClientRect()
  return normalizedSurfacePoint(event.clientX, event.clientY, bounds)
}

/**
 * AnnotationSurface.
 *
 * A keyboard-focusable, viewport-shaped drawing surface for hosts that own an
 * annotation domain. It renders normalized region geometry and idle guidance,
 * captures region drags, and reports normalized points without reading or
 * rendering screenshot pixels. The host keeps tool policy, domain geometry,
 * persistence and capture commands.
 *
 * This bespoke application widget is necessary because a generic button or
 * slider cannot represent a two-dimensional drawing viewport. Its keyboard
 * behavior is supplied by the host and forwarded as a native key event. Space
 * creates a centered region or places a point at the center; Escape is left to
 * the host first, which can prevent the default gesture cancellation while it
 * applies its own draft and mode rules.
 */
export function AnnotationSurface(props: AnnotationSurfaceProps) {
  const [local] = splitProps(props, [
    'id',
    'aria-describedby',
    'label',
    'tool',
    'region',
    'hint',
    'interactive',
    'resetKey',
    'onPoint',
    'onDragChange',
    'onKeyDown',
    'ref',
    'class',
  ])

  const [dragging, setDragging] = createSignal(false)
  const hintId = createUniqueId()
  let activeDrag: ActiveDrag | undefined
  let previousResetKey = local.resetKey
  let previousTool = local.tool

  const isInteractive = () => local.interactive ?? true

  function releaseCapture(drag: ActiveDrag): void {
    try {
      if (drag.target.hasPointerCapture(drag.pointerId))
        drag.target.releasePointerCapture(drag.pointerId)
    } catch {
      // The browser may release capture while a host reset or unmount is running.
    }
  }

  function cancelDrag(event?: AnnotationSurfaceInputEvent, release = true): void {
    const drag = activeDrag
    if (!drag) return

    activeDrag = undefined
    setDragging(false)
    if (release) releaseCapture(drag)
    local.onDragChange?.(undefined, 'cancel', event)
  }

  createEffect(() => {
    const resetKey = local.resetKey
    const tool = local.tool
    const interactive = isInteractive()
    if (activeDrag && (resetKey !== previousResetKey || tool !== previousTool || !interactive)) {
      cancelDrag()
    }
    previousResetKey = resetKey
    previousTool = tool
  })

  onCleanup(() => cancelDrag())

  function handlePointerDown(event: AnnotationSurfacePointerEvent): void {
    if (!isInteractive() || !event.isPrimary || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    const point = pointFrom(event, event.currentTarget)
    if (activeDrag) return

    if (local.tool === 'point') {
      local.onPoint?.(point, event)
      return
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // A drag without real pointer capture can lose its final coordinates.
      return
    }

    const drag: ActiveDrag = {
      pointerId: event.pointerId,
      target: event.currentTarget,
      start: point,
      current: point,
    }
    activeDrag = drag
    setDragging(true)
    local.onDragChange?.({ start: point, current: point }, 'start', event)
  }

  function handlePointerMove(event: AnnotationSurfacePointerEvent): void {
    const drag = activeDrag
    if (!drag || drag.pointerId !== event.pointerId) return

    const current = pointFrom(event, event.currentTarget)
    activeDrag = { ...drag, current }
    local.onDragChange?.({ start: drag.start, current }, 'move', event)
  }

  function handlePointerUp(event: AnnotationSurfacePointerEvent): void {
    const drag = activeDrag
    if (!drag || drag.pointerId !== event.pointerId) return

    const current = pointFrom(event, event.currentTarget)
    activeDrag = undefined
    setDragging(false)
    releaseCapture(drag)
    local.onDragChange?.({ start: drag.start, current }, 'end', event)
  }

  function handlePointerCancel(event: AnnotationSurfacePointerEvent): void {
    if (activeDrag?.pointerId === event.pointerId) cancelDrag(event)
  }

  function handleLostPointerCapture(event: AnnotationSurfacePointerEvent): void {
    if (activeDrag?.pointerId === event.pointerId) cancelDrag(event, false)
  }

  function handleKeyDown(event: AnnotationSurfaceKeyboardEvent): void {
    local.onKeyDown?.(event)
    if (event.key === 'Escape') {
      if (!event.defaultPrevented) cancelDrag()
      return
    }
    if (
      event.defaultPrevented ||
      !isInteractive() ||
      event.key !== ' ' ||
      event.repeat ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      activeDrag
    )
      return

    event.preventDefault()
    if (local.tool === 'point') {
      local.onPoint?.({ x: 0.5, y: 0.5 }, event)
      return
    }

    local.onDragChange?.(
      {
        start: { x: 0.25, y: 0.25 },
        current: { x: 0.75, y: 0.75 },
      },
      'keyboard',
      event
    )
  }

  const visibleRegion = (): AnnotationSurfaceRegion | undefined => {
    const region = local.region
    if (!region) return undefined
    const x = clampSurfaceFraction(region.x)
    const y = clampSurfaceFraction(region.y)
    return {
      x,
      y,
      width: Math.min(clampSurfaceFraction(region.width), 1 - x),
      height: Math.min(clampSurfaceFraction(region.height), 1 - y),
    }
  }

  const describedBy = () =>
    [local['aria-describedby'], local.hint && !visibleRegion() ? hintId : undefined]
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <div
      id={local.id}
      aria-describedby={describedBy()}
      role="application"
      aria-roledescription="annotation surface"
      aria-label={local.label}
      aria-disabled={isInteractive() ? undefined : 'true'}
      tabIndex={0}
      data-tool={local.tool}
      data-dragging={dragging() ? 'true' : 'false'}
      class={cn(
        'dev-annotation-surface relative isolate block w-full aspect-video select-none overflow-hidden rounded-md border border-border bg-muted/20 text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        local.class
      )}
      ref={(element) => local.ref?.(element)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handleLostPointerCapture}
      onKeyDown={handleKeyDown}
    >
      <Show when={visibleRegion()}>
        {(region) => (
          <svg
            class="dev-annotation-surface__region pointer-events-none absolute inset-0 size-full"
            viewBox="0 0 10000 10000"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect
              class="fill-primary-subtle stroke-primary"
              x={region().x * 10_000}
              y={region().y * 10_000}
              width={region().width * 10_000}
              height={region().height * 10_000}
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
            />
          </svg>
        )}
      </Show>
      <Show when={local.hint && !visibleRegion()}>
        <span
          id={hintId}
          class="dev-annotation-surface__hint pointer-events-none absolute inset-0 grid place-items-center p-4 text-center text-xs text-muted-foreground"
        >
          {local.hint}
        </span>
      </Show>
    </div>
  )
}

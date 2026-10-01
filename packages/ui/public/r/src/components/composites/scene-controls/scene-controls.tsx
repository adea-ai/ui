import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ZoomIn, ZoomOut } from 'lucide-solid'
import { createSignal, onCleanup, Show, type JSX } from 'solid-js'
import { ActionButton } from '../action-button'

/** A host-neutral direction reported while a movement control is held. */
export type SceneMovementDirection = 'forward' | 'left' | 'backward' | 'right'

/** Accessible names and tooltip text for the shared scene controls. */
export type SceneControlLabels = {
  movementGroup: string
  forward: string
  forwardTooltip: string
  left: string
  leftTooltip: string
  backward: string
  backwardTooltip: string
  right: string
  rightTooltip: string
  jump: string
  jumpTooltip: string
  zoomGroup: string
  zoomOut: string
  zoomIn: string
}

const DEFAULT_LABELS: SceneControlLabels = {
  movementGroup: 'Scene movement controls',
  forward: 'Move forward',
  forwardTooltip: 'Hold to move forward',
  left: 'Move left',
  leftTooltip: 'Hold to move left',
  backward: 'Move backward',
  backwardTooltip: 'Hold to move backward',
  right: 'Move right',
  rightTooltip: 'Hold to move right',
  jump: 'Jump',
  jumpTooltip: 'Hold to jump',
  zoomGroup: 'Camera zoom',
  zoomOut: 'Zoom out',
  zoomIn: 'Zoom in',
}

const pointerSource = (pointerId: number) => `pointer:${pointerId}`
const keySource = (key: string) => `key:${key}`

export type SceneControlsProps = {
  /** Called on the transition into and out of each held movement direction. */
  onMovementChange?: (direction: SceneMovementDirection, pressed: boolean) => void
  /** Called when the jump action becomes pressed or released. */
  onJumpChange?: (pressed: boolean) => void
  /** Called once when zoom in is activated. */
  onZoomIn?: () => void
  /** Called once when zoom out is activated. */
  onZoomOut?: () => void
  /** Override the default English accessible names and tooltip copy. */
  labels?: Partial<SceneControlLabels>
}

type HoldActionProps = {
  label: string
  tooltip: string
  createChangeCallback: () => (pressed: boolean) => void
  children: JSX.Element
}

/**
 * A held action that reports one down/up pair across pointer and keyboard input.
 *
 * The arrangement, rounded scrim group surfaces and release policy translate
 * Adea's on-screen scene controls; host key synthesis and scene APIs are replaced
 * by callbacks.
 */
function HoldAction(props: HoldActionProps) {
  const [pressed, setPressed] = createSignal(false)
  const sources = new Set<string>()
  let activeChangeCallback: ((pressed: boolean) => void) | undefined

  const press = (source: string) => {
    if (sources.has(source)) return
    const wasPressed = sources.size > 0
    sources.add(source)
    if (!wasPressed) {
      setPressed(true)
      activeChangeCallback = props.createChangeCallback()
      activeChangeCallback(true)
    }
  }

  const release = (source: string) => {
    if (!sources.delete(source) || sources.size > 0) return
    setPressed(false)
    const callback = activeChangeCallback
    activeChangeCallback = undefined
    callback?.(false)
  }

  const releaseAll = () => {
    if (sources.size === 0) return
    sources.clear()
    setPressed(false)
    const callback = activeChangeCallback
    activeChangeCallback = undefined
    callback?.(false)
  }

  const onWindowPointerUp = (event: PointerEvent) => release(pointerSource(event.pointerId))
  const onWindowBlur = () => releaseAll()

  if (typeof window !== 'undefined') {
    window.addEventListener('pointerup', onWindowPointerUp)
    window.addEventListener('blur', onWindowBlur)
  }

  onCleanup(() => {
    releaseAll()
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerup', onWindowPointerUp)
      window.removeEventListener('blur', onWindowBlur)
    }
  })

  return (
    <ActionButton
      type="button"
      variant="secondary"
      size="icon-2xl"
      aria-label={props.label}
      aria-pressed={pressed()}
      tooltip={props.tooltip}
      class="touch-none select-none"
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        const source = pointerSource(event.pointerId)
        if (sources.has(source)) return
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Pointer capture is not available in every embedded browser. The
          // window pointerup fallback still closes this held action.
        }
        press(source)
      }}
      onPointerUp={(event) => release(pointerSource(event.pointerId))}
      onPointerCancel={(event) => release(pointerSource(event.pointerId))}
      onLostPointerCapture={(event) => release(pointerSource(event.pointerId))}
      onKeyDown={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        press(keySource(event.key))
      }}
      onKeyUp={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        release(keySource(event.key))
      }}
      onBlur={releaseAll}
      onClick={(event) => {
        // Assistive technology can activate a button without pointer or keyboard
        // down/up events. Treat that activation as one short held action.
        if (event.detail !== 0 || sources.size > 0) return
        press('activation')
        release('activation')
      }}
    >
      {props.children}
    </ActionButton>
  )
}

/**
 * Shared movement, jump and zoom controls for a host-rendered scene.
 *
 * Movement and jump callbacks receive pressed/released state from pointer and
 * keyboard input. Zoom callbacks fire on activation. The host owns positioning,
 * scene state and camera behavior.
 */
export function SceneControls(props: SceneControlsProps) {
  const labels = () => ({ ...DEFAULT_LABELS, ...props.labels })

  return (
    <div class="flex min-w-0 max-w-full flex-wrap items-end gap-3">
      <Show when={props.onMovementChange}>
        <div
          role="group"
          aria-label={labels().movementGroup}
          class="glass-scrim grid min-w-0 max-w-full grid-cols-3 gap-1.5 rounded-3xl p-2"
        >
          <span aria-hidden="true" />
          <HoldAction
            label={labels().forward}
            tooltip={labels().forwardTooltip}
            createChangeCallback={() => {
              const callback = props.onMovementChange
              return (pressed) => callback?.('forward', pressed)
            }}
          >
            <ArrowUp aria-hidden="true" />
          </HoldAction>
          <span aria-hidden="true" />
          <HoldAction
            label={labels().left}
            tooltip={labels().leftTooltip}
            createChangeCallback={() => {
              const callback = props.onMovementChange
              return (pressed) => callback?.('left', pressed)
            }}
          >
            <ArrowLeft aria-hidden="true" />
          </HoldAction>
          <HoldAction
            label={labels().backward}
            tooltip={labels().backwardTooltip}
            createChangeCallback={() => {
              const callback = props.onMovementChange
              return (pressed) => callback?.('backward', pressed)
            }}
          >
            <ArrowDown aria-hidden="true" />
          </HoldAction>
          <HoldAction
            label={labels().right}
            tooltip={labels().rightTooltip}
            createChangeCallback={() => {
              const callback = props.onMovementChange
              return (pressed) => callback?.('right', pressed)
            }}
          >
            <ArrowRight aria-hidden="true" />
          </HoldAction>
        </div>
      </Show>
      <div class="ml-auto flex min-w-0 max-w-full flex-col items-end gap-2">
        <Show when={props.onZoomIn || props.onZoomOut}>
          <div
            role="group"
            aria-label={labels().zoomGroup}
            class="glass-scrim flex min-w-0 max-w-full flex-wrap gap-1.5 rounded-2xl p-1.5"
          >
            <Show when={props.onZoomOut}>
              <ActionButton
                type="button"
                variant="secondary"
                size="icon-2xl"
                aria-label={labels().zoomOut}
                tooltip={labels().zoomOut}
                onClick={() => props.onZoomOut?.()}
              >
                <ZoomOut aria-hidden="true" />
              </ActionButton>
            </Show>
            <Show when={props.onZoomIn}>
              <ActionButton
                type="button"
                variant="secondary"
                size="icon-2xl"
                aria-label={labels().zoomIn}
                tooltip={labels().zoomIn}
                onClick={() => props.onZoomIn?.()}
              >
                <ZoomIn aria-hidden="true" />
              </ActionButton>
            </Show>
          </div>
        </Show>
        <Show when={props.onJumpChange}>
          <HoldAction
            label={labels().jump}
            tooltip={labels().jumpTooltip}
            createChangeCallback={() => {
              const callback = props.onJumpChange
              return (pressed) => callback?.(pressed)
            }}
          >
            <ArrowUp aria-hidden="true" />
          </HoldAction>
        </Show>
      </div>
    </div>
  )
}

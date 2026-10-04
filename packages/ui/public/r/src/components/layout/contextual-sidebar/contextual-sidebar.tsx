import type { Accessor, JSX } from 'solid-js'
import { Show, createSignal, createUniqueId, onCleanup, onMount } from 'solid-js'
import { cn } from '../../../lib/utils'
import {
  SidebarNav,
  SidebarNavContent,
  SidebarNavFooter,
  SidebarNavHeader,
  SidebarNavTitle,
} from '../sidebar-nav/sidebar-nav'
import { PixelResizeHandle } from '../pixel-resize-handle/pixel-resize-handle'

type MobileModule = typeof import('./mobile-contextual-sidebar')
type MobileLoad = MobileModule | { error: unknown }

export type ContextualSidebarRenderContext = {
  /** Whether the slot is being rendered inside the modal mobile sheet. */
  mobile: boolean
  /** Mount nested popovers and menus inside the mobile dialog's accessibility tree. */
  portalMount(): HTMLElement | undefined
}

export type ContextualSidebarProps = {
  /** Stable host id prefix; generated when omitted. */
  id?: string
  /** Landmark name shared by the desktop and mobile navigation. */
  label: string
  /** Visible navigation title and mobile dialog title. */
  title: string
  /** Host-controlled expanded state for the desktop panel and mobile dialog. */
  open: boolean
  onOpenChange(open: boolean): void
  /** Current host-owned pixel width, reflected by the resize handle. */
  width: number
  minimum: number
  maximum: number
  step?: number
  /** Pass the host's initial viewport seed to distinguish stale desktop state. */
  wideViewportAtLoad?: boolean
  resizeLabel?: string
  /** Stable external opener used when the modal mobile sheet closes. */
  restoreFocusRef?: Accessor<HTMLElement | undefined>
  /** Called with the nav node so a host can project width onto its layout root. */
  onSidebarElement?: (element: HTMLElement | undefined, mobile: boolean) => void
  /** Host-owned layout classes applied to both nav instances. */
  sidebarClass?: string
  /** Host-owned responsive constraints for the modal sheet. */
  sheetClass?: string
  headerClass?: string
  contentClass?: string
  footerClass?: string
  headingAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  /** Optional action/content slot alongside the shared heading. */
  header?(context: ContextualSidebarRenderContext): JSX.Element
  /** View-specific navigation rows, projects, rooms, files, or sessions. */
  content(context: ContextualSidebarRenderContext): JSX.Element
  /** Optional view-specific footer, such as an archive affordance. */
  footer?(context: ContextualSidebarRenderContext): JSX.Element
  onWidthChange(width: number): void
  onWidthCommit?(width: number): void
}

/**
 * ContextualSidebar.
 *
 * Shared navigation geometry and interaction policy for an application's
 * contextual sidebar. The host keeps ownership of the actual grid width,
 * persisted preference, open state, and view-specific navigation content.
 */
export function ContextualSidebar(props: ContextualSidebarProps) {
  const [isNarrowViewport, setIsNarrowViewport] = createSignal(false)
  const [mobileLoad, setMobileLoad] = createSignal<MobileLoad>()
  let mobileRequested = false
  // Keep the resolved component mounted across viewport changes for Sheet cleanup.
  const loadMobile = () => {
    if (mobileRequested) return
    mobileRequested = true
    // Native module caching shares successful loads without keeping a rejected promise.
    void import('./mobile-contextual-sidebar').then(
      (module) => {
        if (mobileRequested) setMobileLoad(module)
      },
      (error: unknown) => {
        if (mobileRequested) setMobileLoad({ error })
      }
    )
  }
  const [mobileMount, setMobileMount] = createSignal<
    { element: HTMLElement; connected: boolean } | undefined
  >()
  const id = props.id ?? `contextual-sidebar-${createUniqueId()}`
  const resizeLabel = () => props.resizeLabel ?? `Resize ${props.label}`
  const portalMount = () => {
    const mount = mobileMount()
    return mount?.connected && mount.element.isConnected ? mount.element : undefined
  }

  onMount(() => {
    const media = window.matchMedia('(max-width: 48rem)')
    const updateViewport = () => {
      const wasNarrow = isNarrowViewport()
      if (media.matches) loadMobile()
      // Close before mounting a modal. A desktop-expanded host state is not
      // mobile intent, and opening the Sheet for one frame can steal focus.
      if (media.matches && !wasNarrow) props.onOpenChange(false)
      setIsNarrowViewport(media.matches)
    }

    // A route can mount after a wide-loaded host crosses into mobile. Clear
    // that stale seed, but preserve a sidebar intentionally opened at a
    // narrow boot viewport.
    if (media.matches) loadMobile()
    if (media.matches && props.wideViewportAtLoad && props.open) props.onOpenChange(false)
    setIsNarrowViewport(media.matches)
    media.addEventListener('change', updateViewport)
    onCleanup(() => {
      mobileRequested = false
      media.removeEventListener('change', updateViewport)
    })
  })

  const renderSidebar = (mobile: boolean) => {
    let element: HTMLElement | undefined
    const context: ContextualSidebarRenderContext = {
      mobile,
      portalMount: () => (mobile ? portalMount() : undefined),
    }
    const navigationId = `${id}-${mobile ? 'mobile' : 'desktop'}`

    onCleanup(() => {
      if (mobile && mobileMount()?.element === element) setMobileMount(undefined)
      element = undefined
      props.onSidebarElement?.(undefined, mobile)
    })

    return (
      <SidebarNav
        as="aside"
        id={navigationId}
        aria-label={props.label}
        aria-hidden={!mobile && !props.open ? 'true' : undefined}
        inert={!mobile && !props.open}
        data-contextual-sidebar={mobile ? 'mobile' : 'desktop'}
        data-open={mobile ? undefined : String(props.open)}
        ref={(node) => {
          element = node
          if (mobile) {
            setMobileMount({ element: node, connected: node.isConnected })
            queueMicrotask(() => {
              if (node.isConnected && mobileMount()?.element === node)
                setMobileMount({ element: node, connected: true })
            })
          }
          props.onSidebarElement?.(node, mobile)
        }}
        class={cn('relative h-full w-full max-w-full', props.sidebarClass)}
      >
        <Show when={!mobile && props.open}>
          <PixelResizeHandle
            side="left"
            value={props.width}
            minimum={props.minimum}
            maximum={props.maximum}
            step={props.step}
            label={resizeLabel()}
            controls={navigationId}
            onChange={props.onWidthChange}
            onCommit={props.onWidthCommit}
          />
        </Show>
        <Show when={!mobile || mobileMount()?.connected}>
          <SidebarNavHeader class={cn(mobile && 'pe-12', props.headerClass)}>
            <SidebarNavTitle as={props.headingAs ?? 'h2'}>{props.title}</SidebarNavTitle>
            {props.header?.(context)}
          </SidebarNavHeader>
          <SidebarNavContent class={props.contentClass}>{props.content(context)}</SidebarNavContent>
          {props.footer ? (
            <SidebarNavFooter class={props.footerClass}>{props.footer(context)}</SidebarNavFooter>
          ) : null}
        </Show>
      </SidebarNav>
    )
  }

  return (
    <>
      <Show when={!isNarrowViewport()}>{(_wide) => renderSidebar(false)}</Show>
      <Show when={mobileLoad()} keyed>
        {(loaded) => {
          if ('error' in loaded) throw loaded.error
          return (
            <loaded.MobileSidebar
              open={isNarrowViewport() && props.open}
              onOpenChange={props.onOpenChange}
              label={props.label}
              sheetClass={props.sheetClass}
              restoreFocusRef={props.restoreFocusRef}
              renderSidebar={() => renderSidebar(true)}
            />
          )
        }}
      </Show>
    </>
  )
}

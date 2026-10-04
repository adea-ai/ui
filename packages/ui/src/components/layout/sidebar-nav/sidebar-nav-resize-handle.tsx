import {
  PixelResizeHandle,
  type PixelResizeHandleProps,
} from '../pixel-resize-handle/pixel-resize-handle'

export type SidebarNavResizeHandleProps = Omit<PixelResizeHandleProps, 'side'>

/** Keep the established left-sidebar API as a thin adapter over the shared edge ruler. */
export function SidebarNavResizeHandle(props: SidebarNavResizeHandleProps) {
  return <PixelResizeHandle {...props} side="left" label={props.label ?? 'Resize navigation'} />
}

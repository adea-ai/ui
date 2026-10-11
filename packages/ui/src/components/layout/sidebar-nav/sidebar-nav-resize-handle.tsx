import {
  PixelResizeHandle,
  type PixelResizeHandleProps,
} from '../contextual-sidebar/pixel-resize-handle'

export type SidebarNavResizeHandleProps = Omit<PixelResizeHandleProps, 'side'>

/** Keep the established left-sidebar API as a thin adapter over the shared edge ruler. */
export function SidebarNavResizeHandle(props: SidebarNavResizeHandleProps) {
  return <PixelResizeHandle side="left" {...props} label={props.label ?? 'Resize navigation'} />
}

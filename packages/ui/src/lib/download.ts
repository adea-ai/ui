/** Download a Blob through a temporary, non-focusable anchor. */
export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const previousFocus = document.activeElement as HTMLElement | null
  let anchor: HTMLAnchorElement | undefined

  try {
    anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    anchor.hidden = true
    anchor.tabIndex = -1
    anchor.setAttribute('aria-hidden', 'true')
    document.body.append(anchor)
    anchor.click()
  } finally {
    try {
      anchor?.remove()
    } finally {
      try {
        if (previousFocus?.isConnected && document.activeElement !== previousFocus) {
          previousFocus.focus({ preventScroll: true })
        }
      } finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
      }
    }
  }
}

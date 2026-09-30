const CLIPBOARD_UNAVAILABLE = 'Clipboard is unavailable in this WebView'

/** Writes text with the async Clipboard API, falling back for older WebViews. */
export async function writeClipboardText(value: string): Promise<void> {
  if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
    await navigator.clipboard.writeText(value)
    return
  }

  if (typeof document === 'undefined' || !document.body) {
    throw new Error(CLIPBOARD_UNAVAILABLE)
  }

  const previousFocus = document.activeElement
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.setAttribute('aria-hidden', 'true')
  textarea.tabIndex = -1
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)

  let copied = false
  try {
    textarea.focus({ preventScroll: true })
    textarea.select()
    copied = typeof document.execCommand === 'function' && document.execCommand('copy')
  } finally {
    textarea.remove()
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
      try {
        previousFocus.focus({ preventScroll: true })
      } catch {
        // A host may revoke focus during the copy; preserve the clipboard outcome.
      }
    }
  }

  if (!copied) throw new Error(CLIPBOARD_UNAVAILABLE)
}

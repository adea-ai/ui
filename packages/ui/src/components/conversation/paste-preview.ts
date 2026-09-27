export const PASTE_PREVIEW_MAX_LINES = 12
export const PASTE_PREVIEW_MAX_CHARACTERS = 1200

export interface PastePreviewSummary {
  text: string
  hiddenLines: number
  hiddenCharacters: number
  scannedCharacters: number
}

/** Build a bounded preview without splitting or joining the full paste content. */
export function summarizePastePreview(content: string, totalLines: number): PastePreviewSummary {
  const scanLimit = Math.min(content.length, PASTE_PREVIEW_MAX_CHARACTERS)
  let end = 0
  let visibleLines = 1
  let scannedCharacters = 0

  while (end < scanLimit) {
    const character = content.charCodeAt(end)
    scannedCharacters += 1
    if (character === 10) {
      if (visibleLines === PASTE_PREVIEW_MAX_LINES) break
      visibleLines += 1
    }
    end += 1
  }

  const text = content.slice(0, end)
  return {
    text,
    hiddenLines: Math.max(0, totalLines - visibleLines),
    hiddenCharacters: Math.max(0, content.length - text.length),
    scannedCharacters,
  }
}

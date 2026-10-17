import { boundText } from '../sources/source'

/**
 * Where a restore stands. `idle` is the resting state of a checkpoint that has
 * not been restored from; the other three are only ever set because something
 * happened — the host passes them, or the component sets them from the promise
 * `onRestore` returned.
 */
export type CheckpointState = 'idle' | 'restoring' | 'restored' | 'failed'

/** The checkpoint's name as drawn; a blank label is the honest generic word. */
export function checkpointLabel(label: string | undefined): string {
  return (label ? boundText(label, 80) : '') || 'Checkpoint'
}

/**
 * The sentence for the status region. `idle` says nothing, because a
 * checkpoint that has not been touched makes no statement. A failure carries the
 * host's text when there is one.
 */
export function checkpointStatus(
  state: CheckpointState,
  error?: string,
  disabledReason?: string
): string | undefined {
  switch (state) {
    case 'restoring':
      return 'Restoring…'
    case 'restored':
      return 'Restored'
    case 'failed': {
      const detail = error ? boundText(error, 240) : ''
      return detail ? `Restore failed: ${detail}` : 'Restore failed'
    }
    case 'idle':
      return disabledReason ? boundText(disabledReason, 240) : undefined
  }
}

/**
 * The confirmation dialog's words. The host's `consequence` is what actually
 * names what will change, so it is used verbatim (bounded); without one the dialog
 * says only what a restore always means and does not guess at the rest.
 */
export function restoreDialogCopy(
  label: string | undefined,
  consequence: string | undefined
): { title: string; description: string } {
  return {
    title: `Restore to “${checkpointLabel(label)}”?`,
    description: consequence
      ? boundText(consequence, 400)
      : 'Restoring returns to this checkpoint.',
  }
}

/**
 * Whether the Restore control exists, and whether it can be used. It exists only
 * when the host passed a handler — a checkpoint that cannot be restored must not
 * look as if it can — and goes once the restore has succeeded.
 */
export function restoreControl(
  hasHandler: boolean,
  state: CheckpointState,
  disabledReason: string | undefined
): { visible: boolean; disabled: boolean } {
  return {
    visible: hasHandler && state !== 'restored',
    disabled: state === 'restoring' || disabledReason !== undefined,
  }
}

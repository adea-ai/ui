import { SettingsRow } from '../settings'
import { NativeSelect } from '../../ui/native-select'
import { createEffect, createSignal, onCleanup, Show, type Accessor } from 'solid-js'

import type { ChannelControlActions } from './update-dialog'

export type UpdateChannel = 'stable' | 'pre-release' | 'dev'

const CHANNEL_OPTIONS: ReadonlyArray<{ value: UpdateChannel; label: string }> = [
  { value: 'stable', label: 'Stable' },
  { value: 'pre-release', label: 'Pre-release' },
  { value: 'dev', label: 'Dev' },
]

const CHANNEL_DESCRIPTIONS: Record<UpdateChannel, string> = {
  stable: 'Tested releases after about four days in pre-release.',
  'pre-release': 'Daily pre-release builds arrive early, with rough edges included.',
  dev: 'Follows every dev build from main. Intended for development machines.',
}

export type UpdateChannelControlProps = {
  /** The dialog's channel actions; every save flows through `recheck`. */
  controls: ChannelControlActions
  /** Read the persisted channel. */
  read: () => Promise<UpdateChannel>
  /** Persist a selection; resolves with the channel that actually stuck. */
  persist: (value: UpdateChannel) => Promise<UpdateChannel>
  /** Disable beyond the dialog's own working state, e.g. a host save in flight. */
  disabled?: Accessor<boolean>
  /** Per-channel row descriptions, when the defaults don't fit the app. */
  descriptions?: Partial<Record<UpdateChannel, string>>
  /**
   * Re-read the persisted channel whenever this value changes. Supply it when
   * the channel can move while the dialog is closed — a service that gets torn
   * down, or a CLI writing the same setting — and hand it the dialog's `open`.
   */
  reloadOn?: Accessor<unknown>
}

/**
 * The updater dialog's release-channel row: one setting, a select trailing.
 * Every desktop application that ships channels presents the same three of
 * them with the same copy, which is why the row lives here rather than being
 * redrawn per app. A save always flows through the dialog's `recheck`, so a
 * channel switch re-asks the feed and the offer never outlives its channel.
 */
export function UpdateChannelControl(props: UpdateChannelControlProps) {
  const [channel, setChannel] = createSignal<UpdateChannel>('stable')
  const [loaded, setLoaded] = createSignal(false)
  const [saving, setSaving] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  createEffect(() => {
    props.reloadOn?.()
    let active = true
    onCleanup(() => {
      active = false
    })
    void props
      .read()
      .then((value) => {
        if (active) setChannel(value)
      })
      .catch(() => {
        if (active) setError('The current update channel could not be read.')
      })
      .finally(() => {
        if (active) setLoaded(true)
      })
  })

  const save = async (value: string) => {
    const next = value as UpdateChannel
    if (!loaded() || saving() || props.controls.disabled() || next === channel()) return
    const previous = channel()
    let persisted = false
    setChannel(next)
    setSaving(true)
    setError(null)

    try {
      await props.controls.recheck(async () => {
        try {
          const saved = await props.persist(next)
          setChannel(saved)
          persisted = true
        } catch (caught) {
          setChannel(previous)
          setError(
            caught instanceof Error ? caught.message : 'The update channel could not be saved.'
          )
          throw caught
        }
      })
    } catch (caught) {
      // The shared dialog renders the recheck failure. Roll back only if the
      // channel write itself failed; a failed feed check keeps the saved choice.
      if (!persisted) {
        setChannel(previous)
        setError(
          caught instanceof Error ? caught.message : 'The update channel could not be saved.'
        )
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div class="flex flex-col gap-2">
      <SettingsRow
        label="Update channel"
        description={props.descriptions?.[channel()] ?? CHANNEL_DESCRIPTIONS[channel()]}
      >
        <NativeSelect
          aria-label="Update channel"
          disabled={
            !loaded() || saving() || props.controls.disabled() || (props.disabled?.() ?? false)
          }
          value={channel()}
          options={CHANNEL_OPTIONS}
          onChange={(event) => void save(event.currentTarget.value)}
        />
      </SettingsRow>
      <Show when={error()}>{(message) => <p role="alert">{message()}</p>}</Show>
    </div>
  )
}

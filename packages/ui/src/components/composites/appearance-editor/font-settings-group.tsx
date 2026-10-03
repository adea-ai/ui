import { BookOpen, ChevronDown, Code2, PanelsTopLeft } from 'lucide-solid'
import { For, createMemo, createSignal, createUniqueId } from 'solid-js'
import { fontOptions } from '#lib/font-catalog'
import { Button } from '../../ui/button/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu/dropdown-menu'
import { InputControl } from '../../ui/input/input-control'
import { SettingsRow } from './appearance-rows'
import {
  APPEARANCE_EDITOR_FONT_SIZE_MAX,
  APPEARANCE_EDITOR_FONT_SIZE_MIN,
  normalizeAppearanceEditorFontSettings,
  normalizeAppearanceEditorFontSize,
  type AppearanceEditorFontAxis,
  type AppearanceEditorFontFamilyId,
  type AppearanceEditorFontSettings,
} from '#lib/appearance-font-settings'

export type AppearanceFontSettingsGroupProps = {
  settings: AppearanceEditorFontSettings
  onChange: (settings: AppearanceEditorFontSettings) => void
  disabled?: boolean
}

const FONT_ROWS = [
  {
    axis: 'ui',
    label: 'UI',
    description: 'Controls and interface labels.',
    icon: PanelsTopLeft,
  },
  {
    axis: 'content',
    label: 'Content',
    description: 'Reading and long-form text.',
    icon: BookOpen,
  },
  {
    axis: 'code',
    label: 'Code',
    description: 'Code, terminals, and file paths.',
    icon: Code2,
  },
] as const satisfies readonly {
  axis: AppearanceEditorFontAxis
  label: string
  description: string
  icon: typeof PanelsTopLeft
}[]

const catalogFontOptions = fontOptions.filter((option) => option.id !== 'system')

function FontFamilyMenu(props: {
  label: string
  family: AppearanceEditorFontFamilyId
  disabled?: boolean
  onSelect: (family: AppearanceEditorFontFamilyId) => void
}) {
  const selectedLabel = () =>
    fontOptions.find((option) => option.id === props.family)?.label ??
    fontOptions.find((option) => option.id === 'system')?.label ??
    'System'

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        as={Button}
        variant="outline"
        size="sm"
        aria-label={`${props.label} font family`}
        disabled={props.disabled}
        class="w-40 max-w-full justify-between"
      >
        <span class="truncate">{selectedLabel()}</span>
        <ChevronDown aria-hidden="true" class="ms-2 size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent hideArrow class="min-w-48">
        <DropdownMenuRadioGroup
          value={props.family}
          aria-label={`${props.label} system font`}
          onChange={(family) => {
            if (family === 'system') props.onSelect('system')
          }}
        >
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={props.family}
          aria-label={`${props.label} available fonts`}
          onChange={(family) => {
            const option = fontOptions.find((candidate) => candidate.id === family)
            if (option && option.id !== 'system') props.onSelect(option.id)
          }}
        >
          <For each={catalogFontOptions}>
            {(option) => (
              <DropdownMenuRadioItem value={option.id}>{option.label}</DropdownMenuRadioItem>
            )}
          </For>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Controlled font controls shared by AppearanceEditor and host-owned settings. */
export function AppearanceFontSettingsGroup(props: AppearanceFontSettingsGroupProps) {
  const [sizeDrafts, setSizeDrafts] = createSignal<
    Partial<Record<AppearanceEditorFontAxis, string>>
  >({})
  const sizeHintPrefix = createUniqueId()
  const settings = createMemo(() => normalizeAppearanceEditorFontSettings(props.settings).settings)

  const updateAxis = (
    axis: AppearanceEditorFontAxis,
    patch: { family?: AppearanceEditorFontFamilyId; size?: number }
  ) => {
    const current = settings()
    props.onChange({
      ...current,
      [axis]: {
        ...current[axis],
        ...patch,
      },
    })
  }

  const commitSize = (axis: AppearanceEditorFontAxis) => {
    const input = sizeDrafts()[axis]
    if (input === undefined) return
    const size = normalizeAppearanceEditorFontSize(input, settings()[axis].size)
    setSizeDrafts((current) => {
      const next = { ...current }
      delete next[axis]
      return next
    })
    if (size !== settings()[axis].size) updateAxis(axis, { size })
  }

  return (
    <>
      <For each={FONT_ROWS}>
        {(row) => {
          const Icon = row.icon
          const value = () => settings()[row.axis]
          const inputValue = () => sizeDrafts()[row.axis] ?? String(value().size)
          const sizeHintId = `${sizeHintPrefix}-${row.axis}-font-size-help`
          const sizeIsInvalid = () => {
            const draft = sizeDrafts()[row.axis]
            if (draft === undefined || draft.trim() === '') return false
            const parsed = Number(draft)
            return (
              !Number.isFinite(parsed) ||
              !Number.isInteger(parsed) ||
              parsed < APPEARANCE_EDITOR_FONT_SIZE_MIN ||
              parsed > APPEARANCE_EDITOR_FONT_SIZE_MAX
            )
          }
          return (
            <SettingsRow
              title={row.label}
              icon={<Icon />}
              description={row.description}
            >
              <div class="flex min-w-0 max-w-full items-center gap-2">
                <FontFamilyMenu
                  label={row.label}
                  family={value().family}
                  disabled={props.disabled}
                  onSelect={(family) => updateAxis(row.axis, { family })}
                />
                <div class="flex shrink-0 items-center gap-1">
                  <InputControl
                    type="number"
                    min={APPEARANCE_EDITOR_FONT_SIZE_MIN}
                    max={APPEARANCE_EDITOR_FONT_SIZE_MAX}
                    step={1}
                    value={inputValue()}
                    disabled={props.disabled}
                    aria-label={`${row.label} font size in pixels`}
                    aria-describedby={sizeHintId}
                    aria-invalid={sizeIsInvalid()}
                    class="w-16"
                    onInput={(event) =>
                      setSizeDrafts((current) => ({
                        ...current,
                        [row.axis]: event.currentTarget.value,
                      }))
                    }
                    onBlur={() => commitSize(row.axis)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      commitSize(row.axis)
                    }}
                  />
                  <span aria-hidden="true" class="text-xs text-muted-foreground">
                    px
                  </span>
                </div>
                <span id={sizeHintId} class="sr-only">
                  Enter a whole number from {APPEARANCE_EDITOR_FONT_SIZE_MIN} to{' '}
                  {APPEARANCE_EDITOR_FONT_SIZE_MAX} pixels.
                </span>
              </div>
            </SettingsRow>
          )
        }}
      </For>
    </>
  )
}

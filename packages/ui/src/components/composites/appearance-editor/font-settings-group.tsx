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
  menuPortalMount?: HTMLElement
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
const MENU_FOCUS_TARGET_SELECTOR =
  'a[href], area[href], button, input, select, textarea, iframe, [tabindex], [contenteditable], details > summary:first-of-type'

function isMenuTabStop(element: HTMLElement) {
  return (
    (element.tabIndex >= 0 ||
      (element.matches('details > summary:first-of-type') && !element.hasAttribute('tabindex'))) &&
    !element.matches(':disabled') &&
    element.getAttribute('aria-disabled') !== 'true' &&
    element.closest('[hidden], [inert], [aria-hidden="true"]') === null &&
    element.getClientRects().length > 0
  )
}

function FontFamilyMenu(props: {
  label: string
  family: AppearanceEditorFontFamilyId
  menuPortalMount?: HTMLElement
  disabled?: boolean
  onSelect: (family: AppearanceEditorFontFamilyId) => void
}) {
  const [menuOpen, setMenuOpen] = createSignal(false)
  const [restoreTriggerFocus, setRestoreTriggerFocus] = createSignal(false)
  const [triggerElement, setTriggerElement] = createSignal<HTMLButtonElement>()
  let focusTargetAfterTab: HTMLElement | undefined

  const moveFocusOnTab = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || event.isComposing) return

    const trigger = triggerElement()
    const owner = props.menuPortalMount
    const parentDialog = owner?.closest<HTMLElement>('[role="dialog"]')
    const focusScope = parentDialog ?? owner?.ownerDocument.body
    if (!trigger || !parentDialog || !focusScope) return

    const focusStops = Array.from(focusScope.querySelectorAll<HTMLElement>('*')).filter(
      (element) =>
        isMenuTabStop(element) &&
        element.closest('[role="menu"], [hidden], [inert], [aria-hidden="true"]') === null
    )
    const orderedFocusStops = [
      ...focusStops
        .filter((element) => element.tabIndex > 0)
        .toSorted((a, b) => a.tabIndex - b.tabIndex),
      ...focusStops.filter((element) => element.tabIndex <= 0),
    ]
    const triggerIndex = orderedFocusStops.indexOf(trigger)
    if (triggerIndex < 0) return
    const direction = event.shiftKey ? -1 : 1
    const adjacent =
      orderedFocusStops[triggerIndex + direction] ??
      (direction > 0 ? orderedFocusStops[0] : orderedFocusStops.at(-1))

    event.stopPropagation()
    setRestoreTriggerFocus(false)
    if (adjacent) {
      event.preventDefault()
      focusTargetAfterTab = adjacent
      setMenuOpen(false)
      adjacent.focus({ preventScroll: true })
    } else {
      focusTargetAfterTab = undefined
      setMenuOpen(false)
    }
  }
  const selectedLabel = () =>
    fontOptions.find((option) => option.id === props.family)?.label ??
    fontOptions.find((option) => option.id === 'system')?.label ??
    'System'

  return (
    <DropdownMenu
      modal={false}
      open={menuOpen()}
      onOpenChange={(open) => {
        setMenuOpen(open)
        if (open) setRestoreTriggerFocus(false)
      }}
    >
      <DropdownMenuTrigger
        ref={setTriggerElement}
        as={Button}
        variant="outline"
        size="sm"
        aria-label={`${props.label} font family`}
        disabled={props.disabled}
        class="w-32 max-w-full justify-between"
      >
        <span class="truncate">{selectedLabel()}</span>
        <ChevronDown aria-hidden="true" class="ms-2 size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        hideArrow
        portalMount={props.menuPortalMount}
        class="min-w-48"
        onFocusOutside={(event) => {
          // WebKit may briefly focus the owning Popover root while the menu's
          // focus scope starts. Keep the menu open for that transient target;
          // genuine focus moves to another control still dismiss it.
          if (
            !event.defaultPrevented &&
            props.menuPortalMount &&
            event.detail.originalEvent.target === props.menuPortalMount
          ) {
            setRestoreTriggerFocus(true)
            event.preventDefault()
          } else if (
            event.detail.originalEvent.target instanceof HTMLElement &&
            props.menuPortalMount?.contains(event.detail.originalEvent.target)
          ) {
            setRestoreTriggerFocus(false)
          }
        }}
        onInteractOutside={(event) => {
          if (event.detail.originalEvent.type !== 'pointerdown') return
          const owner = props.menuPortalMount
          const target = event.detail.originalEvent.target
          if (!(target instanceof Element) || !owner?.contains(target)) return

          const focusTarget = target.closest<HTMLElement>(MENU_FOCUS_TARGET_SELECTOR)
          setRestoreTriggerFocus(!focusTarget || !isMenuTabStop(focusTarget))
        }}
        onKeyDown={moveFocusOnTab}
        onEscapeKeyDown={() => setRestoreTriggerFocus(true)}
        onCloseAutoFocus={(event) => {
          if (menuOpen()) {
            event.preventDefault()
            return
          }
          if (focusTargetAfterTab) {
            const focusTarget = focusTargetAfterTab
            focusTargetAfterTab = undefined
            event.preventDefault()
            queueMicrotask(() => {
              if (!menuOpen() && focusTarget.isConnected) {
                focusTarget.focus({ preventScroll: true })
              }
            })
            return
          }
          if (!restoreTriggerFocus()) return

          event.preventDefault()
          setRestoreTriggerFocus(false)
          const trigger = triggerElement()
          if (
            trigger?.isConnected &&
            !trigger.disabled &&
            trigger.closest('[hidden], [inert], [aria-hidden="true"]') === null &&
            trigger.getClientRects().length > 0
          ) {
            trigger.focus({ preventScroll: true })
          }
        }}
      >
        <DropdownMenuRadioGroup
          value={props.family}
          aria-label={`${props.label} system font`}
          onChange={(family) => {
            if (family === 'system') props.onSelect('system')
          }}
        >
          <DropdownMenuRadioItem value="system" closeOnSelect>
            System
          </DropdownMenuRadioItem>
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
              <DropdownMenuRadioItem value={option.id} closeOnSelect>
                {option.label}
              </DropdownMenuRadioItem>
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
    <div class="global-appearance-font-settings">
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
            <section class="flex items-center gap-3 px-4 py-4" data-font-settings-row={row.axis}>
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-foreground/5 text-muted-foreground [&_svg]:size-4"
                aria-hidden="true"
              >
                <Icon />
              </span>
              {/* One line, always: the copy truncates rather than wrapping the
                  controls to a second line, so the family menu, the size field
                  and the title/subtitle stay aligned. The compact widths keep
                  that true at the appearance sheet's own width. */}
              <div class="min-w-0 flex-1">
                <h3 class="text-sm font-medium">{row.label}</h3>
                <div class="mt-0.5 truncate text-xs text-muted-foreground">{row.description}</div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <FontFamilyMenu
                  label={row.label}
                  family={value().family}
                  menuPortalMount={props.menuPortalMount}
                  disabled={props.disabled}
                  onSelect={(family) => updateAxis(row.axis, { family })}
                />
                <div class="flex items-center gap-1">
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
                    class="w-12"
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
            </section>
          )
        }}
      </For>
    </div>
  )
}

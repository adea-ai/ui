import { OctagonAlert, TriangleAlert } from 'lucide-solid'
import { For, Show, splitProps, type ComponentProps } from 'solid-js'
import { cn } from '#lib/utils'
import { Button } from '../../ui/button'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '../../ui/popover'
import { Progress } from '../../ui/progress'
import {
  breakdownRows,
  contextLabel,
  contextLevel,
  contextLevelWord,
  contextPercent,
  contextShort,
  formatCost,
  formatExact,
  hasContextFigures,
  isFigure,
  type ContextFigures,
  type ContextLevel,
} from './context-model'

/**
 * Context.
 *
 * How much of the model's context window is in use, as a compact trigger that
 * opens the figures behind it. It sits next to the composer, where the reader
 * decides whether to keep going or start fresh, so the trigger is small and the
 * detail is a press away rather than permanent chrome.
 *
 * ## Every figure is a claim, so every figure is optional
 *
 * A host passes whatever it knows: `used`, `total`, a `breakdown` (input, output,
 * cache read and write, reasoning), a `cost`. A missing value is omitted — never
 * drawn as 0, which would say "empty" about a window nobody measured — and when
 * *nothing* is known the trigger is not rendered at all (`hasContextFigures`).
 * Nothing is estimated here; the one derived row, "Remaining", appears only when
 * both `used` and `total` are known and `used` does not exceed `total`.
 *
 * ## Never colour alone
 *
 * The ring shows the fraction; past 75% the ring gives way to a warning glyph
 * (triangle, then octagon at 90% and above), the popover says "Getting full",
 * "Nearly full" or "Full" in words, and the trigger's accessible name speaks the
 * same. An overrun is reported as it is ("112%"); only the ring saturates.
 *
 * It is a `Popover`, not a hover card: the figures must be reachable by keyboard
 * and by touch, and Escape closes it and returns focus to the trigger.
 */
export type ContextProps = ContextFigures & {
  /** BCP 47 tag for number formatting. Defaults to `en-US`, so output is stable. */
  locale?: string
  placement?: ComponentProps<typeof Popover>['placement']
  class?: string
}

// A circle of radius 6 in a 16-unit box; the dash array is the fraction of this.
const RING_RADIUS = 6
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function Context(props: ContextProps) {
  const [local, figures] = splitProps(props, ['locale', 'placement', 'class'])
  const locale = () => local.locale ?? 'en-US'
  const percent = () => contextPercent(figures.used, figures.total)
  const level = (): ContextLevel => contextLevel(percent())
  const levelWord = () => contextLevelWord(level())
  const rows = () => breakdownRows(figures.breakdown)
  const remaining = () =>
    isFigure(figures.used) && isFigure(figures.total) && figures.used <= figures.total
      ? figures.total - figures.used
      : undefined
  const cost = () => (figures.cost && isFigure(figures.cost.amount) ? figures.cost : undefined)

  return (
    <Show when={hasContextFigures(figures)}>
      <Popover placement={local.placement ?? 'top'} gutter={6}>
        <PopoverTrigger
          as={Button}
          variant="ghost"
          size="xs"
          data-slot="context"
          data-level={level()}
          aria-label={contextLabel(figures, locale())}
          class={local.class}
        >
          <Show
            when={level() !== 'normal'}
            fallback={
              <Show when={percent() !== undefined}>
                <Ring percent={percent() ?? 0} />
              </Show>
            }
          >
            <span
              aria-hidden="true"
              class={cn({
                'text-warning': level() === 'high',
                'text-destructive': level() === 'critical' || level() === 'full',
              })}
            >
              <Show when={level() === 'high'} fallback={<OctagonAlert />}>
                <TriangleAlert />
              </Show>
            </span>
          </Show>
          <span aria-hidden="true" class="tabular-nums">
            {contextShort(figures, locale())}
          </span>
        </PopoverTrigger>
        <PopoverContent class="w-72 max-w-full">
          <PopoverTitle>Context window</PopoverTitle>
          <div class="flex flex-col gap-2 px-2 pb-2">
            <Show when={percent() !== undefined}>
              <Progress
                value={Math.min(percent() ?? 0, 100)}
                minValue={0}
                maxValue={100}
                label="Context used"
                getValueLabel={() => `${percent()}% used`}
              />
            </Show>
            <Show when={levelWord()}>
              <p
                class={cn('m-0 flex items-center gap-1.5 text-sm font-medium', {
                  'text-warning': level() === 'high',
                  'text-destructive': level() === 'critical' || level() === 'full',
                })}
              >
                <Show when={level() === 'high'} fallback={<OctagonAlert class="size-4" />}>
                  <TriangleAlert class="size-4" />
                </Show>
                <span class="text-foreground">{levelWord()}</span>
              </p>
            </Show>
            <dl class="m-0 flex flex-col gap-1 text-sm">
              <Show when={isFigure(figures.used)}>
                <Row label="Used" value={`${formatExact(figures.used ?? 0, locale())} tokens`} />
              </Show>
              <Show when={isFigure(figures.total)}>
                <Row label="Window" value={`${formatExact(figures.total ?? 0, locale())} tokens`} />
              </Show>
              <Show when={remaining() !== undefined}>
                <Row
                  label="Remaining"
                  value={`${formatExact(remaining() ?? 0, locale())} tokens`}
                />
              </Show>
              <For each={rows()}>
                {(row) => <Row label={row.label} value={formatExact(row.value, locale())} />}
              </For>
              <Show when={cost()}>
                {(value) => <Row label="Cost" value={formatCost(value(), locale())} />}
              </Show>
            </dl>
          </div>
        </PopoverContent>
      </Popover>
    </Show>
  )
}

function Ring(props: { percent: number }) {
  const filled = () => (RING_CIRCUMFERENCE * Math.min(Math.max(props.percent, 0), 100)) / 100
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" class="size-4">
      <circle cx="8" cy="8" r={RING_RADIUS} stroke-width="2" class="stroke-border" />
      <circle
        cx="8"
        cy="8"
        r={RING_RADIUS}
        stroke-width="2"
        stroke-linecap="round"
        stroke-dasharray={`${filled()} ${RING_CIRCUMFERENCE}`}
        transform="rotate(-90 8 8)"
        class="stroke-primary"
      />
    </svg>
  )
}

function Row(props: { label: string; value: string }) {
  return (
    <div class="flex items-baseline justify-between gap-4">
      <dt class="text-muted-foreground">{props.label}</dt>
      <dd class="m-0 text-end tabular-nums">{props.value}</dd>
    </div>
  )
}

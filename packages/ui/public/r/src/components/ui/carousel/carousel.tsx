import { createEffect, createSignal, For, onCleanup, Show, splitProps, type JSX } from 'solid-js'
import createEmblaCarousel from 'embla-carousel-solid'
import type { EmblaCarouselType } from 'embla-carousel'
import { ChevronLeft, ChevronRight } from 'lucide-solid'
import { cn } from '../../../lib/utils'
import { Button } from '../button'

/**
 * Carousel.
 *
 * A horizontal scroller with snap points, over embla. The primitive owns the
 * physics — momentum, snapping, drag — and this owns the two things a carousel
 * always needs and embla deliberately leaves to the caller: a keyboard path and a
 * way to tell how far along you are.
 *
 * **It is a scroll container, not a slide show.** `slidesToScroll` defaults to 1
 * and the track is keyboard-focusable, so arrow keys move between slides and a
 * slide that contains a link stays reachable. A carousel that hijacks the arrow
 * keys or hides its off-screen slides from the tab order is the standard
 * accessibility failure of this component, and both are avoided here by not
 * disabling anything: the slides stay in the DOM and in the tab order, and the
 * container scrolls.
 *
 * `orientation="vertical"` exists because embla supports it and a vertical
 * carousel is what a short list of cards becomes on a phone. It is a prop rather
 * than a second component because every part — the track, the previous/next
 * buttons, the dots — has the same relationship to the axis.
 *
 * The dot indicators are buttons, not spans: a carousel with twelve slides and a
 * "go to slide 7" affordance is the only way to reach the seventh without
 * dragging through six. Each is labelled, because a row of unlabelled dots is a
 * row of identical controls to a screen reader.
 */

export type CarouselApi = EmblaCarouselType

export type CarouselProps = {
  /** The slides. Each is wrapped in its own element so embla can measure it. */
  children: JSX.Element
  /** The axis. Vertical is what a card list becomes on a narrow screen. */
  orientation?: 'horizontal' | 'vertical'
  /** How many slides are visible at once. */
  slidesToShow?: number
  /** Align the active slide to the start, centre, or end of the viewport. */
  align?: 'start' | 'center' | 'end'
  /** Whether dragging past the ends loops. Off by default: a loop hides the ends. */
  loop?: boolean
  /** Show the previous/next controls. */
  controls?: boolean
  /** Show the dot indicators. Off by default — a single-slide carousel needs none. */
  dots?: boolean
  /** Accessible names. Override for a non-English application. */
  previousLabel?: string
  nextLabel?: string
  /** The label for a dot, given a zero-based index. */
  dotLabel?: (index: number) => string
  /** Receives the embla API, for a caller that needs to drive it. */
  onApi?: (api: CarouselApi) => void
  class?: string
}

export function Carousel(props: CarouselProps) {
  const [local, rest] = splitProps(props, [
    'children',
    'orientation',
    'slidesToShow',
    'align',
    'loop',
    'controls',
    'dots',
    'previousLabel',
    'nextLabel',
    'dotLabel',
    'onApi',
    'class',
  ])

  const orientation = () => local.orientation ?? 'horizontal'

  // The first element of the tuple is the ref setter, the second the accessor —
  // so `ref={emblaRef}` is the whole wiring.
  const [emblaRef, embla] = createEmblaCarousel(() => ({
    axis: orientation() === 'vertical' ? 'y' : 'x',
    loop: local.loop ?? false,
    align: local.align ?? 'start',
    slidesToScroll: 1,
    containScroll: 'trimSnaps',
  }))

  const [selected, setSelected] = createSignal(0)
  const [count, setCount] = createSignal(0)
  const [canPrev, setCanPrev] = createSignal(false)
  const [canNext, setCanNext] = createSignal(false)

  /**
   * The scroll event, not the select event alone: `select` fires on a settle, so a
   * drag in progress would leave the dots behind the thumb. `scroll` covers both.
   */
  createEffect(() => {
    const api = embla()
    if (!api) return
    local.onApi?.(api)

    const sync = () => {
      setSelected(api.selectedScrollSnap())
      setCanPrev(api.canScrollPrev())
      setCanNext(api.canScrollNext())
    }
    sync()
    setCount(api.scrollSnapList().length)

    api.on('select', sync)
    api.on('scroll', sync)
    api.on('reInit', sync)
    onCleanup(() => {
      api.off('select', sync)
      api.off('scroll', sync)
      api.off('reInit', sync)
    })
  })

  return (
    <div
      class={cn('group/carousel relative grid gap-2', local.class)}
      role="group"
      aria-roledescription="carousel"
      {...rest}
    >
      <div
        ref={emblaRef}
        // A scroll container has to be reachable by keyboard — the same
        // requirement the code block's scroller meets.
        tabindex="0"
        class={cn(
          'scroll-fade overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
        )}
        aria-label="Carousel"
      >
        <div class={cn('flex', orientation() === 'vertical' ? 'flex-col' : 'flex-row')}>
          {local.children}
        </div>
      </div>

      <Show when={local.controls ?? true}>
        <div class="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!canPrev()}
            aria-label={local.previousLabel ?? 'Previous slide'}
            onClick={() => embla()?.scrollPrev()}
          >
            <ChevronLeft aria-hidden="true" class="rotate-0" />
          </Button>
          <Show when={local.dots}>
            <div class="flex items-center gap-1 px-1">
              <For each={Array.from({ length: count() })}>
                {(_, index) => (
                  <button
                    type="button"
                    class={cn(
                      'size-1.5 rounded-full bg-muted-foreground/40 transition-colors hover:bg-muted-foreground',
                      selected() === index() && 'bg-primary'
                    )}
                    aria-label={local.dotLabel?.(index()) ?? `Go to slide ${index() + 1}`}
                    aria-current={selected() === index() ? 'true' : undefined}
                    onClick={() => embla()?.scrollTo(index())}
                  />
                )}
              </For>
            </div>
          </Show>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!canNext()}
            aria-label={local.nextLabel ?? 'Next slide'}
            onClick={() => embla()?.scrollNext()}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </Show>
    </div>
  )
}

/**
 * One slide. `basis` is what makes `slidesToShow` work: embla measures the slide
 * elements, so a slide that is not sized to a fraction of the viewport would show
 * one per screen regardless of the setting.
 */
export function CarouselSlide(props: {
  children: JSX.Element
  /** How many slides share the viewport at this slide's widest breakpoint. */
  slidesToShow?: number
  class?: string
}) {
  return (
    <div
      class={cn('min-w-0 shrink-0 grow-0', props.class)}
      style={{ 'flex-basis': `${100 / (props.slidesToShow ?? 1)}%` }}
      role="group"
      aria-roledescription="slide"
    >
      {props.children}
    </div>
  )
}

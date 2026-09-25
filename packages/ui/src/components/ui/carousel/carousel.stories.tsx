import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Carousel, CarouselSlide } from './carousel'

const slides = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']

const slide = (label: string, slidesToShow?: number) => (
  <CarouselSlide slidesToShow={slidesToShow}>
    <div class="m-1 grid h-40 place-items-center rounded-lg border border-border bg-card text-sm">
      {label}
    </div>
  </CarouselSlide>
)

const meta = {
  title: 'UI/Carousel',
  component: Carousel,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A scroll container with snap points, over embla. It is a scroller and not a slide show: slides stay in the DOM and in the tab order, and the track itself is focusable, so arrow keys move between slides and a link inside a slide stays reachable. A carousel that hijacks the arrow keys or hides its off-screen slides is the standard accessibility failure of this component.',
      },
    },
  },
  // The slides are the required prop, so they live in the meta and the default
  // story renders from them. The variants supply their own `render` instead.
  args: { dots: true, children: slides.map((label) => slide(label)) },
  decorators: [() => <div class="w-[36rem]" />],
} satisfies Meta<typeof Carousel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Two per view: `flex-basis` on the slide is what makes it work. */
export const TwoUp: Story = {
  render: () => (
    <div class="w-[36rem]">
      <Carousel dots>{slides.map((label) => slide(label, 2))}</Carousel>
    </div>
  ),
}

/** `loop` hides the ends, which is why it is off by default. */
export const Looping: Story = {
  render: () => (
    <div class="w-[36rem]">
      <Carousel loop dots>
        {slides.map((label) => slide(label))}
      </Carousel>
    </div>
  ),
}

/** A single slide: no dots, and the controls disable at the ends. */
export const SingleSlide: Story = {
  render: () => <div class="w-[36rem]">{<Carousel>{slide('the only slide')}</Carousel>}</div>,
}

export const Vertical: Story = {
  render: () => (
    <div class="h-64">
      <Carousel orientation="vertical" dots>
        {slides.map((label) => slide(label))}
      </Carousel>
    </div>
  ),
}

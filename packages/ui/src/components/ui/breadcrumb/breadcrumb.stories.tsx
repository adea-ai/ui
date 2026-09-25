import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from './breadcrumb'

/**
 * Breadcrumb.
 *
 * The path to the current view, in a real `<nav>` wrapping an ordered list, so the
 * structure is announced rather than read as loose text. The final crumb is marked
 * `aria-current="page"` instead of being a link to itself.
 *
 * A long path collapses from the middle: the root says where the user started and
 * the last crumbs say what they are looking at, so those are the parts that have to
 * survive.
 */
const meta = {
  title: 'Primitives/Navigation/Breadcrumb',
  component: Breadcrumb,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Breadcrumb>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#storybook-preview-iframe">Workspace</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="#storybook-preview-iframe">Projects</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink current>packages/ui</BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
}

/** A deep path, collapsed from the middle. */
export const Collapsed: Story = {
  render: () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#storybook-preview-iframe">Workspace</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbEllipsis />
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="#storybook-preview-iframe">src</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink current>side-rail.tsx</BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
}

/** A long path that wraps rather than truncating. */
export const LongPath: Story = {
  render: () => (
    <Breadcrumb class="w-112">
      <BreadcrumbList>
        {['Workspace', 'Projects', 'adea', 'packages', 'ui', 'src', 'components', 'layout'].map(
          (crumb, index, all) => (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink current={index === all.length - 1}>{crumb}</BreadcrumbLink>
              </BreadcrumbItem>
              {index < all.length - 1 ? <BreadcrumbSeparator /> : null}
            </>
          )
        )}
      </BreadcrumbList>
    </Breadcrumb>
  ),
}

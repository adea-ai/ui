import { render } from 'solid-js/web'
import { Callout, CalloutTitle } from '../../src/components/ui/callout/callout'
import { TextLink } from '../../src/components/ui/text-link/text-link'
import '../../src/styles/globals.css'

declare global {
  interface Window {
    calloutRef?: HTMLDivElement
  }
}

const token = 'x'.repeat(200)
const url =
  'https://example.com/a/very/long/path/with/no/spaces/or/hyphens/that/keeps/going/and/going/index.html?query=parameter-value&another=value'
const path =
  '/home/user/projects/adea-ai/ui/packages/ui/src/components/ui/callout/callout.stories.tsx.snapshot'

function Fixture() {
  return (
    <main>
      <Callout data-testid="default">Default note</Callout>
      <Callout data-testid="role" role="region" aria-label="Release summary" class="mt-4">
        Role override
      </Callout>
      <Callout
        data-testid="ref"
        class="mt-4"
        variant="info"
        size="lg"
        ref={(element) => {
          window.calloutRef = element
        }}
      >
        <CalloutTitle data-testid="title">Title</CalloutTitle>
        Ref and class pass through
      </Callout>
      <div class="mt-4 flex flex-col gap-4" data-testid="matrix">
        {(['sm', 'md', 'lg'] as const).map((size) =>
          (['default', 'destructive', 'success', 'warning', 'info'] as const).map((variant) => (
            <Callout data-testid={`${variant}-${size}`} variant={variant} size={size}>
              {variant} {size}
            </Callout>
          ))
        )}
      </div>
      <div dir="rtl" data-testid="rtl-wrap" class="mt-4">
        <Callout data-testid="rtl">Right to left</Callout>
      </div>
      <div class="mt-4 w-48" data-testid="narrow-wrap">
        <Callout data-testid="narrow" size="sm">
          A narrow container wraps the text of the note across several lines
        </Callout>
      </div>
      <div class="mt-4 flex w-96 flex-col gap-4" data-testid="spacing-host">
        <Callout data-testid="spacing-text" size="sm">
          <CalloutTitle data-testid="spacing-text-title">Title</CalloutTitle>
          Plain text body that follows the title.
        </Callout>
        <Callout data-testid="spacing-block" size="sm">
          <CalloutTitle data-testid="spacing-block-title">Title</CalloutTitle>
          <p data-testid="spacing-block-body">Plain text body that follows the title.</p>
        </Callout>
        <Callout data-testid="spacing-inline" size="sm">
          <CalloutTitle data-testid="spacing-inline-title">Title</CalloutTitle>
          Run <code data-testid="spacing-inline-code">bun run test</code> and read the{' '}
          <TextLink href="#guide" data-testid="spacing-inline-link">
            guide
          </TextLink>
          .
        </Callout>
        <Callout data-testid="spacing-inline-first" size="sm">
          <CalloutTitle data-testid="spacing-inline-first-title">Title</CalloutTitle>
          <TextLink href="#guide" data-testid="spacing-inline-first-link">
            guide
          </TextLink>{' '}
          comes first in this body.
        </Callout>
        <Callout data-testid="spacing-only" size="sm">
          <CalloutTitle data-testid="spacing-only-title" class="mb-0">
            Title only
          </CalloutTitle>
        </Callout>
        <Callout data-testid="spacing-only-default" size="sm">
          <CalloutTitle data-testid="spacing-only-default-title">Title only, default</CalloutTitle>
        </Callout>
      </div>
      <div class="mt-4 w-48" data-testid="unbroken-block">
        <Callout data-testid="unbroken-block-token" size="sm">
          <CalloutTitle>{token}</CalloutTitle>
          {token}
        </Callout>
        <Callout data-testid="unbroken-block-url" size="sm" class="mt-2">
          {url}
        </Callout>
        <Callout data-testid="unbroken-block-path" size="sm" class="mt-2">
          {path}
        </Callout>
      </div>
      <div class="mt-4 flex w-48" data-testid="unbroken-flex">
        <Callout data-testid="unbroken-flex-token" size="sm">
          {token}
        </Callout>
      </div>
      <div class="mt-4 flex w-48 flex-col" data-testid="unbroken-flex-column">
        <Callout data-testid="unbroken-flex-column-token" size="sm">
          {token}
        </Callout>
      </div>
      <div class="mt-4 grid w-48" data-testid="unbroken-grid">
        <Callout data-testid="unbroken-grid-token" size="sm">
          {token}
        </Callout>
      </div>
    </main>
  )
}

render(() => <Fixture />, document.body)

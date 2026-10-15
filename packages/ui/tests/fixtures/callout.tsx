import { render } from 'solid-js/web'
import { Callout, CalloutTitle } from '../../src/components/ui/callout/callout'
import '../../src/styles/globals.css'

declare global {
  interface Window {
    calloutRef?: HTMLDivElement
  }
}

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
    </main>
  )
}

render(() => <Fixture />, document.body)

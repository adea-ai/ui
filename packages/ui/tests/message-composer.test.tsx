import { describe, expect, test } from 'bun:test'
import { textareaVariants } from '../src/components/ui/textarea/textarea'

describe('Textarea variants', () => {
  test('keeps the existing default appearance and vertical resize behavior', () => {
    const classes = textareaVariants()

    expect(classes).toContain('min-h-16')
    expect(classes).toContain('resize-y')
    expect(classes).toContain('border-input')
  })

  test('provides the named comfortable composer treatment without caller appearance classes', () => {
    const classes = textareaVariants({
      variant: 'composer',
      size: 'comfortable',
      resize: 'vertical',
    })

    expect(classes).toContain('min-h-16')
    expect(classes).toContain('max-h-48')
    expect(classes).toContain('resize-y')
    expect(classes).toContain('border-0')
    expect(classes).toContain('bg-transparent')
  })
})

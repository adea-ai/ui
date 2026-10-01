import type { ComponentProps, Ref } from 'solid-js'
import { splitProps } from 'solid-js'
import { cva, type VariantProps } from 'class-variance-authority'
import { useFormFieldControl } from '#lib/form-field'
import { cn } from '#lib/utils'

export const textareaVariants = cva(
  [
    'flex field-sizing-content w-full rounded-md border border-input bg-transparent px-control-md py-2 text-sm',
    'transition-[color,box-shadow,border-color] ease-out outline-none',
    'placeholder:text-muted-foreground',
    'selection:bg-primary selection:text-primary-foreground',
    'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
    'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive-subtle',
    'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        default: '',
        composer: 'border-0 bg-transparent p-0 shadow-none focus-visible:ring-0',
      },
      size: {
        default: 'min-h-16',
        comfortable: 'min-h-16 max-h-48',
      },
      resize: {
        vertical: 'resize-y',
        none: 'resize-none',
        both: 'resize',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      resize: 'vertical',
    },
  }
)

export type TextareaProps = Omit<ComponentProps<'textarea'>, 'size'> &
  VariantProps<typeof textareaVariants> & {
    /** Solid's actual textarea element, rather than its containing component or form. */
    ref?: Ref<HTMLTextAreaElement>
  }

/**
 * Textarea.
 *
 * Shares the Input's border, focus and invalid treatment exactly — the two are
 * the same control at different aspect ratios, and a form that mixes them must
 * not show a seam between them.
 *
 * `field-sizing: content` lets the element grow with its content where the
 * engine supports it, which is the behaviour a chat composer wants; `rows`
 * remains the fallback so an unsupported engine still gets a usable height.
 * `variant="composer"` removes the standalone field surface when nested in a
 * composer shell. `size="comfortable"` caps growth at the shared 12rem rung, and
 * the finite `resize` variants keep browser resize behavior explicit.
 */
export function Textarea(props: TextareaProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'variant',
    'size',
    'resize',
    'ref',
    'id',
    'aria-label',
    'aria-labelledby',
    'aria-describedby',
    'aria-invalid',
    'aria-errormessage',
  ])
  const field = useFormFieldControl('control', {
    id: local.id,
    'aria-label': local['aria-label'],
    'aria-labelledby': local['aria-labelledby'],
    'aria-describedby': local['aria-describedby'],
    'aria-invalid': local['aria-invalid'],
    'aria-errormessage': local['aria-errormessage'],
  })

  return (
    <textarea
      data-slot="textarea"
      id={field?.id ?? local.id}
      aria-label={local['aria-label']}
      aria-labelledby={field?.['aria-labelledby'] ?? local['aria-labelledby']}
      aria-describedby={field?.['aria-describedby'] ?? local['aria-describedby']}
      aria-invalid={field?.['aria-invalid'] ?? local['aria-invalid']}
      aria-errormessage={field?.['aria-errormessage'] ?? local['aria-errormessage']}
      ref={local.ref}
      class={cn(
        textareaVariants({ variant: local.variant, size: local.size, resize: local.resize }),
        local.class
      )}
      {...rest}
    />
  )
}

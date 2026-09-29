/*
 * The design system's own oxlint plugin.
 *
 * The styling rules live in `@shadcn/lint`; what that plugin cannot know is which
 * *elements* the design system owns. This is the other half of the contract, for
 * the applications that consume the library: an interactive element this package
 * provides is not re-implemented at the application layer, and the primitive
 * libraries this package is built from are not imported around it.
 *
 * Loaded as an oxlint jsPlugin:
 *
 *   // .oxlintrc.json
 *   { "jsPlugins": ["@adea-ai/ui/lint"], "rules": { "adea/no-raw-interactive-elements": "error" } }
 *
 * Rules are errors by intent. A violation means an application composed its own
 * control out of raw markup — unreachable focus behaviour, an absent keyboard
 * story, a second implementation of a decision this package exists to make once.
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

/** The raw elements this package replaces, and the primitive that replaces them. */
const ELEMENT_PRIMITIVES: Readonly<Record<string, { primitive: string; path: string }>> =
  Object.freeze({
    button: { primitive: 'Button', path: '@adea-ai/ui/components/ui/button' },
    input: { primitive: 'Input', path: '@adea-ai/ui/components/ui/input' },
    textarea: { primitive: 'Textarea', path: '@adea-ai/ui/components/ui/textarea' },
    select: { primitive: 'Select', path: '@adea-ai/ui/components/ui/select' },
    option: { primitive: 'Select', path: '@adea-ai/ui/components/ui/select' },
    label: { primitive: 'Label', path: '@adea-ai/ui/components/ui/label' },
  })

type RuleModule = {
  meta: {
    type: 'problem'
    docs: { description: string }
    schema: Json[]
    messages: Record<string, string>
  }
  create: (context: LintContext) => Record<string, (node: any) => void>
}

interface LintContext {
  options?: unknown[]
  report: (descriptor: {
    node: unknown
    messageId?: string
    message?: string
    data?: Record<string, Json>
  }) => void
}

interface RawElementOptions {
  /** Element names this rule should not report (rare; prefer fixing the file). */
  allow?: string[]
  /** Replaces the default report message. */
  message?: string
}

const noRawInteractiveElements: RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Interactive elements this package provides (button, input, textarea, select, option, label) are composed from the package, not written as raw markup.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: { type: 'array', items: { type: 'string' } },
          message: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      rawElement:
        '{{element}} is provided by the design system: use {{primitive}} from {{path}}. A raw element has no keyboard story, no focus behaviour and no token styling — that is the work the primitive already did.',
    },
  },
  create(context) {
    const options = (context.options?.[0] ?? {}) as RawElementOptions
    const allowed = new Set(options.allow ?? [])
    const emit = (node: unknown, element: string) => {
      const target = ELEMENT_PRIMITIVES[element]!
      context.report({
        node,
        messageId: 'rawElement',
        data: { element, primitive: target.primitive, path: target.path },
        ...(options.message ? { message: options.message } : {}),
      })
    }
    return {
      JSXOpeningElement(node: any) {
        if (node.name?.type !== 'JSXIdentifier') return
        const element = node.name.name
        if (!(element in ELEMENT_PRIMITIVES) || allowed.has(element)) return
        emit(node, element)
      },
    }
  },
}

interface PrimitiveImportOptions {
  /** Package prefixes this rule reports. Defaults to the primitive libraries the ui package wraps. */
  packages?: string[]
  /** Replaces the default report message. */
  message?: string
}

const DEFAULT_PRIMITIVE_PACKAGES = Object.freeze([
  '@kobalte/core',
  '@ark-ui',
  '@zag-js',
  '@radix-ui',
  'radix-ui',
  '@base-ui-components',
])

const noPrimitiveLibraryImports: RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'The primitive libraries the design system is built on (Kobalte and friends) are its internal affair — compose the exported components instead of importing the primitives.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          packages: { type: 'array', items: { type: 'string' } },
          message: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      primitiveImport:
        'Import from the design system, not from {{package}}: the primitives it wraps carry the focus, keyboard and ARIA behaviour the components exist to provide.',
    },
  },
  create(context) {
    const options = (context.options?.[0] ?? {}) as PrimitiveImportOptions
    const prefixes = options.packages ?? DEFAULT_PRIMITIVE_PACKAGES
    const offender = (source: unknown): string | null => {
      const name = String(source ?? '')
      return prefixes.find((prefix) => name === prefix || name.startsWith(`${prefix}/`)) ?? null
    }
    const report = (node: unknown, source: unknown) => {
      const pkg = offender(source)!
      context.report({
        node,
        messageId: 'primitiveImport',
        data: { package: pkg },
        ...(options.message ? { message: options.message } : {}),
      })
    }
    return {
      ImportDeclaration(node: any) {
        if (offender(node.source?.value)) report(node, node.source.value)
      },
      ImportExpression(node: any) {
        if (typeof node.source?.value === 'string' && offender(node.source.value))
          report(node, node.source.value)
      },
    }
  },
}

const plugin = {
  meta: { name: 'adea' },
  rules: {
    'no-raw-interactive-elements': noRawInteractiveElements,
    'no-primitive-library-imports': noPrimitiveLibraryImports,
  },
}

export default plugin

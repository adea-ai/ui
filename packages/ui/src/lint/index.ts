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

/** Reads a static object-property key without evaluating a computed expression. */
const staticPropertyKey = (node: any, computed: boolean): string | null => {
  if (!computed && node?.type === 'Identifier') return node.name
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0)
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw
  return null
}

/** Detects named props in a literal JSX spread, including nested literal spreads. */
const objectHasStaticProperty = (node: any, name: string, seen = new Set<unknown>()): boolean => {
  if (!node || seen.has(node)) return false
  seen.add(node)
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression'
  )
    return objectHasStaticProperty(node.expression, name, seen)
  if (node.type !== 'ObjectExpression') return false
  return node.properties.some((property: any) => {
    if (property.type === 'Property')
      return staticPropertyKey(property.key, property.computed === true) === name
    if (property.type === 'SpreadElement')
      return objectHasStaticProperty(property.argument, name, seen)
    return false
  })
}

const noInlineStyles: RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Consumer components cannot set appearance or layout with JSX style props; use shared variants and token-backed classes.',
    },
    schema: [],
    messages: {
      inlineStyle:
        'JSX style attributes are not permitted, including layout values and CSS custom properties. Use shared variants and token-backed classes.',
      inlineStyleElement:
        'A JSX style element bypasses the shared design system. Use shared variants and token-backed classes.',
      inlineStyleSpread:
        'A JSX spread contains a style prop. Pass named shared component props instead of hiding inline styles in a spread.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node: any) {
        if (node.name?.type === 'JSXIdentifier' && node.name.name === 'style')
          context.report({ node, messageId: 'inlineStyle' })
      },
      JSXOpeningElement(node: any) {
        if (node.name?.type === 'JSXIdentifier' && node.name.name === 'style')
          context.report({ node, messageId: 'inlineStyleElement' })
      },
      JSXSpreadAttribute(node: any) {
        if (objectHasStaticProperty(node.argument, 'style'))
          context.report({ node, messageId: 'inlineStyleSpread' })
      },
    }
  },
}

const noClassList: RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Solid classList props hide conditional classes from static design-system lint; use cn() with its object-key form.',
    },
    schema: [],
    messages: {
      classList:
        'classList hides classes from design-system lint. Use cn() with its object-key form and statically readable class names.',
      classListSpread:
        'A JSX spread contains classList. Use cn() with its object-key form instead of hiding classes in a spread.',
    },
  },
  create(context) {
    return {
      JSXAttribute(node: any) {
        if (node.name?.type === 'JSXIdentifier' && node.name.name === 'classList')
          context.report({ node, messageId: 'classList' })
      },
      JSXSpreadAttribute(node: any) {
        if (objectHasStaticProperty(node.argument, 'classList'))
          context.report({ node, messageId: 'classListSpread' })
      },
    }
  },
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
  '@corvu',
  'cmdk-solid',
  '@ark-ui',
  '@zag-js',
  '@radix-ui',
  'radix-ui',
  '@base-ui-components',
  '@base-ui',
])

/**
 * The interactive ARIA roles an application can dress a generic element in, and
 * the primitive that owns each role. `link` is deliberately absent: an `<a>` is
 * natively interactive and Button itself supports `as="a"` for the link-styled
 * case.
 */
const ROLE_PRIMITIVES: Readonly<Record<string, { primitive: string; path: string }>> =
  Object.freeze({
    button: { primitive: 'Button', path: '@adea-ai/ui/components/ui/button' },
    checkbox: { primitive: 'Checkbox', path: '@adea-ai/ui/components/ui/checkbox' },
    radio: { primitive: 'RadioGroup', path: '@adea-ai/ui/components/ui/radio-group' },
    switch: { primitive: 'Switch', path: '@adea-ai/ui/components/ui/switch' },
    tab: { primitive: 'Tabs', path: '@adea-ai/ui/components/ui/tabs' },
    option: { primitive: 'Select', path: '@adea-ai/ui/components/ui/select' },
    menuitem: { primitive: 'DropdownMenu', path: '@adea-ai/ui/components/ui/dropdown-menu' },
    textbox: { primitive: 'Input', path: '@adea-ai/ui/components/ui/input' },
  })

/**
 * The elements whose only job is layout or text. A click handler or a tabindex on
 * one of these is a control being hand-built out of a non-control.
 */
const GENERIC_ELEMENTS: ReadonlySet<string> = new Set([
  'div',
  'span',
  'li',
  'ul',
  'ol',
  'td',
  'th',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'section',
  'article',
  'aside',
  'header',
  'footer',
  'nav',
  'main',
  'img',
  'svg',
])

const CLICK_HANDLERS: ReadonlySet<string> = new Set([
  'onClick',
  'onDoubleClick',
  'onPointerDown',
  'onPointerUp',
  'onMouseDown',
  'onMouseUp',
  'on:click',
  'on:dblclick',
  'on:pointerdown',
  'on:pointerup',
  'on:mousedown',
  'on:mouseup',
])

interface InteractiveWrapperOptions {
  /** Element names this rule should not report (rare; prefer fixing the file). */
  allow?: string[]
  /** Replaces the default report message. */
  message?: string
}

/** Only statically knowable branches; unresolved roles remain a review boundary. */
const staticStrings = (node: any): string[] => {
  if (node?.type === 'Literal' && typeof node.value === 'string') return [node.value]
  if (node?.type === 'JSXExpressionContainer') return staticStrings(node.expression)
  if (node?.type === 'ConditionalExpression')
    return [...staticStrings(node.consequent), ...staticStrings(node.alternate)]
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0)
    return [node.quasis[0].value.cooked ?? node.quasis[0].value.raw]
  return []
}

const roleOf = (node: any): string | null => {
  for (const attribute of node.attributes ?? []) {
    if (attribute.type !== 'JSXAttribute' || attribute.name?.name !== 'role') continue
    return (
      staticStrings(attribute.value)
        .flatMap((role) => role.split(/\s+/))
        .find((role) => role in ROLE_PRIMITIVES) ?? null
    )
  }
  return null
}

/** Whether the element carries the attribute, by name. */
const has = (node: any, name: string): boolean =>
  (node.attributes ?? []).some(
    (attribute: any) =>
      attribute.type === 'JSXAttribute' &&
      (attribute.name?.type === 'JSXNamespacedName'
        ? `${attribute.name.namespace.name}:${attribute.name.name.name}`
        : attribute.name?.name) === name
  )

const hasTabStop = (node: any): boolean =>
  (node.attributes ?? []).some((attribute: any) => {
    if (
      attribute.type !== 'JSXAttribute' ||
      !['tabIndex', 'tabindex'].includes(attribute.name?.name)
    )
      return false
    const value =
      attribute.value?.type === 'JSXExpressionContainer'
        ? attribute.value.expression
        : attribute.value
    if (value?.type === 'Literal') return !(Number(value.value) < 0)
    if (
      value?.type === 'UnaryExpression' &&
      value.operator === '-' &&
      value.argument?.type === 'Literal'
    )
      return !(Number(value.argument.value) > 0)
    return true
  })

const noInteractiveWrappers: RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Generic elements dressed as interactive controls — an interactive role, a click handler or a tabindex on a layout element — re-implement a primitive by hand. Compose the real component.',
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
      roleWrapper:
        'A {{element}} with role="{{role}}" hand-builds {{primitive}}: use {{primitive}} from {{path}}. The primitive brings keyboard activation, focus behaviour and ARIA wiring; the wrapper re-implements them badly.',
      clickWrapper:
        'A click handler on {{element}} composes {{primitive}} by hand: use {{primitive}} from {{path}}. A div that reacts to clicks is a button that cannot be reached by keyboard.',
      tabindexWrapper:
        'A tabindex on {{element}} makes a layout element focusable, which is focus management the primitives already own: compose the real component instead.',
    },
  },
  create(context) {
    const options = (context.options?.[0] ?? {}) as InteractiveWrapperOptions
    const allowed = new Set(options.allow ?? [])
    return {
      JSXOpeningElement(node: any) {
        if (node.name?.type !== 'JSXIdentifier') return
        const element = node.name.name
        if (allowed.has(element) || element in ELEMENT_PRIMITIVES) return
        // A capitalized element is a component — often a design-system primitive
        // composing a role deliberately (a Button carrying role="option" inside a
        // custom listbox, for example). That is composition, not impersonation.
        if (element[0] === element[0]?.toUpperCase()) return

        const role = roleOf(node)
        if (role && role in ROLE_PRIMITIVES) {
          const target = ROLE_PRIMITIVES[role]!
          context.report({
            node,
            messageId: 'roleWrapper',
            data: { element, role, primitive: target.primitive, path: target.path },
            ...(options.message ? { message: options.message } : {}),
          })
          return
        }

        if (GENERIC_ELEMENTS.has(element)) {
          const click = [...CLICK_HANDLERS].find((handler) => has(node, handler))
          if (click) {
            const target = ROLE_PRIMITIVES.button!
            context.report({
              node,
              messageId: 'clickWrapper',
              data: { element, primitive: target.primitive, path: target.path },
              ...(options.message ? { message: options.message } : {}),
            })
            return
          }
          if (hasTabStop(node)) {
            context.report({
              node,
              messageId: 'tabindexWrapper',
              data: { element },
              ...(options.message ? { message: options.message } : {}),
            })
          }
        }
      },
    }
  },
}

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
      ExportNamedDeclaration(node: any) {
        if (offender(node.source?.value)) report(node, node.source.value)
      },
      ExportAllDeclaration(node: any) {
        if (offender(node.source?.value)) report(node, node.source.value)
      },
      CallExpression(node: any) {
        if (node.callee?.type !== 'Identifier' || node.callee.name !== 'require') return
        const source = node.arguments?.[0]?.value
        if (typeof source === 'string' && offender(source)) report(node, source)
      },
    }
  },
}

const plugin = {
  meta: { name: 'adea' },
  rules: {
    'no-inline-styles': noInlineStyles,
    'no-class-list': noClassList,
    'no-raw-interactive-elements': noRawInteractiveElements,
    'no-primitive-library-imports': noPrimitiveLibraryImports,
    'no-interactive-wrappers': noInteractiveWrappers,
  },
}

export default plugin

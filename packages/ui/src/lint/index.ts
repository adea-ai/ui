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
  sourceCode?: {
    getScope?: (node: unknown) => LintScope | undefined
  }
  report: (descriptor: {
    node: unknown
    messageId?: string
    message?: string
    data?: Record<string, Json>
  }) => void
}

interface LintScope {
  set?: Map<string, any>
  upper?: LintScope
}

interface LintVariable {
  defs?: { type?: string; parent?: { kind?: string }; node?: { init?: unknown } }[]
  identifiers?: object[]
}

const variableOf = (node: any, context: LintContext): LintVariable | null => {
  if (node?.type !== 'Identifier' && node?.type !== 'JSXIdentifier') return null
  for (let scope = context.sourceCode?.getScope?.(node); scope; scope = scope.upper) {
    const variable = scope.set?.get(node.name)
    if (variable) return variable
  }
  return null
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

/** Returns literal values for a statically named property in an object spread. */
const staticObjectPropertyValues = (node: any, name: string, seen = new Set<unknown>()): any[] => {
  if (!node || seen.has(node)) return []
  seen.add(node)
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression'
  )
    return staticObjectPropertyValues(node.expression, name, seen)
  if (node.type !== 'ObjectExpression') return []
  return node.properties.flatMap((property: any) => {
    if (property.type === 'Property')
      return staticPropertyKey(property.key, property.computed === true) === name
        ? [property.value]
        : []
    if (property.type === 'SpreadElement')
      return staticObjectPropertyValues(property.argument, name, seen)
    return []
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
        'Interactive elements this package provides (button, input, textarea, select, option, label), including statically known Solid Dynamic tags, are composed from the package, not written as raw markup.',
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
    const dynamicImports: SolidDynamicImports = {
      named: new WeakSet(),
      namespaces: new WeakSet(),
    }
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
      Program(node: any) {
        collectSolidDynamicImports(node, dynamicImports)
      },
      JSXOpeningElement(node: any) {
        for (const element of jsxElementNames(node, dynamicImports, context)) {
          if (!(element in ELEMENT_PRIMITIVES) || allowed.has(element)) continue
          emit(node, element)
        }
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
 * the published primitive that owns each role. Native anchors are not generic
 * elements, so their built-in link semantics are unaffected by the `link` entry.
 */
const ROLE_PRIMITIVES: Readonly<Record<string, { primitive: string; path: string }>> =
  Object.freeze({
    button: { primitive: 'Button', path: '@adea-ai/ui/components/ui/button' },
    link: { primitive: 'TextLink', path: '@adea-ai/ui/components/ui/text-link' },
    checkbox: { primitive: 'Checkbox', path: '@adea-ai/ui/components/ui/checkbox' },
    radio: { primitive: 'RadioGroupItem', path: '@adea-ai/ui/components/ui/radio-group' },
    radiogroup: { primitive: 'RadioGroup', path: '@adea-ai/ui/components/ui/radio-group' },
    switch: { primitive: 'Switch', path: '@adea-ai/ui/components/ui/switch' },
    tab: { primitive: 'TabsTrigger', path: '@adea-ai/ui/components/ui/tabs' },
    tablist: { primitive: 'TabsList', path: '@adea-ai/ui/components/ui/tabs' },
    tabpanel: { primitive: 'TabsContent', path: '@adea-ai/ui/components/ui/tabs' },
    option: { primitive: 'SelectItem', path: '@adea-ai/ui/components/ui/select' },
    listbox: { primitive: 'Select', path: '@adea-ai/ui/components/ui/select' },
    combobox: { primitive: 'Combobox', path: '@adea-ai/ui/components/ui/combobox' },
    searchbox: { primitive: 'Input', path: '@adea-ai/ui/components/ui/input' },
    menu: { primitive: 'DropdownMenuContent', path: '@adea-ai/ui/components/ui/dropdown-menu' },
    menuitem: { primitive: 'DropdownMenuItem', path: '@adea-ai/ui/components/ui/dropdown-menu' },
    menuitemcheckbox: {
      primitive: 'DropdownMenuCheckboxItem',
      path: '@adea-ai/ui/components/ui/dropdown-menu',
    },
    menuitemradio: {
      primitive: 'DropdownMenuRadioItem',
      path: '@adea-ai/ui/components/ui/dropdown-menu',
    },
    textbox: { primitive: 'Input', path: '@adea-ai/ui/components/ui/input' },
    tree: { primitive: 'Tree', path: '@adea-ai/ui/components/composites/tree' },
    treeitem: { primitive: 'TreeRow', path: '@adea-ai/ui/components/composites/tree' },
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

const CLICK_HANDLERS: ReadonlySet<string> = new Set(
  [
    'onClick',
    'onDblClick',
    'onDoubleClick',
    'onPointerDown',
    'onPointerUp',
    'onMouseDown',
    'onMouseUp',
    'onTouchStart',
    'onTouchEnd',
    'on:click',
    'on:dblclick',
    'on:pointerdown',
    'on:pointerup',
    'on:mousedown',
    'on:mouseup',
    'on:touchstart',
    'on:touchend',
  ].flatMap((handler) => [handler, handler.toLowerCase()])
)

interface InteractiveWrapperOptions {
  /** Element names this rule should not report (rare; prefer fixing the file). */
  allow?: string[]
  /** Also reject opaque generic-element props and Solid Dynamic tag overrides. */
  rejectUnknownSpreads?: boolean
  /** Replaces the default report message. */
  message?: string
}

/** Returns a const binding's immutable initializer, when its value is statically knowable. */
const constInitializer = (node: any, context: LintContext): any => {
  const variable = variableOf(node, context)
  const definition = variable?.defs?.[0]
  if (definition?.type !== 'Variable' || definition.parent?.kind !== 'const') return null
  return definition.node?.init ?? null
}

/** Reads literal strings through static branches and local const aliases. */
const staticStrings = (node: any, context?: LintContext, seen = new Set<unknown>()): string[] => {
  if (!node || seen.has(node)) return []
  seen.add(node)
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression' ||
    node.type === 'TSNonNullExpression'
  )
    return staticStrings(node.expression, context, seen)
  if (node?.type === 'Literal' && typeof node.value === 'string') return [node.value]
  if (node?.type === 'JSXExpressionContainer') return staticStrings(node.expression, context, seen)
  if (node?.type === 'ConditionalExpression')
    return [
      ...staticStrings(node.consequent, context, new Set(seen)),
      ...staticStrings(node.alternate, context, new Set(seen)),
    ]
  if (node?.type === 'LogicalExpression')
    return [
      ...staticStrings(node.left, context, new Set(seen)),
      ...staticStrings(node.right, context, new Set(seen)),
    ]
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0)
    return [node.quasis[0].value.cooked ?? node.quasis[0].value.raw]
  if (node?.type === 'Identifier' && context) {
    const initializer = constInitializer(node, context)
    return initializer ? staticStrings(initializer, context, seen) : []
  }
  return []
}

interface SolidDynamicImports {
  named: WeakSet<object>
  namespaces: WeakSet<object>
}

const collectSolidDynamicImport = (node: any, imports: SolidDynamicImports): void => {
  if (node.source?.value !== 'solid-js/web') return
  for (const specifier of node.specifiers ?? []) {
    if (specifier.type === 'ImportNamespaceSpecifier' && specifier.local)
      imports.namespaces.add(specifier.local)
    if (specifier.type !== 'ImportSpecifier') continue
    const imported = specifier.imported?.name ?? specifier.imported?.value
    if (imported === 'Dynamic' && specifier.local) imports.named.add(specifier.local)
  }
}

const collectSolidDynamicImports = (program: any, imports: SolidDynamicImports): void => {
  for (const statement of program.body ?? [])
    if (statement.type === 'ImportDeclaration') collectSolidDynamicImport(statement, imports)
}

const isImportedBinding = (node: any, bindings: WeakSet<object>, context: LintContext): boolean =>
  variableOf(node, context)?.identifiers?.some((identifier: object) => bindings.has(identifier)) ??
  false

const isSolidDynamic = (name: any, imports: SolidDynamicImports, context: LintContext): boolean => {
  if (name?.type === 'JSXIdentifier') return isImportedBinding(name, imports.named, context)
  return (
    name?.type === 'JSXMemberExpression' &&
    name.property?.name === 'Dynamic' &&
    name.object?.type === 'JSXIdentifier' &&
    isImportedBinding(name.object, imports.namespaces, context)
  )
}

interface DynamicComponentResolution {
  values: any[]
  opaqueAfterKnownIntrinsic: boolean
}

const valuesIncludeKnownIntrinsic = (values: any[], context: LintContext): boolean =>
  values
    .flatMap((value) => staticStrings(value, context))
    .some((element) => GENERIC_ELEMENTS.has(element) || element in ELEMENT_PRIMITIVES)

/** Applies `component` assignments made by a spread, tracking opaque overrides. */
const applyDynamicComponentSpread = (
  node: any,
  resolution: DynamicComponentResolution,
  context: LintContext
): DynamicComponentResolution => {
  while (
    node?.type === 'TSAsExpression' ||
    node?.type === 'TSSatisfiesExpression' ||
    node?.type === 'TSNonNullExpression'
  )
    node = node.expression
  if (!node || node.type !== 'ObjectExpression')
    return {
      values: [],
      opaqueAfterKnownIntrinsic:
        resolution.opaqueAfterKnownIntrinsic ||
        valuesIncludeKnownIntrinsic(resolution.values, context),
    }

  let current = resolution
  for (const property of node.properties ?? []) {
    if (property.type === 'SpreadElement') {
      current = applyDynamicComponentSpread(property.argument, current, context)
      continue
    }
    if (property.type !== 'Property') continue
    const key = staticPropertyKey(property.key, property.computed === true)
    if (key === 'component')
      current = { values: [property.value], opaqueAfterKnownIntrinsic: false }
    else if (property.computed && key === null)
      current = {
        values: [],
        opaqueAfterKnownIntrinsic:
          current.opaqueAfterKnownIntrinsic || valuesIncludeKnownIntrinsic(current.values, context),
      }
  }
  return current
}

const dynamicComponentResolution = (
  node: any,
  context: LintContext
): DynamicComponentResolution => {
  let resolution: DynamicComponentResolution = {
    values: [],
    opaqueAfterKnownIntrinsic: false,
  }
  for (const attribute of node.attributes ?? []) {
    if (attribute.type === 'JSXAttribute' && attribute.name?.name === 'component') {
      resolution = {
        values: attribute.value ? [attribute.value] : [],
        opaqueAfterKnownIntrinsic: false,
      }
      continue
    }
    if (attribute.type === 'JSXSpreadAttribute')
      resolution = applyDynamicComponentSpread(attribute.argument, resolution, context)
  }
  return resolution
}

/** Resolves native tags passed to Solid Dynamic while leaving component values alone. */
const jsxElementNames = (
  node: any,
  imports: SolidDynamicImports,
  context: LintContext
): string[] => {
  if (isSolidDynamic(node.name, imports, context))
    return [
      ...new Set(
        dynamicComponentResolution(node, context).values.flatMap((value) =>
          staticStrings(value, context)
        )
      ),
    ]
  if (node.name?.type === 'JSXIdentifier') return [node.name.name]
  return []
}

const roleOf = (node: any, context: LintContext): string | null => {
  for (const attribute of node.attributes ?? []) {
    if (attribute.type === 'JSXSpreadAttribute') {
      const role = staticObjectPropertyValues(attribute.argument, 'role')
        .flatMap((value) => staticStrings(value, context))
        .flatMap((value) => value.split(/\s+/))
        .find((value) => value in ROLE_PRIMITIVES)
      if (role) return role
      continue
    }
    if (attribute.type !== 'JSXAttribute' || attribute.name?.name !== 'role') continue
    return (
      staticStrings(attribute.value, context)
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
      (attribute.type === 'JSXAttribute' &&
        (attribute.name?.type === 'JSXNamespacedName'
          ? `${attribute.name.namespace.name}:${attribute.name.name.name}`
          : attribute.name?.name) === name) ||
      (attribute.type === 'JSXSpreadAttribute' && objectHasStaticProperty(attribute.argument, name))
  )

const tabStopValue = (value: any): boolean => {
  const expression = value?.type === 'JSXExpressionContainer' ? value.expression : value
  if (expression?.type === 'Literal') return !(Number(expression.value) < 0)
  if (
    expression?.type === 'UnaryExpression' &&
    expression.operator === '-' &&
    expression.argument?.type === 'Literal'
  )
    return !(Number(expression.argument.value) > 0)
  return true
}

const hasTabStop = (node: any): boolean =>
  (node.attributes ?? []).some((attribute: any) => {
    if (
      attribute.type === 'JSXAttribute' &&
      ['tabIndex', 'tabindex'].includes(attribute.name?.name)
    )
      return tabStopValue(attribute.value)
    if (attribute.type === 'JSXSpreadAttribute')
      return ['tabIndex', 'tabindex'].some((name) =>
        staticObjectPropertyValues(attribute.argument, name).some(tabStopValue)
      )
    return false
  })

/** Unknown/computed props make a JSX object spread opaque to interaction checks. */
const opaqueSpread = (node: any, seen = new Set<unknown>()): boolean => {
  while (
    node?.type === 'TSAsExpression' ||
    node?.type === 'TSSatisfiesExpression' ||
    node?.type === 'TSNonNullExpression'
  )
    node = node.expression
  if (!node || seen.has(node) || node.type !== 'ObjectExpression') return true
  seen.add(node)
  return node.properties.some((property: any) => {
    if (property.type === 'SpreadElement') return opaqueSpread(property.argument, seen)
    if (property.type !== 'Property') return true
    return staticPropertyKey(property.key, property.computed === true) === null
  })
}

const hasOpaqueSpread = (node: any): boolean =>
  (node.attributes ?? []).some(
    (attribute: any) => attribute.type === 'JSXSpreadAttribute' && opaqueSpread(attribute.argument)
  )

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
          rejectUnknownSpreads: { type: 'boolean' },
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
      opaqueSpreadWrapper:
        'A spread on {{element}} may hide a role, activation handler, or tab stop. Pass statically named props or compose the shared component instead.',
      opaqueDynamicComponentWrapper:
        'An opaque spread follows a known raw design-system or generic tag on Solid Dynamic and may replace the tag or hide interactive props. Pass statically named props or a shared component so the interaction rule can inspect the final component.',
    },
  },
  create(context) {
    const options = (context.options?.[0] ?? {}) as InteractiveWrapperOptions
    const allowed = new Set(options.allow ?? [])
    const dynamicImports: SolidDynamicImports = {
      named: new WeakSet(),
      namespaces: new WeakSet(),
    }
    return {
      Program(node: any) {
        collectSolidDynamicImports(node, dynamicImports)
      },
      JSXOpeningElement(node: any) {
        if (options.rejectUnknownSpreads && isSolidDynamic(node.name, dynamicImports, context)) {
          const resolution = dynamicComponentResolution(node, context)
          if (resolution.opaqueAfterKnownIntrinsic) {
            context.report({
              node,
              messageId: 'opaqueDynamicComponentWrapper',
              ...(options.message ? { message: options.message } : {}),
            })
            return
          }
        }

        for (const element of jsxElementNames(node, dynamicImports, context)) {
          if (allowed.has(element) || element in ELEMENT_PRIMITIVES) continue
          // Capitalized JSX components are composed controls, not raw elements.
          // Solid Dynamic is resolved above only when its component is a known tag.
          if (element[0] === element[0]?.toUpperCase()) continue
          if (!GENERIC_ELEMENTS.has(element)) continue

          if (options.rejectUnknownSpreads && hasOpaqueSpread(node)) {
            context.report({
              node,
              messageId: 'opaqueSpreadWrapper',
              data: { element },
              ...(options.message ? { message: options.message } : {}),
            })
            break
          }

          const role = roleOf(node, context)
          if (role && role in ROLE_PRIMITIVES) {
            const target = ROLE_PRIMITIVES[role]!
            context.report({
              node,
              messageId: 'roleWrapper',
              data: { element, role, primitive: target.primitive, path: target.path },
              ...(options.message ? { message: options.message } : {}),
            })
            continue
          }

          const click = [...CLICK_HANDLERS].find((handler) => has(node, handler))
          if (click) {
            const target = ROLE_PRIMITIVES.button!
            context.report({
              node,
              messageId: 'clickWrapper',
              data: { element, primitive: target.primitive, path: target.path },
              ...(options.message ? { message: options.message } : {}),
            })
            continue
          }
          if (hasTabStop(node))
            context.report({
              node,
              messageId: 'tabindexWrapper',
              data: { element },
              ...(options.message ? { message: options.message } : {}),
            })
        }
      },
    }
  },
}

const BUTTON_MODULE = '@adea-ai/ui/components/ui/button'
const ACTION_BUTTON_MODULE = '@adea-ai/ui/components/composites/action-button'
const ICON_BUTTON_SIZES: ReadonlySet<string> = new Set([
  'icon-2xs',
  'icon-xs',
  'icon-sm',
  'icon-md',
  'icon-lg',
  'icon-xl',
  'icon-2xl',
])

const staticJsxValues = (value: any): any[] =>
  value?.type === 'JSXExpressionContainer' ? [value.expression] : value ? [value] : []

const attributeValues = (node: any, name: string): any[] => {
  const values: any[] = []
  for (const attribute of node.attributes ?? []) {
    if (attribute.type === 'JSXAttribute' && attribute.name?.name === name)
      values.splice(0, values.length, ...staticJsxValues(attribute.value))
    if (attribute.type === 'JSXSpreadAttribute') {
      const spreadValues = staticObjectPropertyValues(attribute.argument, name)
      if (spreadValues.length > 0) values.splice(0, values.length, spreadValues.at(-1))
    }
  }
  return values
}

const staticStringValue = (node: any): string | null => {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0)
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw
  return null
}

interface ImportedJsxBindings {
  named: WeakSet<object>
  namespaces: WeakSet<object>
}

const isImportedJsxComponent = (
  name: any,
  imports: ImportedJsxBindings,
  context: LintContext,
  namespaceExport?: string
): boolean => {
  if (name?.type === 'JSXIdentifier' || name?.type === 'Identifier')
    return isImportedBinding(name, imports.named, context)
  const memberName = name?.property?.name
  return (
    (name?.type === 'JSXMemberExpression' || name?.type === 'MemberExpression') &&
    (name.object?.type === 'JSXIdentifier' || name.object?.type === 'Identifier') &&
    (name.property?.type === 'JSXIdentifier' || name.property?.type === 'Identifier') &&
    (namespaceExport ? memberName === namespaceExport : /^[A-Z]/.test(memberName ?? '')) &&
    isImportedBinding(name.object, imports.namespaces, context)
  )
}

type IconChildKind = 'empty' | 'icon' | 'text' | 'unknown'

const CONTENT_OVERRIDE_PROPS = new Set([
  'children',
  'dangerouslySetInnerHTML',
  'innerHTML',
  'textContent',
])

/** Opaque spreads and objects containing content props may override children. */
const spreadMayOverrideContent = (argument: any): boolean => {
  while (
    argument?.type === 'TSAsExpression' ||
    argument?.type === 'TSSatisfiesExpression' ||
    argument?.type === 'TSNonNullExpression'
  )
    argument = argument.expression
  if (argument?.type !== 'ObjectExpression') return true
  return argument.properties.some((property: any) => {
    if (property.type !== 'Property') return true
    const key = staticPropertyKey(property.key, property.computed === true)
    return key === null || CONTENT_OVERRIDE_PROPS.has(key)
  })
}

const hasContentOverride = (openingElement: any): boolean =>
  (openingElement?.attributes ?? []).some((attribute: any) => {
    if (attribute.type === 'JSXSpreadAttribute') return spreadMayOverrideContent(attribute.argument)
    return (
      attribute.type === 'JSXAttribute' &&
      attribute.name?.type === 'JSXIdentifier' &&
      CONTENT_OVERRIDE_PROPS.has(attribute.name.name)
    )
  })

const iconChildrenKind = (
  children: any[],
  icons: ImportedJsxBindings,
  context: LintContext
): IconChildKind => {
  let hasIcon = false
  for (const child of children) {
    const kind = iconChildKind(child, icons, context)
    if (kind === 'text' || kind === 'unknown') return kind
    if (kind === 'icon') hasIcon = true
  }
  return hasIcon ? 'icon' : 'empty'
}

const SVG_TEXT_CONTAINERS = new Set(['text', 'foreignObject'])

/** A raw SVG may be labelled or contain dynamic text instead of an icon. */
const svgMayContainVisibleText = (children: any[]): boolean => {
  for (const child of children) {
    if (!child) return true
    if (child.type === 'JSXText') {
      if (String(child.value ?? '').trim()) return true
      continue
    }
    if (child.type === 'JSXFragment') {
      if (svgMayContainVisibleText(child.children ?? [])) return true
      continue
    }
    if (child.type === 'JSXExpressionContainer') {
      const expression = child.expression
      if (!expression || expression.type === 'JSXEmptyExpression') continue
      if (expression.type === 'JSXElement' || expression.type === 'JSXFragment') {
        if (
          svgMayContainVisibleText(
            expression.type === 'JSXElement' ? [expression] : (expression.children ?? [])
          )
        )
          return true
        continue
      }
      const text = staticStringValue(expression)
      if (text !== null) {
        if (text.trim()) return true
        continue
      }
      if (
        expression.type === 'Literal' &&
        (expression.value === null || typeof expression.value === 'boolean')
      )
        continue
      return true
    }
    if (child.type !== 'JSXElement') return true

    const name = child.openingElement?.name
    if (name?.type !== 'JSXIdentifier') return true
    if (SVG_TEXT_CONTAINERS.has(name.name)) return true
    if (hasContentOverride(child.openingElement)) return true
    if (name.name === 'title' || name.name === 'desc') continue
    if (!/^[a-z]/.test(name.name) || name.name.includes('-')) return true
    if (svgMayContainVisibleText(child.children ?? [])) return true
  }
  return false
}

/**
 * Proves only the uncomplicated icon-only forms that can be read without
 * executing Solid expressions: imported Lucide components, raw SVG, fragments,
 * whitespace, and spans that contain only those forms.
 */
const iconChildKind = (
  child: any,
  icons: ImportedJsxBindings,
  context: LintContext
): IconChildKind => {
  if (!child) return 'unknown'
  if (child.type === 'JSXText') return String(child.value ?? '').trim() ? 'text' : 'empty'
  if (child.type === 'JSXFragment') return iconChildrenKind(child.children ?? [], icons, context)
  if (child.type === 'JSXExpressionContainer') {
    const expression = child.expression
    if (!expression || expression.type === 'JSXEmptyExpression') return 'empty'
    if (expression.type === 'JSXElement' || expression.type === 'JSXFragment')
      return iconChildKind(expression, icons, context)
    const text = staticStringValue(expression)
    if (text !== null) return text.trim() ? 'text' : 'empty'
    if (
      expression.type === 'Literal' &&
      (expression.value === null || typeof expression.value === 'boolean')
    )
      return 'empty'
    if (expression.type === 'Literal' && typeof expression.value === 'number') return 'text'
    return 'unknown'
  }
  if (child.type !== 'JSXElement') return 'unknown'

  const name = child.openingElement?.name
  if (name?.type === 'JSXIdentifier' && name.name === 'svg')
    return hasContentOverride(child.openingElement) ||
      svgMayContainVisibleText(child.children ?? [])
      ? 'unknown'
      : 'icon'
  if (isImportedJsxComponent(name, icons, context))
    return hasContentOverride(child.openingElement) ? 'unknown' : 'icon'
  if (name?.type === 'JSXIdentifier' && name.name === 'span') {
    if (hasContentOverride(child.openingElement)) return 'unknown'
    return iconChildrenKind(child.children ?? [], icons, context)
  }
  return 'unknown'
}

const hasStaticallyIconOnlyChildren = (
  node: any,
  icons: ImportedJsxBindings,
  context: LintContext
): boolean => {
  return (
    !hasContentOverride(node.openingElement) &&
    iconChildrenKind(node.children ?? [], icons, context) === 'icon'
  )
}

const isIconButtonSize = (node: any): boolean =>
  attributeValues(node, 'size').some((value) => {
    const size = staticStringValue(value)
    return size !== null && ICON_BUTTON_SIZES.has(size)
  })

const actionTooltipStatus = (node: any): 'valid' | 'blank' | 'unknown' | 'missing' => {
  const values = attributeValues(node, 'tooltip')
  if (values.length === 0) return 'missing'
  const strings = values.map(staticStringValue)
  if (strings.some((value) => value !== null && value.trim().length > 0)) return 'valid'
  if (strings.every((value) => value !== null)) return 'blank'
  return 'unknown'
}

/** Requires shared icon actions to carry the shared explanatory-tooltip contract. */
const requireActionButtonTooltip: RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Icon-sized shared Buttons and statically proven icon-only Buttons use ActionButton with a tooltip; icon-only ActionButtons need one too.',
    },
    schema: [],
    messages: {
      useActionButton:
        'Icon-size or icon-only Button actions must use ActionButton with a nonblank tooltip. Keep the control name in aria-label; the tooltip explains the action.',
      missingTooltip:
        'An icon-size or icon-only ActionButton needs a supplied nonblank tooltip. Keep its accessible name in aria-label as well.',
    },
  },
  create(context) {
    const buttons: ImportedJsxBindings = { named: new WeakSet(), namespaces: new WeakSet() }
    const actionButtons: ImportedJsxBindings = { named: new WeakSet(), namespaces: new WeakSet() }
    const icons: ImportedJsxBindings = { named: new WeakSet(), namespaces: new WeakSet() }
    const recordImports = (node: any) => {
      const source = node.source?.value
      const target =
        source === BUTTON_MODULE ? buttons : source === ACTION_BUTTON_MODULE ? actionButtons : null
      if (source === 'lucide-solid') {
        if (node.importKind === 'type') return
        for (const specifier of node.specifiers ?? []) {
          if (!specifier.local || specifier.importKind === 'type') continue
          if (specifier.type === 'ImportNamespaceSpecifier') icons.namespaces.add(specifier.local)
          else if (specifier.type === 'ImportSpecifier') {
            const imported = specifier.imported?.name ?? specifier.imported?.value
            if (typeof imported === 'string' && /^[A-Z]/.test(imported))
              icons.named.add(specifier.local)
          }
        }
        return
      }
      if (!target) return
      if (node.importKind === 'type') return
      for (const specifier of node.specifiers ?? []) {
        if (specifier.type === 'ImportNamespaceSpecifier' && specifier.local) {
          target.namespaces.add(specifier.local)
          continue
        }
        if (
          specifier.type !== 'ImportSpecifier' ||
          !specifier.local ||
          specifier.importKind === 'type'
        )
          continue
        const imported = specifier.imported?.name ?? specifier.imported?.value
        if (
          (source === BUTTON_MODULE && imported === 'Button') ||
          (source === ACTION_BUTTON_MODULE && imported === 'ActionButton')
        )
          target.named.add(specifier.local)
      }
    }

    return {
      Program(node: any) {
        for (const statement of node.body ?? [])
          if (statement.type === 'ImportDeclaration') recordImports(statement)
      },
      JSXElement(node: any) {
        const opening = node.openingElement
        const isButton = isImportedJsxComponent(opening.name, buttons, context, 'Button')
        const isActionButton = isImportedJsxComponent(
          opening.name,
          actionButtons,
          context,
          'ActionButton'
        )
        const asValues = attributeValues(opening, 'as')
        const targetsButton = asValues.some((value) =>
          isImportedJsxComponent(value, buttons, context, 'Button')
        )
        const targetsActionButton = asValues.some((value) =>
          isImportedJsxComponent(value, actionButtons, context, 'ActionButton')
        )
        if (!isButton && !isActionButton && !targetsButton && !targetsActionButton) return
        const iconSized = isIconButtonSize(opening)
        if (!iconSized && !hasStaticallyIconOnlyChildren(node, icons, context)) return
        if (isButton || targetsButton) {
          context.report({ node: opening, messageId: 'useActionButton' })
          return
        }
        if (!isActionButton && !targetsActionButton) return
        const status = actionTooltipStatus(opening)
        if (status === 'missing' || status === 'blank')
          context.report({ node: opening, messageId: 'missingTooltip' })
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
    'require-action-button-tooltip': requireActionButtonTooltip,
  },
}

export default plugin

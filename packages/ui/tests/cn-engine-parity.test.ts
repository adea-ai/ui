import { compileToTables } from 'cn/compiler'
import { createCn as createConfigCn, defaultConfig, mergeConfigs } from 'cn/config'
import { createCn as createTableCn } from 'cn/engine'
import { expect, test } from 'bun:test'
import type { ClassValue } from 'cn'
import cnConfig from '../cn.config'
import { cn } from '../src/lib/utils'

const referenceCn = createConfigCn(cnConfig)
const compiledTables = compileToTables(mergeConfigs(defaultConfig(), cnConfig))
const compiledCn = createTableCn(compiledTables.tables, compiledTables.validatorImpls)
const leftBracket = String.fromCharCode(91)
const rightBracket = String.fromCharCode(93)
const arbitraryWidth = `w-${leftBracket}length:var(--consumer-width)${rightBracket}`
const arbitraryColor = (name: string) => `bg-${leftBracket}color:var(--${name})${rightBracket}`
const arbitraryMaskType = (value: string) => `${leftBracket}mask-type:${value}${rightBracket}`

const cases: { name: string; inputs: ClassValue[]; expected: string }[] = [
  {
    name: 'custom design-system heights use last-wins semantics',
    inputs: ['h-control-lg', 'h-control-sm'],
    expected: 'h-control-sm',
  },
  {
    name: 'new 2xl design-system heights use last-wins semantics',
    inputs: ['h-control-xl', 'h-control-2xl'],
    expected: 'h-control-2xl',
  },
  {
    name: 'custom widths use last-wins semantics',
    inputs: ['w-sidebar', 'w-sidebar-compact'],
    expected: 'w-sidebar-compact',
  },
  {
    name: 'custom sizes use last-wins semantics',
    inputs: ['size-control-md', 'size-control-lg'],
    expected: 'size-control-lg',
  },
  {
    name: 'new 2xl design-system sizes use last-wins semantics',
    inputs: ['size-control-xl', 'size-control-2xl'],
    expected: 'size-control-2xl',
  },
  {
    name: 'dynamic consumer arbitrary width classes still conflict',
    inputs: [arbitraryWidth, 'w-full'],
    expected: 'w-full',
  },
  {
    name: 'arbitrary colors and arbitrary properties still conflict',
    inputs: [
      arbitraryColor('brand-a'),
      arbitraryColor('brand-b'),
      arbitraryMaskType('luminance'),
      arbitraryMaskType('alpha'),
    ],
    expected: [arbitraryColor('brand-b'), arbitraryMaskType('alpha')].join(' '),
  },
  {
    name: 'variants and responsive variants keep their independent class groups',
    inputs: ['hover:h-control-md', 'hover:h-control-sm', 'md:hover:h-control-lg'],
    expected: 'hover:h-control-sm md:hover:h-control-lg',
  },
  {
    name: 'important classes merge without crossing the important boundary',
    inputs: ['p-2', '!p-4', '!p-8'],
    expected: 'p-2 !p-8',
  },
  {
    name: 'RTL and LTR variants remain independent',
    inputs: ['rtl:ms-2', 'rtl:ms-4', 'ltr:ms-8'],
    expected: 'rtl:ms-4 ltr:ms-8',
  },
  {
    name: 'nested object and array inputs preserve clsx forwarding and conflict order',
    inputs: [
      'base',
      { 'h-control-lg': true, 'h-control-xs': false },
      ['w-sidebar', { 'w-rail': true }],
      'h-control-md',
    ],
    expected: 'base w-rail h-control-md',
  },
]

for (const { name, inputs, expected } of cases) {
  test(name, () => {
    expect(referenceCn(...inputs)).toBe(expected)
    expect(cn(...inputs)).toBe(expected)
    expect(compiledCn(...inputs)).toBe(expected)
  })
}

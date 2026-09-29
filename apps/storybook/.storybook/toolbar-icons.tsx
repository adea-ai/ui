/*
 * The manager's bundler transpiles JSX with the classic runtime and does not
 * inject or bind a `React` identifier — official addons ship pre-compiled code,
 * so this file is the only JSX the pipeline has to handle. These pragmas point
 * the transform at imported bindings, which the bundler then rewrites the same
 * way it rewrites any other import. The manager is a React document — the one
 * place React runs in this repository — which is why the restricted-imports
 * exception in `.oxlintrc.json` covers this file.
 */
/* @jsx createElement */
/* @jsxFrag Fragment */
// oxlint-disable-next-line no-unused-vars -- consumed by the JSX pragmas above, invisibly to the linter
import { createElement, Fragment, type JSX } from 'react'

/**
 * The three toolbar glyphs, inlined from Lucide.
 *
 * The manager is React and the library's icons are `lucide-solid`, so the
 * workshop cannot reuse them across the boundary — and `@storybook/icons` has no
 * sun-moon or palette. The paths are vendored verbatim from the `lucide-solid`
 * release this repository already depends on (ISC, same as the package), so the
 * toolbar draws exactly what the components draw and a Lucide update that
 * redraws a glyph shows up as a source diff here rather than silently diverging.
 *
 * Sizing follows the Storybook toolbar's own 14px icon convention.
 */
const iconProps = {
  width: 14,
  height: 14,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export function SunMoonIcon(): JSX.Element {
  return (
    <svg {...iconProps}>
      <path d="M12 2v2" />
      <path d="M14.837 16.385a6 6 0 1 1-7.223-7.222c.624-.147.97.66.715 1.248a4 4 0 0 0 5.26 5.259c.589-.255 1.396.09 1.248.715" />
      <path d="M16 12a4 4 0 0 0-4-4" />
      <path d="m19 5-1.256 1.256" />
      <path d="M20 12h2" />
    </svg>
  )
}

export function PaletteIcon(): JSX.Element {
  return (
    <svg {...iconProps}>
      <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  )
}

export function BrushIcon(): JSX.Element {
  return (
    <svg {...iconProps}>
      <path d="m11 10 3 3" />
      <path d="M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z" />
      <path d="M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031" />
    </svg>
  )
}

import { createCn } from 'cn/engine'
import type { CnFunction } from 'cn'
import tables from '#lib/cn-tables.generated'

/**
 * Merge conditional class values, letting the last conflicting utility win.
 *
 * Accepts an object whose keys are classes and whose values enable them, which
 * is the form the design-system linter can read statically:
 *
 *   cn('base', { 'is-open': open(), 'is-disabled': disabled() })
 *
 * A template literal (`cn(`base--${value}`)`) is invisible to the linter and
 * will be reported, because a class the linter cannot read is a class it
 * cannot check against the theme.
 *
 * `cn` also has to be told about the utilities this design system adds. Every
 * token-derived utility (`h-control-md`, `w-rail`, `p-control-lg`, …) is an
 * unknown name to a default merge instance. Left unregistered,
 * `cn('h-control-md', 'h-control-sm')` keeps both classes and the winner is
 * decided by stylesheet order rather than by the caller — a bug that only
 * shows up as a control that ignores its `size` prop, long after the line
 * that caused it was written.
 *
 * Compiling the design-system families into full tables makes "the last class
 * wins" true for the whole system, including for consumer overrides, without
 * loading the runtime config/compiler path.
 */
export const cn: CnFunction = createCn(tables)

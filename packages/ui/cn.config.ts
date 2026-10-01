import type { ConfigExtension } from 'cn/config'

/**
 * Runtime class groups used by the design system. `build-cn-tables.ts` passes
 * this extension to `cn build` in full mode so runtime classes from consumers
 * remain supported even when they do not appear in this package's sources.
 */
const cnConfig = {
  extend: {
    classGroups: {
      'ds-height': [
        {
          h: [
            'control-2xs',
            'control-xs',
            'control-sm',
            'control-md',
            'control-lg',
            'control-xl',
            'control-2xl',
            'row-sm',
            'row-md',
            'row-lg',
            'rail-item',
            'topbar',
            'statusbar',
          ],
        },
      ],
      'ds-width': [
        {
          w: ['rail', 'rail-expanded', 'sidebar', 'sidebar-compact'],
        },
      ],
      'ds-size': [
        {
          size: [
            'control-2xs',
            'control-xs',
            'control-sm',
            'control-md',
            'control-lg',
            'control-xl',
            'control-2xl',
            'rail-item',
          ],
        },
      ],
    },
  },
} satisfies ConfigExtension

export default cnConfig

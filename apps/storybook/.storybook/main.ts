import type { StorybookConfig } from 'storybook-solidjs-vite'
import tailwindcss from '@tailwindcss/vite'

/**
 * The design-system workshop.
 *
 * The story files live *next to the components they document*, inside
 * `packages/ui`, so a component and its documentation cannot drift apart: the
 * globs below reach out of this app on purpose. Everything in `./styleguide` is
 * the app's own content — the token galleries, the conventions, and the
 * full-window layout examples that need more room than a component folder.
 *
 * `viteFinal` wires Tailwind v4 in, because Storybook drives its own Vite
 * pipeline and the design system's CSS entry is a Tailwind sheet.
 */
const config: StorybookConfig = {
  stories: [
    '../styleguide/**/*.mdx',
    '../styleguide/**/*.stories.@(ts|tsx)',
    '../../../packages/ui/src/**/*.mdx',
    '../../../packages/ui/src/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
    '@storybook/addon-links',
  ],
  framework: {
    name: 'storybook-solidjs-vite',
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  viteFinal: async (viteConfig) => {
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()]
    return viteConfig
  },
  typescript: {
    // The story files are typechecked by `turbo run typecheck`; re-checking
    // them here only slows the workshop down.
    check: false,
  },
}

export default config

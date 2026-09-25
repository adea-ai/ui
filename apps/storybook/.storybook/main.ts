import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import type { StorybookConfig } from 'storybook-solidjs-vite'
import tailwindcss from '@tailwindcss/vite'

const require = createRequire(import.meta.url)

/**
 * Where the self-hosted typefaces actually live on disk.
 *
 * `fonts.css` pulls the faces in with `@import '@fontsource-variable/...'`, whose
 * `@font-face` rules point at `./files/*.woff2`. In a **build** Vite hashes and
 * emits those files, so the shipped workshop is fine — but the dev server serves
 * them from disk through `/@fs/`, and a package manager that installs into a shared
 * cache puts them outside Vite's allowed roots. The request is refused with a 403,
 * the `@font-face` fails, and the browser silently falls back to `sans-serif`.
 *
 * That failure is worth a paragraph because of how it looks: the interface still
 * renders, the type still has a hierarchy, and nothing says the default face is
 * missing. Every visual judgement made against the dev server would be against the
 * wrong typeface — which is exactly what happened here until a 403 on a `.woff2`
 * turned up while chasing something else.
 *
 * The paths are **resolved, not hardcoded**: they are read from the library that
 * owns the font dependency, so they are correct on any machine and any package
 * manager. A package that cannot be resolved is skipped rather than fatal, so the
 * workshop still starts if the fonts are absent.
 */
const fontDirs = (() => {
  const uiRequire = createRequire(require.resolve('@adea-ai/ui/package.json'))
  const packages = [
    '@fontsource-variable/space-grotesk',
    '@fontsource-variable/jetbrains-mono',
    '@fontsource-variable/geist',
    '@fontsource-variable/geist-mono',
  ]
  return packages.flatMap((name) => {
    try {
      return [dirname(uiRequire.resolve(`${name}/package.json`))]
    } catch {
      return []
    }
  })
})()

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

    // The dev server only. A build resolves and emits the font files itself, so
    // allowing these roots there would widen the config for no reason.
    viteConfig.server = {
      ...viteConfig.server,
      fs: {
        ...viteConfig.server?.fs,
        allow: [...(viteConfig.server?.fs?.allow ?? []), ...fontDirs],
      },
    }

    return viteConfig
  },
  typescript: {
    // The story files are typechecked by `turbo run typecheck`; re-checking
    // them here only slows the workshop down.
    check: false,
  },
}

export default config

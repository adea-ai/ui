import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { UpdateDialog, type UpdateAdapter, type UpdateState } from './update-dialog'

const CHANGELOG = `# 0.55.0

### Features
* **appearance:** move the appearance view into settings
* **dev-view:** copy-on-write worktree materialisation

### Bug Fixes
* **soak:** fail on a stalled stream, not on a slow machine
`

const NOTES = `### What changed

- The worktree materialisation now uses a copy-on-write clone.
- The soak lane fails on a stalled stream rather than a slow machine.

See the [release notes](https://example.com) for the full list.
`

/** An adapter that walks the phases on a timer, so the dialog is explorable. */
function demoAdapter(script: readonly UpdateState[], desktop = true): UpdateAdapter {
  let index = 0
  return {
    getStatus: async () => script[0]!,
    check: async () => script[Math.min(++index, script.length - 1)]!,
    install: async () => script[script.length - 1]!,
    isDesktopRuntime: () => desktop,
  }
}

const base: UpdateState = {
  phase: 'current',
  currentVersion: '0.55.0',
  changelog: CHANGELOG,
}

const meta = {
  title: 'Composites/Update Dialog',
  component: UpdateDialog,
  tags: ['autodocs'],
  // `adapter` is required, so the meta carries one; a story that supplies its own
  // `render` overrides it.
  args: { adapter: demoAdapter([base]), appName: 'Adea' },
  parameters: {
    docs: {
      description: {
        component:
          "A software-update surface driven by an adapter, because the transport is the one thing a component library cannot implement — it is signed, downloaded and applied by the application's own updater. What is general is the phase machine and how each phase is presented. Two details are hard-won: a refused install answers with a normal payload whose phase is `failed` rather than throwing (without handling that, clicking install looks like nothing happened), and busy is derived from the snapshot as well as the click, because an update can be downloading while the dialog is open.",
      },
    },
  },
} satisfies Meta<typeof UpdateDialog>

export default meta
type Story = StoryObj<typeof meta>

export const UpToDate: Story = { args: { adapter: demoAdapter([base]), appName: 'Adea' } }

export const UpdateAvailable: Story = {
  args: {
    adapter: demoAdapter([
      {
        ...base,
        phase: 'available',
        availableVersion: '0.56.0',
        releaseDate: '2026-09-24',
        releaseNotes: NOTES,
        releaseUrl: 'https://example.com/releases',
      },
    ]),
    appName: 'Adea',
  },
}

/** Progress with both numbers, so a stalled download is distinguishable from a slow one. */
export const Downloading: Story = {
  args: {
    adapter: demoAdapter([
      {
        ...base,
        phase: 'downloading',
        availableVersion: '0.56.0',
        downloadedBytes: 13_000_000,
        totalBytes: 50_400_000,
        releaseNotes: NOTES,
      },
    ]),
    appName: 'Adea',
  },
}

/** A download whose length the server did not send: the bar is indeterminate. */
export const UnknownLength: Story = {
  args: {
    adapter: demoAdapter([
      { ...base, phase: 'downloading', availableVersion: '0.56.0', downloadedBytes: 4_000_000 },
    ]),
    appName: 'Adea',
  },
}

/** A refused install answers with `phase: 'failed'` rather than throwing. */
export const InstallFailed: Story = {
  args: {
    adapter: demoAdapter([
      {
        ...base,
        phase: 'failed',
        availableVersion: '0.56.0',
        error: 'The archive signature did not match the release key.',
      },
    ]),
    appName: 'Adea',
  },
}

export const RestartRequired: Story = {
  args: {
    adapter: demoAdapter([
      { ...base, phase: 'installed', availableVersion: '0.56.0', restartRequired: true },
    ]),
    appName: 'Adea',
  },
}

/**
 * In a browser build there is no installer. The honest thing is to say so rather
 * than disable a button with no reason.
 */
export const BrowserRuntime: Story = {
  args: { adapter: demoAdapter([base], false), appName: 'Adea' },
}

/**
 * Open on mount, so the dialog's *content* is in the accessibility scan. Every
 * other story here is trigger-based and closed, which means the panel — the
 * progress bar, the release-notes scroller, the changelog scroller — has never
 * been checked by the lane. This one is, and it is the story that found the
 * scrollers that needed their own tab stop.
 *
 * The trigger is still rendered, so the dialog is reachable again after closing.
 */
export const WithReleaseNotes: Story = {
  args: {
    defaultOpen: true,
    adapter: demoAdapter([
      {
        ...base,
        phase: 'available',
        availableVersion: '0.56.0',
        releaseDate: '2026-09-24',
        releaseNotes: NOTES,
        releaseUrl: 'https://example.com/releases',
      },
    ]),
  },
}

import { createSignal } from 'solid-js'
import type { ThemeEngine } from '#lib/theme-engine'
import { lightThemeEngine } from '#lib/theme-engine-light'
import type { ThemeCatalogueSource } from './theme-provider-value'

/**
 * The full catalogue engine once something has asked for it, shared by every lazy
 * provider and every caller of {@link loadThemeCatalogue} in the page. A provider
 * created after the load starts with it already in hand.
 */
let loadedEngine: ThemeEngine | undefined
let loading: Promise<ThemeEngine> | undefined

/**
 * Load the whole theme catalogue (about 129 KB raw, 34 KB gzipped) and resolve to the
 * engine backed by it. Idempotent: every call shares one import, and a failed import is
 * forgotten so the next call retries.
 *
 * The lazy provider calls this itself the moment a selection needs a theme beyond the
 * default pair. Call it earlier — when a settings page mounts, or on hover of its
 * entry — to have the picker ready by the time it opens.
 */
export function loadThemeCatalogue(): Promise<ThemeEngine> {
  if (loadedEngine) return Promise.resolve(loadedEngine)
  loading ??= import('#lib/theme-catalogue').then(
    (module) => {
      loadedEngine = module.catalogueThemeEngine
      return loadedEngine
    },
    (error: unknown) => {
      loading = undefined
      throw error
    }
  )
  return loading
}

/** A catalogue source for one provider: the shipped defaults until the load resolves. */
export function createLazyCatalogue(): ThemeCatalogueSource {
  const [full, setFull] = createSignal<ThemeEngine | undefined>(loadedEngine)
  const [failed, setFailed] = createSignal(false)
  const load = () =>
    loadThemeCatalogue().then(
      (loaded) => {
        setFailed(false)
        setFull(() => loaded)
      },
      () => {
        // The theme the stylesheet painted stays; the next request retries.
        setFailed(true)
      }
    )
  return {
    engine: () => full() ?? lightThemeEngine,
    loaded: () => full() !== undefined,
    failed,
    load,
  }
}

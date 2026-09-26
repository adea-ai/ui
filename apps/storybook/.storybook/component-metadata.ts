import type { PluginOption } from 'vite'

/** Keep prop documentation for our components without extracting dependency TSX. */
export async function scopeComponentMetadataPlugins(
  options: PluginOption[]
): Promise<PluginOption[]> {
  return Promise.all(
    options.map(async (option) => {
      const plugin = await option
      if (Array.isArray(plugin)) return scopeComponentMetadataPlugins(plugin)
      if (!plugin || plugin.name !== 'storybook:solid-component-meta') return plugin
      const transform = plugin.transform
      if (!transform || typeof transform === 'function') {
        throw new Error(
          'The Solid metadata plugin changed its filter contract; review the workshop scope.'
        )
      }
      const filter = transform.filter
      const existing = filter?.id?.exclude
      return {
        ...plugin,
        transform: {
          ...transform,
          filter: {
            ...filter,
            id: {
              ...filter?.id,
              // Vite resolves our workspace sources outside node_modules. Their
              // imported dependency types are still available to the extractor.
              exclude: [
                ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
                /[/\\]node_modules[/\\]/,
              ],
            },
          },
        },
      }
    })
  )
}

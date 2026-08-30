import { extname, relative } from 'pathe'

export interface TourSource {
  id: string
  path: string
}

export function tourIdFromPath(toursDirectory: string, path: string): string {
  const extension = extname(path)
  const relativePath = relative(toursDirectory, path)
    .slice(0, -extension.length)
    .replace(/\/index$/u, '')
  if (!relativePath || relativePath.startsWith('../')) {
    throw new Error(`[nuxt-tour] Invalid tour file path: ${path}.`)
  }
  return relativePath
}

export interface TourLayerSource {
  directory: string
  files: readonly string[]
}

/** Merge project-first Nuxt layers. Higher-priority tour files override lower layers. */
export function layeredTourSources(layers: readonly TourLayerSource[]): TourSource[] {
  const merged = new Map<string, TourSource>()
  for (const layer of layers) {
    for (const source of tourSources(layer.directory, layer.files)) {
      if (!merged.has(source.id)) merged.set(source.id, source)
    }
  }
  return [...merged.values()].sort((first, second) => first.id.localeCompare(second.id))
}

export function tourSources(toursDirectory: string, files: readonly string[]): TourSource[] {
  const sources = files
    .map(path => ({ id: tourIdFromPath(toursDirectory, path), path }))
    .sort((first, second) => first.id.localeCompare(second.id))
  const ids = new Set<string>()
  for (const source of sources) {
    if (ids.has(source.id)) throw new Error(`[nuxt-tour] Duplicate generated tour ID: ${source.id}.`)
    ids.add(source.id)
  }
  return sources
}

export function runtimeRegistryTemplate(sources: readonly TourSource[]): string {
  const imports = sources.map((source, index) => (
    `import tour${index} from ${JSON.stringify(source.path)}`
  ))
  const entries = sources.map((source, index) => (
    `  [${JSON.stringify(source.id)}, tour${index}],`
  ))
  return [
    ...imports,
    '',
    'const entries = [',
    ...entries,
    ']',
    '',
    'for (const [expectedId, tour] of entries) {',
    '  if (tour.id !== expectedId) {',
    '    throw new Error(`[nuxt-tour] Tour file ${expectedId} exports ID ${tour.id}. The file path and definition ID must match.`)',
    '  }',
    '}',
    '',
    'export const tours = entries.map(([, tour]) => tour)',
    '',
  ].join('\n')
}

export function registryTypesTemplate(
  sources: readonly TourSource[],
): string {
  const imports = sources.map((source, index) => (
    `import type tour${index} from ${JSON.stringify(source.path)}`
  ))
  const properties = sources.map((source, index) => (
    `    ${JSON.stringify(source.id)}: typeof tour${index}`
  ))
  const augmentation = [
    'declare module "@lupinum/nuxt-tour/registry" {',
    '  interface TourRegistry {',
    ...properties,
    '  }',
    '}',
    '',
  ]
  return [
    ...imports,
    '',
    ...augmentation,
    'export {}',
    '',
  ].join('\n')
}

import {
  addComponent,
  addImports,
  addPluginTemplate,
  addTemplate,
  addTypeTemplate,
  createResolver,
  defineNuxtModule,
  getLayerDirectories,
  resolveFiles,
  updateTemplates,
} from '@nuxt/kit'
import { isAbsolute, normalize, resolve } from 'pathe'
import { layeredTourSources, registryTypesTemplate, runtimeRegistryTemplate } from './discovery'
import { defaultTourRuntimeOptions, normalizeTourRuntimeOptions } from './runtime/options'
import type { TourMissingTarget } from './runtime/types'

export { TourError } from './runtime/errors'
export type { TourErrorCode, TourErrorContext } from './runtime/errors'

export type {
  TourCardSlotProps,
  TourController,
  TourDefinition,
  TourEndReason,
  TourEvent,
  TourEventMap,
  TourEventType,
  TourInteraction,
  TourLabels,
  TourMissingTarget,
  TourPlacement,
  TourRoute,
  TourRuntimeOptions,
  TourStartOptions,
  TourStep,
  TourStepContext,
  TourStepId,
  TourTarget,
  TourTargetId,
} from './runtime/types'

export interface ModuleOptions {
  /** How long a step waits for a late-rendered target. @default 5000 */
  targetTimeout?: number
  /** What to do when a target cannot be found. @default 'error' */
  missingTarget?: TourMissingTarget
  /** Built-in CSS to include. @default 'all' */
  css?: 'all' | 'structure' | false
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@lupinum/nuxt-tour',
    configKey: 'nuxtTour',
    docs: 'https://nuxt-tour.lupinum.com',
    compatibility: {
      nuxt: '^4.0.0',
    },
  },
  defaults: {
    targetTimeout: defaultTourRuntimeOptions.targetTimeout,
    missingTarget: defaultTourRuntimeOptions.missingTarget,
    css: 'all',
  },
  async setup(options, nuxt) {
    const runtimeOptions = normalizeTourRuntimeOptions(options)
    if (options.css !== 'all' && options.css !== 'structure' && options.css !== false) {
      throw new TypeError('[nuxt-tour] css must be all, structure, or false.')
    }

    const resolver = createResolver(import.meta.url)
    nuxt.options.alias['@lupinum/nuxt-tour/registry'] = resolver.resolve('./runtime/registry')
    const toursDirectories = getLayerDirectories(nuxt)
      .map(layer => resolve(layer.app, 'tours'))
    const registryFilename = 'nuxt-tour/registry.mjs'
    const typesFilename = 'types/nuxt-tour.d.ts'

    const extensionPattern = `**/*{${nuxt.options.extensions.join(',')}}`
    const loadSources = async () => layeredTourSources(await Promise.all(
      toursDirectories.map(async directory => ({
        directory,
        files: (await resolveFiles(directory, [extensionPattern]))
          .filter(path => !/\.d\.[cm]?[jt]s$/u.test(path)),
      })),
    ))

    addTemplate({
      filename: registryFilename,
      getContents: async () => runtimeRegistryTemplate(await loadSources()),
    })

    addTypeTemplate({
      filename: typesFilename,
      getContents: async () => registryTypesTemplate(await loadSources()),
    })

    addPluginTemplate({
      filename: 'nuxt-tour.mjs',
      getContents: () => [
        `import { createNuxtTourPlugin } from ${JSON.stringify(resolver.resolve('./runtime/nuxt-plugin'))}`,
        `import { tours } from '#build/${registryFilename}'`,
        '',
        `export default createNuxtTourPlugin(tours, ${JSON.stringify(runtimeOptions)}, ${JSON.stringify({
          pageTransition: Boolean(nuxt.options.app.pageTransition),
        })})`,
        '',
      ].join('\n'),
    })

    addImports({ name: 'defineTour', from: resolver.resolve('./runtime/vue') })
    addImports({ name: 'useNuxtTour', from: resolver.resolve('./runtime/use-nuxt-tour') })
    addImports({ name: 'useTourTarget', from: resolver.resolve('./runtime/vue') })

    addComponent({ name: 'TourHost', filePath: resolver.resolve('./runtime/vue/TourHost.vue') })

    if (options.css === 'all') nuxt.options.css.push(resolver.resolve('./runtime/style.css'))
    if (options.css === 'structure') nuxt.options.css.push(resolver.resolve('./runtime/structure.css'))

    nuxt.hook('builder:watch', async (event, path) => {
      if (event !== 'add' && event !== 'unlink') return
      const absolutePath = normalize(isAbsolute(path) ? path : resolve(nuxt.options.srcDir, path))
      if (!toursDirectories.some(directory => absolutePath.startsWith(`${normalize(directory)}/`))) return
      await updateTemplates({ filter: template => (
        template.filename === registryFilename || template.filename === typesFilename
      ) })
    })
  },
})

import { resolve, sep } from 'node:path'
import {
  addComponent,
  addImports,
  addPluginTemplate,
  addTemplate,
  addTypeTemplate,
  createResolver,
  defineNuxtModule,
  resolveFiles,
  updateTemplates,
} from '@nuxt/kit'
import { registryTypesTemplate, runtimeRegistryTemplate, tourSources } from './discovery'
import type { TourMissingTarget } from './runtime/types'

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
    compatibility: {
      nuxt: '^4.0.0',
    },
  },
  defaults: {
    targetTimeout: 5000,
    missingTarget: 'error',
    css: 'all',
  },
  async setup(options, nuxt) {
    if (typeof options.targetTimeout !== 'number'
      || !Number.isFinite(options.targetTimeout)
      || options.targetTimeout < 0) {
      throw new TypeError('[nuxt-tour] targetTimeout must be a finite, non-negative number.')
    }
    if (options.missingTarget !== 'error' && options.missingTarget !== 'skip') {
      throw new TypeError('[nuxt-tour] missingTarget must be error or skip.')
    }
    if (options.css !== 'all' && options.css !== 'structure' && options.css !== false) {
      throw new TypeError('[nuxt-tour] css must be all, structure, or false.')
    }

    const resolver = createResolver(import.meta.url)
    const toursDirectory = resolve(nuxt.options.srcDir, nuxt.options.dir.app, 'tours')
    const registryFilename = 'nuxt-tour/registry.mjs'
    const typesFilename = 'types/nuxt-tour.d.ts'

    const loadSources = async () => tourSources(
      toursDirectory,
      (await resolveFiles(toursDirectory, ['**/*.{ts,mts,js,mjs}']))
        .filter(path => !/\.d\.m?ts$/u.test(path)),
    )

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
        `export default createNuxtTourPlugin(tours, ${JSON.stringify({
          targetTimeout: options.targetTimeout,
          missingTarget: options.missingTarget,
        })})`,
        '',
      ].join('\n'),
    })

    for (const name of ['defineTour', 'useTour', 'useTourTarget'] as const) {
      addImports({ name, from: resolver.resolve('./runtime/vue') })
    }

    addComponent({ name: 'TourHost', filePath: resolver.resolve('./runtime/vue/TourHost.vue') })
    addComponent({ name: 'TourContent', filePath: resolver.resolve('./runtime/vue/TourContent') })

    if (options.css === 'all') nuxt.options.css.push(resolver.resolve('./runtime/style.css'))
    if (options.css === 'structure') nuxt.options.css.push(resolver.resolve('./runtime/structure.css'))

    nuxt.hook('builder:watch', async (event, path) => {
      if (event !== 'add' && event !== 'unlink') return
      const absolutePath = resolve(nuxt.options.srcDir, path)
      const directoryPrefix = toursDirectory.endsWith(sep) ? toursDirectory : `${toursDirectory}${sep}`
      if (!absolutePath.startsWith(directoryPrefix)) return
      await updateTemplates({ filter: template => (
        template.filename === registryFilename || template.filename === typesFilename
      ) })
    })
  },
})

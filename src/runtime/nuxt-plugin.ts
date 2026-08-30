import { defineNuxtPlugin, useRouter } from '#app'
import { createNuxtRouterAdapter } from './nuxt-router'
import type { NuxtTourIntegrationOptions } from './nuxt-router'
import type { TourDefinition, TourRuntimeOptions } from './types'
import { installTour } from './vue/plugin'

export function createNuxtTourPlugin(
  tours: readonly TourDefinition[],
  options: TourRuntimeOptions,
  integration: NuxtTourIntegrationOptions,
) {
  return defineNuxtPlugin({
    name: 'nuxt-tour',
    setup(nuxtApp) {
      const router = useRouter()
      const runtime = installTour(nuxtApp.vueApp, {
        tours,
        ...options,
      }, callback => nuxtApp.runWithContext(callback), createNuxtRouterAdapter(router, nuxtApp, integration))
      return {
        provide: { nuxtTour: runtime },
      }
    },
  })
}

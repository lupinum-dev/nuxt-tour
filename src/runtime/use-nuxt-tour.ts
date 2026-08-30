import { useNuxtApp } from '#app'
import type { TourRegistry } from '@lupinum/nuxt-tour/registry'
import type { TourController, TourStepId } from './types'
import type { TourVueRuntime } from './vue/runtime'

export function useNuxtTour<Id extends keyof TourRegistry & string>(
  id: Id,
): TourController<TourStepId<TourRegistry[Id]>> {
  // The generated Nuxt plugin and registry prove both sides of this boundary.
  const runtime = (useNuxtApp() as ReturnType<typeof useNuxtApp> & {
    readonly $nuxtTour: TourVueRuntime
  }).$nuxtTour
  return runtime.controller(id) as TourController<TourStepId<TourRegistry[Id]>>
}

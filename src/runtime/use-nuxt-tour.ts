import type { TourRegistry } from '@lupinum/nuxt-tour/registry'
import type { TourController, TourStepId } from './types'
import { useTourRuntime } from './vue/use-runtime'

export function useNuxtTour<Id extends keyof TourRegistry & string>(
  id: Id,
): TourController<TourStepId<TourRegistry[Id]>> {
  return useTourRuntime('useNuxtTour()').controller(id)
}

import type { TourController, TourDefinition, TourStepId } from '../types'
import { useTourRuntime } from './use-runtime'

export function useTour<Definition extends TourDefinition>(
  definition: Definition,
): TourController<TourStepId<Definition>> {
  return useTourRuntime('useTour()').controller(definition)
}

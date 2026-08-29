import { inject } from 'vue'
import { TourError } from '../errors'
import type { TourController, TourDefinition, TourRegistry, TourStepId } from '../types'
import { tourRuntimeKey } from './injection'

export function useTour<Definition extends TourDefinition>(
  definition: Definition,
): TourController<TourStepId<Definition>>
export function useTour<Id extends keyof TourRegistry & string>(
  id: Id,
): TourController<TourStepId<TourRegistry[Id]>>
export function useTour(id: string): TourController
export function useTour(definitionOrId: TourDefinition | string): TourController {
  const runtime = inject(tourRuntimeKey)
  if (!runtime) {
    throw new TourError('INVALID_DEFINITION', 'The tour plugin is not installed in this Vue application.')
  }
  return typeof definitionOrId === 'string'
    ? runtime.controller(definitionOrId)
    : runtime.controller(definitionOrId)
}

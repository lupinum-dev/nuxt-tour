import { hasInjectionContext, inject } from 'vue'
import { TourError } from '../errors'
import { tourRuntimeKey } from './injection'
import type { TourVueRuntime } from './runtime'

export function useTourRuntime(consumer: string): TourVueRuntime {
  const runtime = hasInjectionContext() ? inject(tourRuntimeKey) : undefined
  if (runtime) return runtime
  throw new TourError(
    'INVALID_DEFINITION',
    `${consumer} requires the Nuxt Tour plugin in the current Vue application.`,
  )
}

import type { DefineComponent } from 'vue'
import type { TourCardSlotProps, TourLabels, TourStep } from '../types'
import { TourContent as TourContentComponent } from './TourContent'
import TourHostComponent from './TourHost.vue'

type PublicTourHost = DefineComponent<{
  labels?: Partial<TourLabels>
}> & {
  new(): {
    $slots: {
      card?: (props: TourCardSlotProps) => unknown
    }
  }
}

/** Public component types stay stable across the supported Vue 3 range. */
export const TourContent = TourContentComponent as DefineComponent<{ step: TourStep }>
export const TourHost = TourHostComponent as PublicTourHost

export { defineTour } from '../definition'
export { TourError } from '../errors'
export type { TourErrorCode, TourErrorContext } from '../errors'
export type {
  TourCardSlotProps,
  TourController,
  TourDefinition,
  TourEndReason,
  TourEvent,
  TourEventMap,
  TourEventType,
  TourInteraction,
  TourId,
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
} from '../types'
export type { TourRegistry, TourTargetId } from '@lupinum/nuxt-tour/registry'
export { createTourPlugin } from './plugin'
export type { TourPlugin, TourPluginOptions, VueRouterLike } from './plugin'
export { useTour } from './use-tour'
export { useTourTarget } from './use-tour-target'

declare module 'vue' {
  interface GlobalDirectives {
    vTourTarget: import('./tour-target-directive').TourTargetDirective
  }
}

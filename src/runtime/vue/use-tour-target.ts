import { inject, onScopeDispose, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { TourError } from '../errors'
import { tourRuntimeKey } from './injection'

export function useTourTarget(
  id: string,
  target: MaybeRefOrGetter<HTMLElement | null | undefined>,
): () => void {
  const runtime = inject(tourRuntimeKey)
  if (!runtime) {
    throw new TourError('INVALID_DEFINITION', 'The tour plugin is not installed in this Vue application.')
  }

  let unregister: (() => void) | undefined
  const stopWatch = watch(
    () => toValue(target),
    (element) => {
      unregister?.()
      unregister = element ? runtime.targets.register(id, element) : undefined
    },
    { immediate: true, flush: 'post' },
  )
  const stop = () => {
    stopWatch()
    unregister?.()
    unregister = undefined
  }
  onScopeDispose(stop)
  return stop
}

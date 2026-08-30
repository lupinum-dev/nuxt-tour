import { onScopeDispose, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { TourTargetId } from '../types'
import { useTourRuntime } from './use-runtime'

export function useTourTarget<Id extends TourTargetId>(
  id: Id,
  target: MaybeRefOrGetter<Element | null | undefined>,
): () => void {
  const runtime = useTourRuntime('useTourTarget()')

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

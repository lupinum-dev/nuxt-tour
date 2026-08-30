import type { ObjectDirective } from 'vue'
import type { TourTargetRegistry } from '../targets'
import type { TourTargetId } from '../types'

function targetId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('v-tour-target requires a non-empty string ID.')
  }
  return value
}

export type TourTargetDirective = ObjectDirective<Element, TourTargetId>

export function createTourTargetDirective(
  registry: TourTargetRegistry,
): TourTargetDirective {
  const registrations = new WeakMap<Element, () => void>()

  const register = (element: Element, value: unknown) => {
    const id = targetId(value)
    registrations.get(element)?.()
    element.setAttribute('data-tour-target', id)
    registrations.set(element, registry.register(id, element))
  }

  return {
    getSSRProps(binding) {
      return { 'data-tour-target': targetId(binding.value) }
    },
    mounted(element, binding) {
      register(element, binding.value)
    },
    updated(element, binding) {
      if (binding.value !== binding.oldValue) register(element, binding.value)
    },
    beforeUnmount(element) {
      registrations.get(element)?.()
      registrations.delete(element)
      element.removeAttribute('data-tour-target')
    },
  }
}

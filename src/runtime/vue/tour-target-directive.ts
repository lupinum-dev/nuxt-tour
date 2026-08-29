import type { ObjectDirective } from 'vue'

function targetId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('v-tour-target requires a non-empty string ID.')
  }
  return value
}

export const vTourTarget: ObjectDirective<HTMLElement, string> = {
  getSSRProps(binding) {
    return { 'data-tour-target': targetId(binding.value) }
  },
  mounted(element, binding) {
    element.dataset.tourTarget = targetId(binding.value)
  },
  updated(element, binding) {
    element.dataset.tourTarget = targetId(binding.value)
  },
  beforeUnmount(element, binding) {
    if (element.dataset.tourTarget === binding.value) delete element.dataset.tourTarget
  },
}

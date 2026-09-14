import type { InjectionKey } from 'vue'
import type { TourVueRuntime } from './runtime'

// Vite can evaluate this module in both the optimized entry and an external SFC.
// Share the key across those copies; provided runtime values remain app-scoped.
export const tourRuntimeKey: InjectionKey<TourVueRuntime> = Symbol.for('@lupinum/nuxt-tour/runtime')

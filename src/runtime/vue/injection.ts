import type { InjectionKey } from 'vue'
import type { TourVueRuntime } from './runtime'

export const tourRuntimeKey: InjectionKey<TourVueRuntime> = Symbol('nuxt-tour-runtime')

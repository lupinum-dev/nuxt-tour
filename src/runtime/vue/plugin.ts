import { nextTick } from 'vue'
import type { App } from 'vue'
import type { TourDefinition, TourRoute, TourRuntimeOptions } from '../types'
import { tourRuntimeKey } from './injection'
import { vTourTarget } from './tour-target-directive'
import { TourVueRuntime } from './runtime'
import type { TourRouterAdapter } from './runtime'

export interface TourPluginOptions extends TourRuntimeOptions {
  tours: readonly TourDefinition[]
  router?: TourRouterAdapter | VueRouterLike
}

/** The structural part of Vue Router used by the tour runtime. */
export interface VueRouterLike {
  push: (...arguments_: never[]) => unknown
  replace?: (...arguments_: never[]) => unknown
}

export interface TourPlugin {
  install: (app: App) => void
}

interface TourInstallation {
  plugin: TourPlugin
  runtime: TourVueRuntime
}

function abortError(): Error {
  return new DOMException('The tour transition was aborted.', 'AbortError')
}

function normalizeRouter(router: TourPluginOptions['router']): TourRouterAdapter | undefined {
  if (!router || 'navigate' in router) return router
  return {
    async navigate(route: TourRoute, signal: AbortSignal) {
      if (signal.aborted) throw abortError()
      const shouldReplace = typeof route === 'object' && route.replace === true
      const location = shouldReplace ? { ...route, replace: undefined } : route
      const navigate = shouldReplace && router.replace ? router.replace : router.push
      const failure = await (navigate as (destination: TourRoute) => unknown).call(router, location)
      if (failure instanceof Error) throw failure
      if (signal.aborted) throw abortError()
      await nextTick()
    },
  }
}

export function createTourInstallation(options: TourPluginOptions): TourInstallation {
  const runtime = new TourVueRuntime(options.tours, options, normalizeRouter(options.router))
  return {
    runtime,
    plugin: {
      install(app: App) {
        app.provide(tourRuntimeKey, runtime)
        app.directive('tour-target', vTourTarget)
      },
    },
  }
}

export function createTourPlugin(options: TourPluginOptions): TourPlugin {
  return createTourInstallation(options).plugin
}

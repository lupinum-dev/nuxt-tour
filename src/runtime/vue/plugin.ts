import { nextTick } from 'vue'
import type { App, Plugin } from 'vue'
import { tourNavigationAbort } from '../router'
import type { TourRouterAdapter } from '../router'
import type { MaybePromise, TourDefinition, TourRoute, TourRuntimeOptions } from '../types'
import { tourRuntimeKey } from './injection'
import { createTourTargetDirective } from './tour-target-directive'
import { TourVueRuntime } from './runtime'

export interface TourPluginOptions extends TourRuntimeOptions {
  tours: readonly TourDefinition[]
  router?: VueRouterLike
}

/** The structural part of Vue Router used by the tour runtime. */
export interface VueRouterLike {
  push(route: TourRoute): unknown
  replace?(route: TourRoute): unknown
  afterEach?(handler: () => void): () => void
}

export type TourPlugin = Plugin

function createVueRouterAdapter(router: VueRouterLike | undefined): TourRouterAdapter | undefined {
  if (!router) return
  let internalNavigations = 0
  return {
    async navigate(route: TourRoute, signal: AbortSignal) {
      if (signal.aborted) throw tourNavigationAbort()
      const shouldReplace = typeof route === 'object' && route.replace === true
      let location = route
      if (shouldReplace && typeof route === 'object') {
        const { replace: _replace, ...destination } = route
        location = destination
      }
      const navigate = shouldReplace && router.replace ? router.replace : router.push
      internalNavigations += 1
      try {
        const failure = await navigate.call(router, location)
        if (failure instanceof Error) throw failure
        if (signal.aborted) throw tourNavigationAbort()
        await nextTick()
      }
      finally {
        internalNavigations -= 1
      }
    },
    subscribe: router.afterEach
      ? onExternalNavigation => router.afterEach!(() => {
        if (internalNavigations === 0) onExternalNavigation()
      })
      : undefined,
  }
}

export function installTour(
  app: App,
  options: TourPluginOptions,
  runWithContext: <Value>(callback: () => MaybePromise<Value>) => MaybePromise<Value>
    = callback => app.runWithContext(callback),
  routerAdapter: TourRouterAdapter | undefined = createVueRouterAdapter(options.router),
): TourVueRuntime {
  const runtime = new TourVueRuntime(
    options.tours,
    options,
    routerAdapter,
    runWithContext,
  )
  app.provide(tourRuntimeKey, runtime)
  app.directive('tour-target', createTourTargetDirective(runtime.targets))
  // app.onUnmount was added after Vue 3.3; keep the supported 3.3 baseline.
  const appWithUnmount = app as App & { onUnmount?: (callback: () => void) => void }
  appWithUnmount.onUnmount?.(() => runtime.dispose())
  return runtime
}

export function createTourPlugin(options: TourPluginOptions): TourPlugin {
  return {
    install(app: App) {
      installTour(app, options)
    },
  }
}

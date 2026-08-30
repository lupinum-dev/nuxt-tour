import { nextTick } from 'vue'
import { isNavigationFailure } from 'vue-router'
import type { NuxtApp } from '#app'
import type { LocationQueryRaw, RouteLocationRaw, RouteParamsRawGeneric, Router } from 'vue-router'
import { tourNavigationAbort } from './router'
import type { TourRouterAdapter } from './router'
import type { TourRoute, TourRouteParamsValue, TourRouteQueryValue } from './types'

const routeSettlementTimeout = 10_000

export interface NuxtTourIntegrationOptions {
  readonly pageTransition: boolean
}

function mutableParams(
  values: Readonly<Record<string, TourRouteParamsValue>> | undefined,
): RouteParamsRawGeneric | undefined {
  if (!values) return
  const mutable: RouteParamsRawGeneric = {}
  for (const [key, value] of Object.entries(values)) {
    mutable[key] = typeof value === 'object' && value !== null ? [...value] : value
  }
  return mutable
}

function mutableQuery(
  values: Readonly<Record<string, TourRouteQueryValue>> | undefined,
): LocationQueryRaw | undefined {
  if (!values) return
  const mutable: LocationQueryRaw = {}
  for (const [key, value] of Object.entries(values)) {
    mutable[key] = typeof value === 'object' && value !== null ? [...value] : value
  }
  return mutable
}

function routeLocation(route: TourRoute): {
  location: RouteLocationRaw
  replace: boolean
} {
  if (typeof route === 'string') return { location: route, replace: false }
  const { replace = false, ...destination } = route
  const location: RouteLocationRaw = 'name' in destination
    ? {
        name: destination.name,
        params: mutableParams(destination.params),
        query: mutableQuery(destination.query),
        hash: destination.hash,
      }
    : {
        path: destination.path,
        query: mutableQuery(destination.query),
        hash: destination.hash,
      }
  return {
    location,
    replace,
  }
}

function waitForSettlement(
  promise: Promise<void>,
  signal: AbortSignal,
  label: string,
): Promise<void> {
  if (signal.aborted) return Promise.reject(tourNavigationAbort())
  return new Promise<void>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      cleanup()
      reject(new Error(`[nuxt-tour] Timed out while waiting for ${label}.`))
    }, routeSettlementTimeout)
    const abort = () => {
      cleanup()
      reject(tourNavigationAbort())
    }
    const cleanup = () => {
      globalThis.clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
    }
    signal.addEventListener('abort', abort, { once: true })
    void promise.then(() => {
      cleanup()
      resolve()
    }, (error) => {
      cleanup()
      reject(error)
    })
  })
}

/** Owns all Nuxt-specific routing lifecycle and settlement behavior. */
export function createNuxtRouterAdapter(
  router: Router,
  nuxtApp: NuxtApp,
  integration: NuxtTourIntegrationOptions,
): TourRouterAdapter {
  let expectedDestination: string | null = null

  return {
    async navigate(route, signal) {
      if (signal.aborted) throw tourNavigationAbort()
      const { location, replace } = routeLocation(route)
      const destination = router.resolve(location)
      if (destination.fullPath === router.currentRoute.value.fullPath) return

      let pageStarted = false
      let pageFinished = false
      let resolvePage!: () => void
      let resolveTransition!: () => void
      const pageSettled = new Promise<void>((resolve) => {
        resolvePage = resolve
      })
      const transitionSettled = new Promise<void>((resolve) => {
        resolveTransition = resolve
      })
      const stopPageStart = nuxtApp.hook('page:start', () => {
        pageStarted = true
      })
      const stopPageFinish = nuxtApp.hook('page:finish', () => {
        if (router.currentRoute.value.fullPath !== destination.fullPath) return
        pageFinished = true
        resolvePage()
      })
      const stopTransitionFinish = nuxtApp.hook('page:transition:finish', () => {
        if (router.currentRoute.value.fullPath === destination.fullPath) resolveTransition()
      })

      expectedDestination = destination.fullPath
      try {
        const failure = await (replace ? router.replace(location) : router.push(location))
        if (isNavigationFailure(failure)) throw failure
        if (signal.aborted) throw tourNavigationAbort()
        if (router.currentRoute.value.fullPath !== destination.fullPath) {
          throw tourNavigationAbort('The tour route was superseded by another navigation.')
        }

        // Let Nuxt start a Suspense cycle before deciding whether one exists.
        await nextTick()
        await nextTick()
        if (pageStarted && !pageFinished) {
          await waitForSettlement(pageSettled, signal, 'the destination page')
        }

        const routeTransition = destination.meta.pageTransition
        const hasTransition = routeTransition === false
          ? false
          : Boolean(routeTransition ?? integration.pageTransition)
        // Query/hash changes can reuse a page even with a global transition.
        if (hasTransition && pageStarted) {
          await waitForSettlement(transitionSettled, signal, 'the destination page transition')
        }
        await nextTick()
      }
      finally {
        stopPageStart()
        stopPageFinish()
        stopTransitionFinish()
        if (expectedDestination === destination.fullPath) expectedDestination = null
      }
    },

    subscribe(onExternalNavigation) {
      return router.afterEach((to, _from, failure) => {
        if (failure || (expectedDestination && to.fullPath === expectedDestination)) return
        onExternalNavigation()
      })
    },
  }
}

import { defineNuxtPlugin, useRouter } from '#app'
import { isNavigationFailure } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import { nextTick } from 'vue'
import type { TourDefinition, TourRoute, TourRuntimeOptions } from './types'
import { createTourInstallation } from './vue/plugin'

function abortError(): Error {
  return new DOMException('The tour transition was aborted.', 'AbortError')
}

export function createNuxtTourPlugin(
  tours: readonly TourDefinition[],
  options: TourRuntimeOptions,
) {
  return defineNuxtPlugin((nuxtApp) => {
    const router = useRouter()
    let tourNavigations = 0
    const installation = createTourInstallation({
      tours,
      ...options,
      router: {
        async navigate(route: TourRoute, signal: AbortSignal) {
          if (signal.aborted) throw abortError()
          const shouldReplace = typeof route === 'object' && route.replace === true
          const location = shouldReplace ? { ...route, replace: undefined } : route
          const destination = router.resolve(location as RouteLocationRaw)
          if (destination.fullPath === router.currentRoute.value.fullPath) return
          tourNavigations += 1

          let stopPageHook: (() => void) | undefined
          let stopAbort: (() => void) | undefined
          const pageFinished = new Promise<'finished' | 'aborted'>((resolve) => {
            const finish = () => {
              stopPageHook?.()
              stopAbort?.()
              resolve('finished')
            }
            const abort = () => {
              stopPageHook?.()
              resolve('aborted')
            }
            stopPageHook = nuxtApp.hook('page:finish', finish)
            signal.addEventListener('abort', abort, { once: true })
            stopAbort = () => signal.removeEventListener('abort', abort)
          })

          try {
            const failure = await (shouldReplace
              ? router.replace(location as RouteLocationRaw)
              : router.push(location as RouteLocationRaw))
            if (isNavigationFailure(failure)) throw failure
            if (await pageFinished === 'aborted') throw abortError()
            await nextTick()
          }
          finally {
            stopPageHook?.()
            stopAbort?.()
            tourNavigations -= 1
          }
        },
      },
    })
    router.afterEach((_to, _from, failure) => {
      if (tourNavigations > 0 || failure) return
      const current = installation.runtime.presentation.value
      if (!current) return
      void installation.runtime.controller(current.definition.id).cancel('route-changed').catch(() => {})
    })
    nuxtApp.vueApp.use(installation.plugin)
  })
}

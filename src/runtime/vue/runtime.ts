import { nextTick, shallowReadonly, shallowRef } from 'vue'
import type { ShallowRef } from 'vue'
import { TourRuntime } from '../controller'
import { TourError } from '../errors'
import type { TourRegistry } from '@lupinum/nuxt-tour/registry'
import type { TourRouterAdapter } from '../router'
import { scrollTourTarget, TourTargetRegistry } from '../targets'
import type {
  MaybePromise,
  TourController,
  TourDefinition,
  TourPresentation,
  TourRuntimeOptions,
  TourStepId,
} from '../types'

interface PendingPresentation {
  transitionId: string
  resolve: () => void
  reject: (error: unknown) => void
  stopAbort: () => void
}

type TourVisualPhase = 'hidden' | 'covering' | 'moving' | 'revealing' | 'active'

const visualTiming = {
  cover: 70,
  reveal: 150,
  reducedCover: 0,
  reducedReveal: 120,
} as const

function abortError(): Error {
  return new DOMException('The tour transition was aborted.', 'AbortError')
}

export class TourVueRuntime {
  readonly targets = new TourTargetRegistry()
  readonly presentation: Readonly<ShallowRef<TourPresentation<Element> | null>>
  readonly transitionTarget: Readonly<ShallowRef<Element | null>>
  readonly visualPhase: Readonly<ShallowRef<TourVisualPhase>>
  readonly #controller: TourRuntime<Element>
  readonly #visualPhase: ShallowRef<TourVisualPhase>
  #hostCount = 0
  #pendingPresentation: PendingPresentation | null = null
  #returnFocus: HTMLElement | null = null
  #stopRouter: (() => void) | undefined

  constructor(
    definitions: readonly TourDefinition[],
    options: TourRuntimeOptions = {},
    router?: TourRouterAdapter,
    runWithContext?: <Value>(callback: () => MaybePromise<Value>) => MaybePromise<Value>,
  ) {
    const presentation = shallowRef<TourPresentation<Element> | null>(null)
    const transitionTarget = shallowRef<Element | null>(null)
    const visualPhase = shallowRef<TourVisualPhase>('hidden')
    this.presentation = shallowReadonly(presentation)
    this.transitionTarget = shallowReadonly(transitionTarget)
    this.visualPhase = shallowReadonly(visualPhase)
    this.#visualPhase = visualPhase

    const coverCurrent = async (signal: AbortSignal) => {
      let waitForCover = false
      if (presentation.value && (visualPhase.value === 'active' || visualPhase.value === 'revealing')) {
        visualPhase.value = 'moving'
        waitForCover = true
      }
      await nextTick()
      if (signal.aborted) throw abortError()
      if (!waitForCover) return

      const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      await waitForVisualTransition(testableDuration(
        reducedMotion ? visualTiming.reducedCover : visualTiming.cover,
      ), signal)
    }

    this.#controller = new TourRuntime(definitions, {
      begin: async (context) => {
        if (this.#hostCount === 0) {
          throw new TourError('HOST_NOT_FOUND', 'TourHost must be mounted before a tour starts.', {
            tourId: context.tourId,
            stepId: context.stepId,
            transitionId: context.transitionId,
          })
        }
        this.#returnFocus = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
        visualPhase.value = 'covering'
        await nextTick()
        if (context.signal.aborted) throw abortError()
      },
      runWithContext,
      navigate: router
        ? async (route, signal) => {
          await coverCurrent(signal)
          await router.navigate(route, signal)
        }
        : undefined,
      resolveTarget: (target, resolveOptions) => this.targets.wait(target, resolveOptions),
      scroll: async (target, scrollOptions, signal, scrollTarget) => {
        const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
        const animateScroll = !reducedMotion && !globalThis.navigator?.userAgent.includes('HappyDOM')
        try {
          // Begin scrolling at once, but retain the current spotlight geometry
          // until its opening is fully covered. Swapping the rectangle while
          // that cover is translucent produces a one-frame flash.
          await Promise.all([
            coverCurrent(signal).then(async () => {
              transitionTarget.value = target
              await nextTick()
            }),
            scrollTourTarget(scrollTarget ?? target, {
              ...scrollOptions,
              behavior: animateScroll
                ? (scrollOptions.behavior ?? 'smooth')
                : ('instant' as ScrollBehavior),
            }, signal),
          ])
        }
        catch (error) {
          visualPhase.value = 'moving'
          throw error
        }
      },
      show: async (nextPresentation) => {
        await coverCurrent(nextPresentation.signal)
        presentation.value = nextPresentation
        transitionTarget.value = null
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            if (this.#pendingPresentation?.transitionId === nextPresentation.transitionId) {
              this.#pendingPresentation = null
            }
            reject(abortError())
          }
          this.#pendingPresentation = {
            transitionId: nextPresentation.transitionId,
            resolve,
            reject,
            stopAbort: () => nextPresentation.signal.removeEventListener('abort', abort),
          }
          if (nextPresentation.signal.aborted) abort()
          else nextPresentation.signal.addEventListener('abort', abort, { once: true })
        })
      },
      hide: () => {
        visualPhase.value = 'hidden'
        transitionTarget.value = null
        presentation.value = null
      },
      end: () => {
        visualPhase.value = 'hidden'
        transitionTarget.value = null
        presentation.value = null
        const returnFocus = this.#returnFocus
        this.#returnFocus = null
        if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
      },
    }, options)
    this.#stopRouter = router?.subscribe?.(() => {
      void this.#controller.cancelActive('route-changed').catch(reportError)
    })
  }

  controller<Definition extends TourDefinition>(
    definition: Definition,
  ): TourController<TourStepId<Definition>>
  controller<Id extends keyof TourRegistry & string>(
    id: Id,
  ): TourController<TourStepId<TourRegistry[Id]>>
  controller(id: string): TourController
  controller(definitionOrId: TourDefinition | string): TourController {
    return typeof definitionOrId === 'string'
      ? this.#controller.controller(definitionOrId)
      : this.#controller.controller(definitionOrId)
  }

  cancelActive(reason?: string): Promise<void> {
    return this.#controller.cancelActive(reason)
  }

  targetDisconnected(transitionId: string): Promise<void> {
    return this.#controller.recoverTarget(transitionId)
  }

  dispose(): void {
    this.#stopRouter?.()
    this.#stopRouter = undefined
    void this.#controller.cancelActive('app-unmounted').catch(reportError)
  }

  registerHost(): () => void {
    this.#hostCount += 1
    if (this.#hostCount > 1) {
      this.#hostCount -= 1
      throw new TourError('INVALID_DEFINITION', 'Only one TourHost can be mounted in an application.')
    }
    return () => {
      this.#hostCount = Math.max(0, this.#hostCount - 1)
      if (this.#hostCount === 0 && this.#pendingPresentation) {
        this.#pendingPresentation.stopAbort()
        this.#pendingPresentation.reject(new TourError(
          'HOST_NOT_FOUND',
          'TourHost was removed before the step became ready.',
          { transitionId: this.#pendingPresentation.transitionId },
        ))
        this.#pendingPresentation = null
      }
      if (this.#hostCount === 0) {
        void this.#controller.cancelActive('host-removed').catch(reportError)
      }
    }
  }

  ready(transitionId: string): void {
    if (this.#pendingPresentation?.transitionId !== transitionId) return
    this.#pendingPresentation.stopAbort()
    this.#pendingPresentation.resolve()
    this.#pendingPresentation = null
  }

  async reveal(transitionId: string, signal: AbortSignal): Promise<void> {
    if (this.presentation.value?.transitionId !== transitionId) return
    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    this.#visualPhase.value = 'revealing'
    await waitForVisualTransition(testableDuration(
      reducedMotion ? visualTiming.reducedReveal : visualTiming.reveal,
    ), signal)
    if (this.presentation.value?.transitionId === transitionId) this.#visualPhase.value = 'active'
  }

  fail(transitionId: string, error: unknown): void {
    if (this.#pendingPresentation?.transitionId !== transitionId) return
    this.#pendingPresentation.stopAbort()
    this.#pendingPresentation.reject(error)
    this.#pendingPresentation = null
  }
}

async function waitForVisualTransition(duration: number, signal: AbortSignal): Promise<void> {
  await nextTick()
  if (signal.aborted) throw abortError()

  if (duration === 0) return

  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      resolve()
    }
    const abort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    const timer = globalThis.setTimeout(finish, duration)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
}

function testableDuration(duration: number): number {
  return globalThis.navigator?.userAgent.includes('HappyDOM') ? 0 : duration
}

function reportError(error: unknown): void {
  if (typeof globalThis.reportError === 'function') globalThis.reportError(error)
  else console.error('[nuxt-tour] Failed to cancel the active tour.', error)
}

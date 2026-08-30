import { computed, nextTick, shallowReadonly, shallowRef } from 'vue'
import type { ComputedRef, ShallowRef } from 'vue'
import { TourRuntime } from '../controller'
import { TourError } from '../errors'
import type { TourRegistry } from '@lupinum/nuxt-tour/registry'
import type { TourRouterAdapter } from '../router'
import { scrollTourTarget } from '../scroll'
import { TourTargetRegistry } from '../targets'
import type {
  MaybePromise,
  TourController,
  TourDefinition,
  TourPresentation,
  TourRuntimeOptions,
  TourStepId,
} from '../types'

interface PendingVisualStep {
  transitionId: string
  resolve: () => void
  reject: (error: unknown) => void
  stopAbort: () => void
}

export type TourScene
  = | { readonly phase: 'hidden' }
    | {
      readonly phase: 'covering'
      readonly presentation: TourPresentation<Element> | null
      readonly target: Element | null
    }
    | {
      readonly phase: 'moving'
      readonly presentation: TourPresentation<Element>
      readonly target: Element | null
    }
    | {
      readonly phase: 'revealing' | 'active'
      readonly presentation: TourPresentation<Element>
      readonly target: Element | null
    }

function abortError(): Error {
  return new DOMException('The tour transition was aborted.', 'AbortError')
}

function reportError(error: unknown): void {
  if (typeof globalThis.reportError === 'function') globalThis.reportError(error)
  else console.error('[nuxt-tour] Failed to cancel the active tour.', error)
}

export class TourVueRuntime {
  readonly targets = new TourTargetRegistry()
  readonly scene: Readonly<ShallowRef<TourScene>>
  readonly presentation: ComputedRef<TourPresentation<Element> | null>
  readonly #controller: TourRuntime<Element>
  readonly #scene: ShallowRef<TourScene>
  #hostCount = 0
  #pendingPresentation: PendingVisualStep | null = null
  #pendingCover: PendingVisualStep | null = null
  #returnFocus: HTMLElement | null = null
  #stopRouter: (() => void) | undefined

  constructor(
    definitions: readonly TourDefinition[],
    options: TourRuntimeOptions = {},
    router?: TourRouterAdapter,
    runWithContext?: <Value>(callback: () => MaybePromise<Value>) => MaybePromise<Value>,
  ) {
    const scene = shallowRef<TourScene>({ phase: 'hidden' })
    this.scene = shallowReadonly(scene)
    this.#scene = scene
    this.presentation = computed(() => (
      scene.value.phase === 'hidden' ? null : scene.value.presentation
    ))

    const waitForCover = (transitionId: string, signal: AbortSignal): Promise<void> => (
      new Promise<void>((resolve, reject) => {
        const abort = () => {
          if (this.#pendingCover?.transitionId === transitionId) this.#pendingCover = null
          reject(abortError())
        }
        this.#pendingCover = {
          transitionId,
          resolve,
          reject,
          stopAbort: () => signal.removeEventListener('abort', abort),
        }
        if (signal.aborted) abort()
        else signal.addEventListener('abort', abort, { once: true })
      })
    )

    const coverCurrent = async (signal: AbortSignal) => {
      const current = scene.value
      if (current.phase !== 'active' && current.phase !== 'revealing') {
        await nextTick()
        if (signal.aborted) throw abortError()
        return
      }

      const covered = waitForCover(current.presentation.transitionId, signal)
      scene.value = {
        phase: 'moving',
        presentation: current.presentation,
        target: current.target,
      }
      await covered
    }

    const setTransitionTarget = async (target: Element) => {
      const current = scene.value
      if (current.phase === 'moving' || current.phase === 'covering') {
        scene.value = { ...current, target }
      }
      await nextTick()
    }

    this.#controller = new TourRuntime(definitions, {
      begin: async (context) => {
        if (this.#hostCount === 0) {
          throw new TourError('HOST_NOT_FOUND', 'TourHost must be mounted before a tour starts.', {
            tourId: context.tourId,
            stepId: context.stepId,
          })
        }
        this.#returnFocus = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
        scene.value = { phase: 'covering', presentation: null, target: null }
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
        await Promise.all([
          coverCurrent(signal).then(() => setTransitionTarget(target)),
          scrollTourTarget(scrollTarget ?? target, {
            ...scrollOptions,
            behavior: scrollOptions.behavior ?? 'smooth',
          }, signal),
        ])
      },
      show: async (nextPresentation) => {
        await coverCurrent(nextPresentation.signal)
        scene.value = {
          phase: 'covering',
          presentation: nextPresentation,
          target: nextPresentation.target,
        }
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
        scene.value = { phase: 'hidden' }
      },
      end: () => {
        scene.value = { phase: 'hidden' }
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
      if (this.#hostCount === 0) {
        this.#rejectPendingVisualStep(this.#pendingCover, 'TourHost was removed before the current spotlight closed.')
        this.#pendingCover = null
        this.#rejectPendingVisualStep(this.#pendingPresentation, 'TourHost was removed before the step became ready.')
        this.#pendingPresentation = null
        void this.#controller.cancelActive('host-removed').catch(reportError)
      }
    }
  }

  covered(transitionId: string): void {
    if (this.#pendingCover?.transitionId !== transitionId) return
    this.#pendingCover.stopAbort()
    this.#pendingCover.resolve()
    this.#pendingCover = null
  }

  reveal(transitionId: string): void {
    const current = this.#scene.value
    if (current.phase !== 'covering' || current.presentation?.transitionId !== transitionId) return
    this.#scene.value = {
      phase: 'revealing',
      presentation: current.presentation,
      target: current.target,
    }
  }

  ready(transitionId: string): void {
    if (this.#pendingPresentation?.transitionId !== transitionId) return
    const current = this.#scene.value
    if (current.phase === 'revealing' && current.presentation.transitionId === transitionId) {
      this.#scene.value = { ...current, phase: 'active' }
    }
    this.#pendingPresentation.stopAbort()
    this.#pendingPresentation.resolve()
    this.#pendingPresentation = null
  }

  fail(transitionId: string, error: unknown): void {
    if (this.#pendingPresentation?.transitionId !== transitionId) return
    this.#pendingPresentation.stopAbort()
    this.#pendingPresentation.reject(error)
    this.#pendingPresentation = null
  }

  #rejectPendingVisualStep(pending: PendingVisualStep | null, message: string): void {
    if (!pending) return
    pending.stopAbort()
    pending.reject(new TourError('HOST_NOT_FOUND', message))
  }
}

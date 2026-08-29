import { readonly, ref, shallowReadonly, shallowRef } from 'vue'
import type { Ref, ShallowRef } from 'vue'
import { TourRuntime } from '../controller'
import { TourError } from '../errors'
import { scrollTourTarget, TourTargetRegistry } from '../targets'
import type {
  TourController,
  TourDefinition,
  TourPresentation,
  TourRoute,
  TourRuntimeOptions,
  TourStepId,
} from '../types'

export interface TourRouterAdapter {
  navigate: (route: TourRoute, signal: AbortSignal) => Promise<void>
}

interface PendingPresentation {
  transitionId: string
  resolve: () => void
  reject: (error: unknown) => void
  stopAbort: () => void
}

function abortError(): Error {
  return new DOMException('The tour transition was aborted.', 'AbortError')
}

export class TourVueRuntime {
  readonly targets = new TourTargetRegistry()
  readonly presentation: Readonly<ShallowRef<TourPresentation<HTMLElement> | null>>
  readonly sessionActive: Readonly<Ref<boolean>>
  readonly #controller: TourRuntime<HTMLElement>
  #hostCount = 0
  #pendingPresentation: PendingPresentation | null = null

  constructor(
    definitions: readonly TourDefinition[],
    options: TourRuntimeOptions = {},
    router?: TourRouterAdapter,
  ) {
    const presentation = shallowRef<TourPresentation<HTMLElement> | null>(null)
    const sessionActive = ref(false)
    this.presentation = shallowReadonly(presentation)
    this.sessionActive = readonly(sessionActive)

    this.#controller = new TourRuntime(definitions, {
      navigate: router?.navigate,
      resolveTarget: (target, resolveOptions) => this.targets.wait(target, resolveOptions),
      scroll: scrollTourTarget,
      show: async (nextPresentation) => {
        if (this.#hostCount === 0) {
          throw new TourError('HOST_NOT_FOUND', 'TourHost must be mounted before a tour starts.', {
            tourId: nextPresentation.definition.id,
            stepId: nextPresentation.step.id,
            transitionId: nextPresentation.transitionId,
          })
        }
        sessionActive.value = true
        presentation.value = nextPresentation
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
        presentation.value = null
      },
      end: () => {
        presentation.value = null
        sessionActive.value = false
      },
    }, options)
  }

  controller<Definition extends TourDefinition>(
    definition: Definition,
  ): TourController<TourStepId<Definition>>
  controller(id: string): TourController
  controller(definitionOrId: TourDefinition | string): TourController {
    return typeof definitionOrId === 'string'
      ? this.#controller.controller(definitionOrId)
      : this.#controller.controller(definitionOrId)
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
    }
  }

  ready(transitionId: string): void {
    if (this.#pendingPresentation?.transitionId !== transitionId) return
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
}

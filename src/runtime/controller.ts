import { computed, getCurrentScope, onScopeDispose, shallowRef } from 'vue'
import { validateTourDefinition } from './definition'
import { TourError } from './errors'
import { normalizeTourRuntimeOptions } from './options'
import type {
  MaybePromise,
  TourController,
  TourDefinition,
  TourEndReason,
  TourEvent,
  TourEventMap,
  TourEventType,
  TourMissingTarget,
  TourPresentation,
  TourRuntimeAdapter,
  TourRuntimeOptions,
  TourStartOptions,
  TourStep,
  TourStepContext,
  TourStepId,
  TourTarget,
} from './types'

class TransitionAborted extends Error {}

interface ActiveSession<ResolvedTarget> {
  definition: TourDefinition
  index: number
  step: TourStep | null
  target: ResolvedTarget | null
  cleanup: (() => void) | null
  transitionId: string
}

interface PendingTransition {
  key: string
  tourId: string
  abort: AbortController
  promise: Promise<void>
  cancelReason?: string
}

type TargetResolution<ResolvedTarget>
  = | { readonly status: 'ready', readonly target: ResolvedTarget | null }
    | { readonly status: 'skip' }

function transitionId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `tour-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function abortIfNeeded(signal: AbortSignal): void {
  if (signal.aborted) throw new TransitionAborted()
}

function once(cleanup: () => void): () => void {
  let pending = true
  return () => {
    if (!pending) return
    pending = false
    cleanup()
  }
}

function reportError(error: unknown): void {
  if (typeof globalThis.reportError === 'function') globalThis.reportError(error)
  else console.error('[nuxt-tour] A consumer callback failed.', error)
}

function targetOptions(
  target: TourTarget,
  defaults: Required<TourRuntimeOptions>,
): { timeout: number, missing: TourMissingTarget } {
  if (typeof target === 'string') {
    return { timeout: defaults.targetTimeout, missing: defaults.missingTarget }
  }
  return {
    timeout: target.timeout ?? defaults.targetTimeout,
    missing: target.missing ?? defaults.missingTarget,
  }
}

export class TourRuntime<ResolvedTarget = unknown> {
  readonly #adapter: TourRuntimeAdapter<ResolvedTarget>
  readonly #defaults: ReturnType<typeof normalizeTourRuntimeOptions>
  readonly #definitions = new Map<string, TourDefinition>()
  readonly #controllers = new Map<string, TourController>()
  readonly #listeners = new Set<(event: TourEvent) => unknown>()
  readonly #active = shallowRef<ActiveSession<ResolvedTarget> | null>(null)
  readonly #pending = shallowRef<PendingTransition | null>(null)

  constructor(
    definitions: readonly TourDefinition[],
    adapter: TourRuntimeAdapter<ResolvedTarget>,
    options: TourRuntimeOptions = {},
  ) {
    this.#adapter = adapter
    this.#defaults = normalizeTourRuntimeOptions(options)

    for (const source of definitions) {
      validateTourDefinition(source)
      if (this.#definitions.has(source.id)) {
        throw new TourError('INVALID_DEFINITION', `Duplicate tour ID: ${source.id}.`, {
          tourId: source.id,
        })
      }
      this.#definitions.set(source.id, source)
    }
  }

  controller<Definition extends TourDefinition>(
    definition: Definition,
  ): TourController<TourStepId<Definition>>
  controller(id: string): TourController
  controller(definitionOrId: TourDefinition | string): TourController {
    const id = typeof definitionOrId === 'string' ? definitionOrId : definitionOrId.id
    const definition = this.#definitions.get(id)
    if (!definition) {
      throw new TourError('INVALID_DEFINITION', `Unknown tour ID: ${id}.`, { tourId: id })
    }

    const existing = this.#controllers.get(id)
    if (existing) return existing

    const session = computed(() => (
      this.#active.value?.definition.id === id ? this.#active.value : null
    ))
    const on = this.#on.bind(this, id) as TourController['on']
    const controller: TourController = {
      isActive: computed(() => session.value !== null),
      currentStep: computed(() => session.value?.step ?? null),
      currentStepId: computed(() => session.value?.step?.id ?? null),
      index: computed(() => session.value?.index ?? -1),
      total: computed(() => definition.steps.length),
      pending: computed(() => this.#pending.value?.tourId === id),
      start: options => this.#start(definition, options),
      next: () => this.#move(definition, 'next'),
      previous: () => this.#move(definition, 'previous'),
      goTo: stepId => this.#goTo(definition, stepId),
      skip: () => this.#stop(definition, 'skipped'),
      cancel: reason => this.#cancel(definition, reason),
      on,
    }
    this.#controllers.set(id, controller)
    return controller
  }

  #on<Type extends TourEventType>(
    tourId: string,
    type: Type | '*',
    handler: ((event: TourEventMap[Type] & { type: Type }) => void) | ((event: TourEvent) => void),
  ): () => void {
    const listener = (event: TourEvent): unknown => {
      if (event.tourId !== tourId || (type !== '*' && event.type !== type)) return
      return (handler as (event: TourEvent) => unknown)(event)
    }
    this.#listeners.add(listener)
    const stop = () => this.#listeners.delete(listener)
    if (getCurrentScope()) onScopeDispose(stop)
    return stop
  }

  #emit(event: TourEvent): void {
    for (const listener of [...this.#listeners]) {
      try {
        const result = this.#runWithContext(() => listener(event))
        if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
          void Promise.resolve(result).catch(reportError)
        }
      }
      catch (error) {
        reportError(error)
      }
    }
  }

  #runWithContext<Value>(callback: () => MaybePromise<Value>): MaybePromise<Value> {
    return this.#adapter.runWithContext
      ? this.#adapter.runWithContext(callback)
      : callback()
  }

  async #abortable<Value>(value: PromiseLike<Value> | Value, signal: AbortSignal): Promise<Value> {
    abortIfNeeded(signal)
    let abort: (() => void) | undefined
    const aborted = new Promise<never>((_resolve, reject) => {
      abort = () => reject(new TransitionAborted())
      signal.addEventListener('abort', abort, { once: true })
    })
    try {
      return await Promise.race([Promise.resolve(value), aborted])
    }
    finally {
      if (abort) signal.removeEventListener('abort', abort)
    }
  }

  async #consumer<Value>(callback: () => MaybePromise<Value>, signal: AbortSignal): Promise<Value> {
    const result = Promise.resolve().then(() => this.#runWithContext(callback))
    return this.#abortable(result, signal)
  }

  async #runCleanup(cleanup: (() => void) | null): Promise<void> {
    if (!cleanup) return
    await this.#runWithContext(cleanup)
  }

  async #reportCleanup(cleanup: (() => void) | null): Promise<void> {
    try {
      await this.#runCleanup(cleanup)
    }
    catch (error) {
      reportError(error)
    }
  }

  #start(definition: TourDefinition, options: TourStartOptions = {}): Promise<void> {
    const at = options.at
    const atIndex = at === undefined
      ? 0
      : definition.steps.findIndex(step => step.id === at)
    if (atIndex < 0) {
      return Promise.reject(new TourError('INVALID_DEFINITION', `Unknown step ID: ${at}.`, {
        tourId: definition.id,
        stepId: at,
      }))
    }

    const key = `start:${definition.id}:${String(at ?? '')}:${String(options.replace ?? false)}`
    if (this.#pending.value) {
      return this.#transition(key, definition.id, async () => {})
    }

    if (this.#active.value && !options.replace) {
      return Promise.reject(new TourError('TOUR_ALREADY_ACTIVE', `Tour ${this.#active.value.definition.id} is already active.`, {
        tourId: this.#active.value.definition.id,
        transitionId: this.#active.value.transitionId,
      }))
    }

    return this.#transition(key, definition.id, async (signal, id) => {
      if (this.#active.value) {
        await this.#finish('cancelled', id, 'replaced')
      }

      this.#active.value = {
        definition,
        index: -1,
        step: null,
        target: null,
        cleanup: null,
        transitionId: id,
      }
      const initialStep = definition.steps[atIndex]!
      if (this.#adapter.begin) {
        await this.#abortable(
          this.#adapter.begin(this.#context(definition, initialStep, signal, id)),
          signal,
        )
      }
      this.#emit({ type: 'tour:start', tourId: definition.id, transitionId: id })
      await this.#enter(atIndex, 1, signal, id, at !== undefined)
    })
  }

  #move(definition: TourDefinition, command: 'next' | 'previous'): Promise<void> {
    if (this.#pending.value) {
      return this.#transition(command, definition.id, async () => {})
    }
    const session = this.#active.value
    if (!session || session.definition.id !== definition.id || !session.step) return Promise.resolve()
    const direction = command === 'next' ? 1 : -1
    const destination = session.index + direction
    return this.#transition(command, definition.id, (signal, id) => (
      this.#enter(destination, direction, signal, id)
    ))
  }

  #goTo(definition: TourDefinition, stepId: string): Promise<void> {
    if (this.#pending.value) {
      return this.#transition(`goTo:${stepId}`, definition.id, async () => {})
    }
    const session = this.#active.value
    if (!session || session.definition.id !== definition.id || !session.step) return Promise.resolve()
    const destination = definition.steps.findIndex(step => step.id === stepId)
    if (destination < 0) {
      return Promise.reject(new TourError('INVALID_DEFINITION', `Unknown step ID: ${stepId}.`, {
        tourId: definition.id,
        stepId,
      }))
    }
    if (destination === session.index) return Promise.resolve()
    const direction = destination > session.index ? 1 : -1
    return this.#transition(`goTo:${stepId}`, definition.id, (signal, id) => (
      this.#enter(destination, direction, signal, id, true)
    ))
  }

  #stop(definition: TourDefinition, reason: TourEndReason): Promise<void> {
    if (!this.#active.value || this.#active.value.definition.id !== definition.id) return Promise.resolve()
    return this.#transition(reason, definition.id, (_signal, id) => this.#finish(reason, id))
  }

  #cancel(definition: TourDefinition, reason?: string): Promise<void> {
    if (this.#pending.value && this.#active.value?.definition.id === definition.id) {
      this.#pending.value.cancelReason = reason
      this.#pending.value.abort.abort()
      return this.#pending.value.promise
    }
    if (!this.#active.value || this.#active.value.definition.id !== definition.id) return Promise.resolve()
    return this.#transition('cancel', definition.id, (_signal, id) => (
      this.#finish('cancelled', id, reason)
    ))
  }

  cancelActive(reason?: string): Promise<void> {
    const active = this.#active.value
    if (!active) return Promise.resolve()
    return this.#cancel(active.definition, reason)
  }

  recoverTarget(lostTransitionId: string): Promise<void> {
    const session = this.#active.value
    const step = session?.step
    if (!session || !step?.target || session.transitionId !== lostTransitionId || this.#pending.value) {
      return Promise.resolve()
    }
    return this.#transition(`recover-target:${lostTransitionId}`, session.definition.id, async (signal, id) => {
      const resolution = await this.#resolveStepTarget(session, step, session.index, signal, id)
      if (resolution.status === 'skip') {
        await this.#enter(session.index + 1, 1, signal, id)
        return
      }
      await this.#present(session, step, session.index, resolution.target, signal, id)
    })
  }

  #transition(
    key: string,
    tourId: string,
    operation: (signal: AbortSignal, transitionId: string) => Promise<void>,
  ): Promise<void> {
    if (this.#pending.value) {
      if (this.#pending.value.key === key && this.#pending.value.tourId === tourId) return this.#pending.value.promise
      return Promise.reject(new TourError('TOUR_BUSY', 'Another tour transition is in progress.', {
        tourId,
        transitionId: this.#active.value?.transitionId,
      }))
    }

    const abort = new AbortController()
    const id = transitionId()
    const pending: PendingTransition = {
      key,
      tourId,
      abort,
      promise: Promise.resolve(),
    }
    this.#pending.value = pending

    const promise = (async () => {
      try {
        await operation(abort.signal, id)
      }
      catch (error) {
        if (abort.signal.aborted || error instanceof TransitionAborted) {
          await this.#finish('cancelled', id, pending.cancelReason)
          return
        }
        if (error instanceof TourError && error.code === 'STEP_UNAVAILABLE' && this.#active.value?.step) {
          throw error
        }
        await this.#fail(error, id)
        throw error
      }
      finally {
        if (this.#pending.value?.abort === abort) this.#pending.value = null
      }
    })()

    pending.promise = promise
    return promise
  }

  async #enter(
    requestedIndex: number,
    direction: 1 | -1,
    signal: AbortSignal,
    id: string,
    exact = false,
  ): Promise<void> {
    let session = this.#active.value
    if (!session) throw new TransitionAborted()
    const { definition } = session
    let index = requestedIndex

    while (index >= 0 && index < definition.steps.length) {
      abortIfNeeded(signal)
      const step = definition.steps[index]!
      const context = this.#context(definition, step, signal, id)
      if (step.when && !(await this.#consumer(() => step.when!(context), signal))) {
        if (exact) {
          throw new TourError('STEP_UNAVAILABLE', `Step ${step.id} is not currently available.`, {
            tourId: definition.id,
            stepId: step.id,
            transitionId: id,
          })
        }
        index += direction
        continue
      }

      this.#emit({ type: 'step:before', tourId: definition.id, stepId: step.id, index, transitionId: id })

      if (step.route !== undefined) {
        if (!this.#adapter.navigate) {
          throw new TourError('ROUTER_NOT_CONFIGURED', `Step ${step.id} declares a route, but no router is configured.`, {
            tourId: definition.id,
            stepId: step.id,
            route: step.route,
            transitionId: id,
          })
        }
        try {
          await this.#abortable(this.#adapter.navigate(step.route, signal), signal)
        }
        catch (cause) {
          abortIfNeeded(signal)
          throw new TourError('ROUTE_FAILED', `Route navigation failed for step ${step.id}.`, {
            tourId: definition.id,
            stepId: step.id,
            route: step.route,
            transitionId: id,
            cause,
          })
        }
      }
      abortIfNeeded(signal)

      // The previous step's application effects must not overlap with the
      // destination preparation, while its presentation remains in place.
      await this.#runSessionCleanup(session)

      let candidateCleanup: (() => void) | null = null
      try {
        if (step.prepare) {
          const preparation = Promise.resolve().then(() => this.#runWithContext(() => step.prepare!(context)))
          try {
            const cleanup = await this.#abortable(preparation, signal)
            if (cleanup) candidateCleanup = once(cleanup)
          }
          catch (cause) {
            if (signal.aborted || cause instanceof TransitionAborted) {
              void preparation.then((cleanup) => {
                if (cleanup) return this.#reportCleanup(once(cleanup))
              }, reportError)
              throw new TransitionAborted()
            }
            throw new TourError('PREPARE_FAILED', `Preparation failed for step ${step.id}.`, {
              tourId: definition.id,
              stepId: step.id,
              transitionId: id,
              cause,
            })
          }
        }
        abortIfNeeded(signal)

        const resolution = await this.#resolveStepTarget(session, step, index, signal, id)
        if (resolution.status === 'skip') {
          index += direction
          continue
        }

        session = await this.#leaveCurrent(id, { hide: false }) ?? session
        session.cleanup = candidateCleanup
        candidateCleanup = null
        await this.#present(session, step, index, resolution.target, signal, id)
        this.#emit({ type: 'step:show', tourId: definition.id, stepId: step.id, index, transitionId: id })
        return
      }
      finally {
        await this.#reportCleanup(candidateCleanup)
      }
    }

    if (direction > 0) await this.#finish('completed', id)
  }

  async #resolveStepTarget(
    session: ActiveSession<ResolvedTarget>,
    step: TourStep,
    index: number,
    signal: AbortSignal,
    id: string,
  ): Promise<TargetResolution<ResolvedTarget>> {
    if (step.target === undefined) return { status: 'ready', target: null }

    const options = targetOptions(step.target, this.#defaults)
    const target = await this.#abortable(
      this.#adapter.resolveTarget(step.target, { signal, timeout: options.timeout }),
      signal,
    )
    abortIfNeeded(signal)
    if (target === null) {
      this.#emit({
        type: 'target:missing',
        tourId: session.definition.id,
        stepId: step.id,
        index,
        target: step.target,
        timeout: options.timeout,
        behavior: options.missing,
        transitionId: id,
      })
      if (options.missing === 'skip') return { status: 'skip' }
      throw new TourError('TARGET_NOT_FOUND', `Target was not found for step ${step.id}.`, {
        tourId: session.definition.id,
        stepId: step.id,
        target: step.target,
        route: step.route,
        timeout: options.timeout,
        transitionId: id,
      })
    }

    if (step.scroll !== false && this.#adapter.scroll) {
      let scrollTarget: ResolvedTarget | undefined
      if (step.scrollTarget !== undefined) {
        const scrollTargetOptions = targetOptions(step.scrollTarget, this.#defaults)
        scrollTarget = await this.#abortable(
          this.#adapter.resolveTarget(step.scrollTarget, {
            signal,
            timeout: scrollTargetOptions.timeout,
          }),
          signal,
        ) ?? undefined
        abortIfNeeded(signal)
        if (scrollTarget === undefined) {
          this.#emit({
            type: 'target:missing',
            tourId: session.definition.id,
            stepId: step.id,
            index,
            target: step.scrollTarget,
            timeout: scrollTargetOptions.timeout,
            behavior: scrollTargetOptions.missing,
            transitionId: id,
          })
          if (scrollTargetOptions.missing === 'skip') return { status: 'skip' }
          throw new TourError('TARGET_NOT_FOUND', `Scroll target was not found for step ${step.id}.`, {
            tourId: session.definition.id,
            stepId: step.id,
            target: step.scrollTarget,
            route: step.route,
            timeout: scrollTargetOptions.timeout,
            transitionId: id,
          })
        }
      }
      await this.#abortable(
        this.#adapter.scroll(
          target,
          step.scroll ?? { block: 'center', inline: 'nearest' },
          signal,
          scrollTarget,
        ),
        signal,
      )
      abortIfNeeded(signal)
    }
    return { status: 'ready', target }
  }

  async #present(
    session: ActiveSession<ResolvedTarget>,
    step: TourStep,
    index: number,
    target: ResolvedTarget | null,
    signal: AbortSignal,
    id: string,
  ): Promise<void> {
    const presentation: TourPresentation<ResolvedTarget> = {
      definition: session.definition,
      step,
      index,
      target,
      transitionId: id,
      signal,
    }
    await this.#abortable(this.#adapter.show(presentation), signal)
    abortIfNeeded(signal)
    if (this.#active.value !== session) throw new TransitionAborted()
    this.#active.value = { ...session, index, step, target, transitionId: id }
  }

  #context(
    definition: TourDefinition,
    step: TourStep,
    signal: AbortSignal,
    id: string,
  ): TourStepContext {
    return { signal, tourId: definition.id, stepId: step.id, transitionId: id }
  }

  async #leaveCurrent(
    id: string,
    options: { hide?: boolean } = {},
  ): Promise<ActiveSession<ResolvedTarget> | null> {
    const session = this.#active.value
    if (!session?.step) return session

    const presentation = {
      definition: session.definition,
      step: session.step,
      index: session.index,
      target: session.target,
      transitionId: id,
    }
    const previousStep = session.step
    const previousIndex = session.index
    const cleared = { ...session, step: null, target: null }
    this.#active.value = cleared
    try {
      if (options.hide !== false) await this.#adapter.hide?.(presentation)
    }
    finally {
      await this.#runSessionCleanup(cleared)
    }
    this.#emit({
      type: 'step:leave',
      tourId: session.definition.id,
      stepId: previousStep.id,
      index: previousIndex,
      transitionId: id,
    })
    return cleared
  }

  async #runSessionCleanup(session: ActiveSession<ResolvedTarget>): Promise<void> {
    const cleanup = session.cleanup
    session.cleanup = null
    await this.#runCleanup(cleanup)
  }

  async #finish(reason: TourEndReason, id: string, cancelReason?: string): Promise<void> {
    const session = this.#active.value
    if (!session) return
    const tourId = session.definition.id
    const failure = await this.#teardown(reason, id)
    this.#emit({ type: 'tour:end', tourId, reason, cancelReason, transitionId: id })
    if (failure) throw failure
  }

  async #fail(error: unknown, id: string): Promise<void> {
    const session = this.#active.value
    if (!session) return
    const tourId = session.definition.id
    const teardownError = await this.#teardown('error', id)
    if (teardownError) reportError(teardownError)
    this.#emit({ type: 'tour:error', tourId, error, transitionId: id })
  }

  async #teardown(reason: TourEndReason | 'error', id: string): Promise<unknown> {
    const session = this.#active.value
    if (!session) return undefined
    let failure: unknown
    const capture = (error: unknown) => {
      if (failure === undefined) failure = error
      else reportError(error)
    }

    try {
      try {
        await this.#leaveCurrent(id)
      }
      catch (error) {
        capture(error)
      }
      try {
        await this.#adapter.end?.(reason)
      }
      catch (error) {
        capture(error)
      }
    }
    finally {
      try {
        await this.#runSessionCleanup(this.#active.value ?? session)
      }
      catch (error) {
        capture(error)
      }
      this.#active.value = null
    }
    return failure
  }
}

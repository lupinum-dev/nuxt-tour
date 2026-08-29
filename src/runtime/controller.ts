import { getCurrentScope, onScopeDispose, readonly, ref, shallowReadonly, shallowRef } from 'vue'
import type { Ref, ShallowRef } from 'vue'
import { validateTourDefinition } from './definition'
import { TourError } from './errors'
import type {
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

const defaultTargetTimeout = 5_000

class TransitionAborted extends Error {}

interface ControllerState {
  status: Ref<'idle' | 'active'>
  currentStep: ShallowRef<TourStep | null>
  currentStepId: Ref<string | null>
  index: Ref<number>
  total: Ref<number>
  pending: Ref<boolean>
}

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
  readonly #defaults: Required<TourRuntimeOptions>
  readonly #definitions = new Map<string, TourDefinition>()
  readonly #states = new Map<string, ControllerState>()
  readonly #controllers = new Map<string, TourController>()
  readonly #listeners = new Set<(event: TourEvent) => void>()
  #active: ActiveSession<ResolvedTarget> | null = null
  #pending: PendingTransition | null = null

  constructor(
    definitions: readonly TourDefinition[],
    adapter: TourRuntimeAdapter<ResolvedTarget>,
    options: TourRuntimeOptions = {},
  ) {
    this.#adapter = adapter
    this.#defaults = {
      targetTimeout: options.targetTimeout ?? defaultTargetTimeout,
      missingTarget: options.missingTarget ?? 'error',
    }

    if (!Number.isFinite(this.#defaults.targetTimeout) || this.#defaults.targetTimeout < 0) {
      throw new TourError('INVALID_DEFINITION', 'The default target timeout must be finite and non-negative.')
    }
    if (this.#defaults.missingTarget !== 'error' && this.#defaults.missingTarget !== 'skip') {
      throw new TourError('INVALID_DEFINITION', 'The default missing-target policy must be error or skip.')
    }

    for (const definition of definitions) {
      validateTourDefinition(definition)
      if (this.#definitions.has(definition.id)) {
        throw new TourError('INVALID_DEFINITION', `Duplicate tour ID: ${definition.id}.`, {
          tourId: definition.id,
        })
      }
      this.#definitions.set(definition.id, definition)
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

    const state = this.#state(definition)
    const on = this.#on.bind(this, id) as TourController['on']
    const controller: TourController = {
      status: readonly(state.status),
      currentStep: shallowReadonly(state.currentStep),
      currentStepId: readonly(state.currentStepId),
      index: readonly(state.index),
      total: readonly(state.total),
      pending: readonly(state.pending),
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

  #state(definition: TourDefinition): ControllerState {
    const existing = this.#states.get(definition.id)
    if (existing) return existing

    const state: ControllerState = {
      status: ref<'idle' | 'active'>('idle'),
      currentStep: shallowRef<TourStep | null>(null),
      currentStepId: ref<string | null>(null),
      index: ref(-1),
      total: ref(definition.steps.length),
      pending: ref(false),
    }
    this.#states.set(definition.id, state)
    return state
  }

  #on<Type extends TourEventType>(
    tourId: string,
    type: Type | '*',
    handler: ((event: TourEventMap[Type] & { type: Type }) => void) | ((event: TourEvent) => void),
  ): () => void {
    const listener = (event: TourEvent) => {
      if (event.tourId !== tourId || (type !== '*' && event.type !== type)) return
      ;(handler as (event: TourEvent) => void)(event)
    }
    this.#listeners.add(listener)
    const stop = () => this.#listeners.delete(listener)
    if (getCurrentScope()) onScopeDispose(stop)
    return stop
  }

  #emit(event: TourEvent): void {
    for (const listener of [...this.#listeners]) listener(event)
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
    if (this.#pending) {
      return this.#transition(key, definition.id, async () => {})
    }

    if (this.#active && !options.replace) {
      return Promise.reject(new TourError('TOUR_ALREADY_ACTIVE', `Tour ${this.#active.definition.id} is already active.`, {
        tourId: this.#active.definition.id,
        transitionId: this.#active.transitionId,
      }))
    }

    return this.#transition(key, definition.id, async (signal, id) => {
      if (this.#active) {
        await this.#finish('cancelled', id, 'replaced')
      }

      this.#active = {
        definition,
        index: -1,
        step: null,
        target: null,
        cleanup: null,
        transitionId: id,
      }
      this.#emit({ type: 'tour:start', tourId: definition.id, transitionId: id })
      await this.#enter(atIndex, 1, signal, id)
    })
  }

  #move(definition: TourDefinition, command: 'next' | 'previous'): Promise<void> {
    if (this.#pending) {
      return this.#transition(command, definition.id, async () => {})
    }
    const session = this.#active
    if (!session || session.definition.id !== definition.id || !session.step) return Promise.resolve()
    const direction = command === 'next' ? 1 : -1
    const destination = session.index + direction
    return this.#transition(command, definition.id, (signal, id) => (
      this.#enter(destination, direction, signal, id)
    ))
  }

  #goTo(definition: TourDefinition, stepId: string): Promise<void> {
    if (this.#pending) {
      return this.#transition(`goTo:${stepId}`, definition.id, async () => {})
    }
    const session = this.#active
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
      this.#enter(destination, direction, signal, id)
    ))
  }

  #stop(definition: TourDefinition, reason: TourEndReason): Promise<void> {
    if (!this.#active || this.#active.definition.id !== definition.id) return Promise.resolve()
    return this.#transition(reason, definition.id, (_signal, id) => this.#finish(reason, id))
  }

  #cancel(definition: TourDefinition, reason?: string): Promise<void> {
    if (this.#pending && this.#active?.definition.id === definition.id) {
      this.#pending.cancelReason = reason
      this.#pending.abort.abort()
      return this.#pending.promise
    }
    if (!this.#active || this.#active.definition.id !== definition.id) return Promise.resolve()
    return this.#transition('cancel', definition.id, (_signal, id) => (
      this.#finish('cancelled', id, reason)
    ))
  }

  #transition(
    key: string,
    tourId: string,
    operation: (signal: AbortSignal, transitionId: string) => Promise<void>,
  ): Promise<void> {
    if (this.#pending) {
      if (this.#pending.key === key && this.#pending.tourId === tourId) return this.#pending.promise
      return Promise.reject(new TourError('TOUR_BUSY', 'Another tour transition is in progress.', {
        tourId,
        transitionId: this.#active?.transitionId,
      }))
    }

    const abort = new AbortController()
    const id = transitionId()
    const state = this.#states.get(tourId)
    if (state) state.pending.value = true

    const promise = (async () => {
      try {
        await operation(abort.signal, id)
      }
      catch (error) {
        if (abort.signal.aborted || error instanceof TransitionAborted) {
          await this.#finish('cancelled', id, this.#pending?.cancelReason)
          return
        }
        await this.#fail(error, id)
        throw error
      }
      finally {
        if (this.#pending?.abort === abort) this.#pending = null
        if (state) state.pending.value = false
      }
    })()

    this.#pending = { key, tourId, abort, promise }
    return promise
  }

  async #enter(
    requestedIndex: number,
    direction: 1 | -1,
    signal: AbortSignal,
    id: string,
  ): Promise<void> {
    const session = this.#active
    if (!session) throw new TransitionAborted()
    const { definition } = session
    let index = requestedIndex

    while (index >= 0 && index < definition.steps.length) {
      abortIfNeeded(signal)
      const step = definition.steps[index]!
      const context = this.#context(definition, step, signal, id)
      if (step.when && !(await step.when(context))) {
        index += direction
        continue
      }

      this.#emit({ type: 'step:before', tourId: definition.id, stepId: step.id, index, transitionId: id })

      if (step.route !== undefined && this.#adapter.navigate) {
        try {
          await this.#adapter.navigate(step.route, signal)
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

      let candidateCleanup: (() => void) | null = null
      try {
        if (step.prepare) {
          try {
            const cleanup = await step.prepare(context)
            if (cleanup) candidateCleanup = once(cleanup)
          }
          catch (cause) {
            abortIfNeeded(signal)
            throw new TourError('PREPARE_FAILED', `Preparation failed for step ${step.id}.`, {
              tourId: definition.id,
              stepId: step.id,
              transitionId: id,
              cause,
            })
          }
        }
        abortIfNeeded(signal)

        let target: ResolvedTarget | null = null
        if (step.target !== undefined) {
          const options = targetOptions(step.target, this.#defaults)
          target = await this.#adapter.resolveTarget(step.target, { signal, timeout: options.timeout })
          abortIfNeeded(signal)
          if (target === null) {
            this.#emit({
              type: 'target:missing',
              tourId: definition.id,
              stepId: step.id,
              index,
              target: step.target,
              timeout: options.timeout,
              behavior: options.missing,
              transitionId: id,
            })
            if (options.missing === 'skip') {
              index += direction
              continue
            }
            throw new TourError('TARGET_NOT_FOUND', `Target was not found for step ${step.id}.`, {
              tourId: definition.id,
              stepId: step.id,
              target: step.target,
              route: step.route,
              timeout: options.timeout,
              transitionId: id,
            })
          }

          if (step.scroll !== false && this.#adapter.scroll) {
            await this.#adapter.scroll(target, step.scroll ?? { block: 'center', inline: 'center' }, signal)
            abortIfNeeded(signal)
          }
        }

        await this.#leaveCurrent(id)
        session.cleanup = candidateCleanup
        candidateCleanup = null

        const presentation: TourPresentation<ResolvedTarget> = {
          definition,
          step,
          index,
          target,
          transitionId: id,
          signal,
        }
        await this.#adapter.show(presentation)
        abortIfNeeded(signal)

        session.index = index
        session.step = step
        session.target = target
        session.transitionId = id
        this.#setActiveState(session)
        this.#emit({ type: 'step:show', tourId: definition.id, stepId: step.id, index, transitionId: id })
        return
      }
      finally {
        candidateCleanup?.()
      }
    }

    if (direction > 0) await this.#finish('completed', id)
  }

  #context(
    definition: TourDefinition,
    step: TourStep,
    signal: AbortSignal,
    id: string,
  ): TourStepContext {
    return { signal, tourId: definition.id, stepId: step.id, transitionId: id }
  }

  async #leaveCurrent(id: string): Promise<void> {
    const session = this.#active
    if (!session?.step) return

    const presentation = {
      definition: session.definition,
      step: session.step,
      index: session.index,
      target: session.target,
      transitionId: id,
    }
    const previousStep = session.step
    const previousIndex = session.index
    session.step = null
    session.target = null
    this.#clearActiveState(session.definition.id)
    this.#emit({
      type: 'step:leave',
      tourId: session.definition.id,
      stepId: previousStep.id,
      index: previousIndex,
      transitionId: id,
    })

    try {
      await this.#adapter.hide?.(presentation)
    }
    finally {
      this.#runCleanup(session)
    }
  }

  #runCleanup(session: ActiveSession<ResolvedTarget>): void {
    const cleanup = session.cleanup
    session.cleanup = null
    cleanup?.()
  }

  async #finish(reason: TourEndReason, id: string, cancelReason?: string): Promise<void> {
    const session = this.#active
    if (!session) return
    const tourId = session.definition.id
    try {
      await this.#leaveCurrent(id)
      await this.#adapter.end?.(reason)
    }
    finally {
      this.#runCleanup(session)
      this.#active = null
      this.#clearActiveState(tourId)
    }
    this.#emit({ type: 'tour:end', tourId, reason, cancelReason, transitionId: id })
  }

  async #fail(error: unknown, id: string): Promise<void> {
    const session = this.#active
    if (!session) return
    const tourId = session.definition.id
    try {
      await this.#leaveCurrent(id)
      await this.#adapter.end?.('error')
    }
    finally {
      this.#runCleanup(session)
      this.#active = null
      this.#clearActiveState(tourId)
    }
    this.#emit({ type: 'tour:error', tourId, error, transitionId: id })
  }

  #setActiveState(session: ActiveSession<ResolvedTarget>): void {
    const state = this.#states.get(session.definition.id)
    if (!state || !session.step) return
    state.status.value = 'active'
    state.currentStep.value = session.step
    state.currentStepId.value = session.step.id
    state.index.value = session.index
  }

  #clearActiveState(tourId: string): void {
    const state = this.#states.get(tourId)
    if (!state) return
    state.status.value = 'idle'
    state.currentStep.value = null
    state.currentStepId.value = null
    state.index.value = -1
  }
}

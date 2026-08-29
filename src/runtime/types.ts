import type { Component, Ref } from 'vue'

export type MaybePromise<T> = T | Promise<T>

export type TourPlacement
  = | 'top'
    | 'top-start'
    | 'top-end'
    | 'right'
    | 'right-start'
    | 'right-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end'
    | 'left'
    | 'left-start'
    | 'left-end'

export type TourMissingTarget = 'error' | 'skip'
export type TourInteraction = 'blocked' | 'target' | 'allowed'
export type TourStatus = 'idle' | 'active'

export type TourRoute
  = | string
    | {
      name?: string | symbol
      path?: string
      params?: Record<string, unknown>
      query?: Record<string, unknown>
      hash?: string
      replace?: boolean
      [key: string]: unknown
    }

interface TourTargetOptions {
  timeout?: number
  missing?: TourMissingTarget
}

export type TourTarget
  = | string
    | ({ id: string, selector?: never } & TourTargetOptions)
    | ({ selector: string, id?: never } & TourTargetOptions)

export interface TourStepContext {
  signal: AbortSignal
  tourId: string
  stepId: string
  transitionId: string
}

interface TourStepBase {
  id: string
  target?: TourTarget
  route?: TourRoute
  content: string | Component
  placement?: TourPlacement
  offset?: number
  scroll?: false | ScrollIntoViewOptions
  interaction?: TourInteraction
  when?: (context: TourStepContext) => MaybePromise<boolean>
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- prepare may omit a cleanup function.
  prepare?: (context: TourStepContext) => MaybePromise<void | (() => void)>
}

type NamedTourStep
  = | { title: string, ariaLabel?: string }
    | { title?: undefined, ariaLabel: string }

export type TourStep = TourStepBase & NamedTourStep
export type TourSteps = readonly [TourStep, ...TourStep[]]

export interface TourDefinition<
  Id extends string = string,
  Steps extends TourSteps = TourSteps,
> {
  id: Id
  steps: Steps
}

export type TourId<Definition extends TourDefinition> = Definition['id']
export type TourStepId<Definition extends TourDefinition> = Definition['steps'][number]['id']

export interface TourStartOptions<StepId extends string = string> {
  at?: StepId
  replace?: boolean
}

export type TourEndReason = 'completed' | 'skipped' | 'cancelled'

interface TourEventBase {
  tourId: string
  transitionId: string
}

export interface TourEventMap {
  'tour:start': TourEventBase
  'step:before': TourEventBase & { stepId: string, index: number }
  'step:show': TourEventBase & { stepId: string, index: number }
  'step:leave': TourEventBase & { stepId: string, index: number }
  'target:missing': TourEventBase & {
    stepId: string
    index: number
    target: TourTarget
    timeout: number
    behavior: TourMissingTarget
  }
  'tour:end': TourEventBase & { reason: TourEndReason, cancelReason?: string }
  'tour:error': TourEventBase & { error: unknown }
}

export type TourEventType = keyof TourEventMap
export type TourEvent = {
  [Type in TourEventType]: TourEventMap[Type] & { type: Type }
}[TourEventType]

export interface TourController<StepId extends string = string> {
  status: Readonly<Ref<TourStatus>>
  currentStep: Readonly<Ref<TourStep | null>>
  currentStepId: Readonly<Ref<StepId | null>>
  index: Readonly<Ref<number>>
  total: Readonly<Ref<number>>
  pending: Readonly<Ref<boolean>>
  start: (options?: TourStartOptions<StepId>) => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  goTo: (stepId: StepId) => Promise<void>
  skip: () => Promise<void>
  cancel: (reason?: string) => Promise<void>
  on: {
    <Type extends TourEventType>(
      type: Type,
      handler: (event: TourEventMap[Type] & { type: Type }) => void,
    ): () => void
    (type: '*', handler: (event: TourEvent) => void): () => void
  }
}

export interface TourRuntimeOptions {
  targetTimeout?: number
  missingTarget?: TourMissingTarget
}

/** Nuxt augments this interface with definitions discovered in app/tours. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging requires an interface.
export interface TourRegistry {}

export interface TourLabels {
  previous: string
  next: string
  finish: string
  skip: string
  close: string
  progress: (current: number, total: number) => string
}

export interface TourCardSlotProps {
  step: TourStep
  controller: TourController
  index: number
  total: number
}

export interface TourPresentation<ResolvedTarget = unknown> {
  definition: TourDefinition
  step: TourStep
  index: number
  target: ResolvedTarget | null
  transitionId: string
  signal: AbortSignal
}

export interface TourRuntimeAdapter<ResolvedTarget = unknown> {
  navigate?: (route: TourRoute, signal: AbortSignal) => Promise<void>
  resolveTarget: (
    target: TourTarget,
    options: { signal: AbortSignal, timeout: number },
  ) => Promise<ResolvedTarget | null>
  scroll?: (
    target: ResolvedTarget,
    options: ScrollIntoViewOptions,
    signal: AbortSignal,
  ) => MaybePromise<void>
  show: (presentation: TourPresentation<ResolvedTarget>) => Promise<void>
  hide?: (presentation: Omit<TourPresentation<ResolvedTarget>, 'signal'>) => MaybePromise<void>
  end?: (reason: TourEndReason | 'error') => MaybePromise<void>
}

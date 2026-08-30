import type { Component, Ref } from 'vue'

export type { TourRegistry, TourTargetId } from '@lupinum/nuxt-tour/registry'

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
export type TourInteraction = 'modal' | 'target' | 'page'

export type TourRouteValue = string | number | null
export type TourRouteParamsValue = TourRouteValue | readonly (string | number)[]
export type TourRouteQueryValue = TourRouteValue | readonly TourRouteValue[]

export type TourRoute
  = | string
    | Readonly<{
      name: string | symbol
      path?: never
      params?: Readonly<Record<string, TourRouteParamsValue>>
      query?: Readonly<Record<string, TourRouteQueryValue>>
      hash?: string
      replace?: boolean
    }>
    | Readonly<{
      path: string
      name?: never
      params?: never
      query?: Readonly<Record<string, TourRouteQueryValue>>
      hash?: string
      replace?: boolean
    }>

interface TourTargetOptions {
  readonly timeout?: number
  readonly missing?: TourMissingTarget
}

export type TourTarget
  = | string
    | ({ readonly id: string, readonly selector?: never } & TourTargetOptions)
    | ({ readonly selector: string, readonly id?: never } & TourTargetOptions)

export interface TourStepContext {
  readonly signal: AbortSignal
  readonly tourId: string
  readonly stepId: string
  readonly transitionId: string
}

interface TourStepBase {
  readonly id: string
  readonly target?: TourTarget
  readonly scrollTarget?: TourTarget
  readonly route?: TourRoute
  readonly content: string | Component
  readonly placement?: TourPlacement
  readonly offset?: number
  readonly scroll?: false | Readonly<ScrollIntoViewOptions>
  readonly interaction?: TourInteraction
  readonly when?: (context: TourStepContext) => MaybePromise<boolean>
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type -- prepare may omit a cleanup function.
  readonly prepare?: (context: TourStepContext) => MaybePromise<void | (() => void)>
}

type NamedTourStep
  = | { readonly title: string, readonly ariaLabel?: string }
    | { readonly title?: undefined, readonly ariaLabel: string }

export type TourStep = TourStepBase & NamedTourStep
export type TourSteps = readonly [TourStep, ...TourStep[]]

export interface TourDefinition<
  Id extends string = string,
  Steps extends TourSteps = TourSteps,
> {
  readonly id: Id
  readonly steps: Steps
}

export type TourId<Definition extends TourDefinition> = Definition['id']
export type TourStepId<Definition extends TourDefinition> = Definition['steps'][number]['id']

export interface TourStartOptions<StepId extends string = string> {
  readonly at?: StepId
  readonly replace?: boolean
}

export type TourEndReason = 'completed' | 'skipped' | 'cancelled'

interface TourEventBase {
  tourId: string
  transitionId: string
}

export interface TourEventMap<StepId extends string = string> {
  'tour:start': TourEventBase
  'step:before': TourEventBase & { stepId: StepId, index: number }
  'step:show': TourEventBase & { stepId: StepId, index: number }
  'step:leave': TourEventBase & { stepId: StepId, index: number }
  'target:missing': TourEventBase & {
    stepId: StepId
    index: number
    target: TourTarget
    timeout: number
    behavior: TourMissingTarget
  }
  'tour:end': TourEventBase & { reason: TourEndReason, cancelReason?: string }
  'tour:error': TourEventBase & { error: unknown }
}

export type TourEventType = keyof TourEventMap
export type TourEvent<StepId extends string = string> = {
  [Type in TourEventType]: TourEventMap<StepId>[Type] & { type: Type }
}[TourEventType]

export interface TourController<StepId extends string = string> {
  isActive: Readonly<Ref<boolean>>
  currentStep: Readonly<Ref<(TourStep & { readonly id: StepId }) | null>>
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
      handler: (event: TourEventMap<StepId>[Type] & { type: Type }) => void,
    ): () => void
    (type: '*', handler: (event: TourEvent<StepId>) => void): () => void
  }
}

export interface TourRuntimeOptions {
  readonly targetTimeout?: number
  readonly missingTarget?: TourMissingTarget
}

export interface TourLabels {
  previous: string
  next: string
  finish: string
  skip: string
  close: string
  pending: string
  progress: (current: number, total: number) => string
}

export interface TourCardSlotProps {
  readonly step: TourStep
  readonly controller: TourController
  readonly index: number
  readonly total: number
  readonly titleId?: string
  readonly descriptionId: string
  readonly pending: boolean
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
  begin?: (context: TourStepContext) => MaybePromise<void>
  runWithContext?: <Value>(callback: () => MaybePromise<Value>) => MaybePromise<Value>
  navigate?: (route: TourRoute, signal: AbortSignal) => Promise<void>
  resolveTarget: (
    target: TourTarget,
    options: { signal: AbortSignal, timeout: number },
  ) => Promise<ResolvedTarget | null>
  scroll?: (
    target: ResolvedTarget,
    options: Readonly<ScrollIntoViewOptions>,
    signal: AbortSignal,
    scrollTarget?: ResolvedTarget,
  ) => MaybePromise<void>
  show: (presentation: TourPresentation<ResolvedTarget>) => Promise<void>
  hide?: (presentation: Omit<TourPresentation<ResolvedTarget>, 'signal'>) => MaybePromise<void>
  end?: (reason: TourEndReason | 'error') => MaybePromise<void>
}

import type { TourRoute, TourTarget } from './types'

export type TourErrorCode
  = | 'INVALID_DEFINITION'
    | 'TARGET_NOT_FOUND'
    | 'TARGET_AMBIGUOUS'
    | 'ROUTE_FAILED'
    | 'PREPARE_FAILED'
    | 'HOST_NOT_FOUND'
    | 'TOUR_ALREADY_ACTIVE'
    | 'TOUR_BUSY'

export interface TourErrorContext {
  tourId?: string
  stepId?: string
  target?: TourTarget
  route?: TourRoute
  timeout?: number
  transitionId?: string
  registeredTargets?: readonly string[]
  cause?: unknown
}

export class TourError extends Error {
  readonly code: TourErrorCode
  readonly context: Readonly<TourErrorContext>

  constructor(code: TourErrorCode, message: string, context: TourErrorContext = {}) {
    super(message, { cause: context.cause })
    this.name = 'TourError'
    this.code = code
    this.context = Object.freeze({ ...context })
  }
}

import { TourError } from './errors'
import type { TourMotion, TourRuntimeOptions } from './types'

export interface NormalizedTourRuntimeOptions {
  readonly motion: TourMotion
  readonly targetTimeout: number
  readonly missingTarget: 'error' | 'skip'
}

export const defaultTourRuntimeOptions: NormalizedTourRuntimeOptions = Object.freeze({
  motion: 'auto',
  targetTimeout: 5_000,
  missingTarget: 'error',
})

export function normalizeTourRuntimeOptions(
  options: TourRuntimeOptions = {},
): NormalizedTourRuntimeOptions {
  const normalized = {
    motion: options.motion ?? defaultTourRuntimeOptions.motion,
    targetTimeout: options.targetTimeout ?? defaultTourRuntimeOptions.targetTimeout,
    missingTarget: options.missingTarget ?? defaultTourRuntimeOptions.missingTarget,
  }

  if (normalized.motion !== 'auto' && normalized.motion !== 'none') {
    throw new TourError('INVALID_DEFINITION', 'Motion must be auto or none.')
  }
  if (!Number.isFinite(normalized.targetTimeout) || normalized.targetTimeout < 0) {
    throw new TourError('INVALID_DEFINITION', 'The default target timeout must be finite and non-negative.')
  }
  if (normalized.missingTarget !== 'error' && normalized.missingTarget !== 'skip') {
    throw new TourError('INVALID_DEFINITION', 'The default missing-target policy must be error or skip.')
  }

  return normalized
}

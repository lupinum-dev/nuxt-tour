import { TourError } from './errors'
import type { TourRuntimeOptions } from './types'

export interface NormalizedTourRuntimeOptions {
  readonly targetTimeout: number
  readonly missingTarget: 'error' | 'skip'
}

export const defaultTourRuntimeOptions: NormalizedTourRuntimeOptions = Object.freeze({
  targetTimeout: 5_000,
  missingTarget: 'error',
})

export function normalizeTourRuntimeOptions(
  options: TourRuntimeOptions = {},
): NormalizedTourRuntimeOptions {
  const normalized = {
    targetTimeout: options.targetTimeout ?? defaultTourRuntimeOptions.targetTimeout,
    missingTarget: options.missingTarget ?? defaultTourRuntimeOptions.missingTarget,
  }

  if (!Number.isFinite(normalized.targetTimeout) || normalized.targetTimeout < 0) {
    throw new TourError('INVALID_DEFINITION', 'The default target timeout must be finite and non-negative.')
  }
  if (normalized.missingTarget !== 'error' && normalized.missingTarget !== 'skip') {
    throw new TourError('INVALID_DEFINITION', 'The default missing-target policy must be error or skip.')
  }

  return normalized
}

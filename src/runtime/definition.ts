import { TourError } from './errors'
import type { TourDefinition, TourSteps } from './types'

type UnknownRecord = Record<string, unknown>

const placements = new Set([
  'top', 'top-start', 'top-end',
  'right', 'right-start', 'right-end',
  'bottom', 'bottom-start', 'bottom-end',
  'left', 'left-start', 'left-end',
])

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function invalid(message: string, tourId?: string, stepId?: string): never {
  throw new TourError('INVALID_DEFINITION', message, { tourId, stepId })
}

function validateTarget(target: unknown, tourId: string, stepId: string): void {
  if (typeof target === 'string') {
    if (!target.trim()) invalid('A semantic target ID must not be empty.', tourId, stepId)
    return
  }

  if (!isRecord(target)) invalid('A target must be a semantic ID or target options.', tourId, stepId)
  const hasId = target.id !== undefined
  const hasSelector = target.selector !== undefined
  if (hasId === hasSelector) invalid('A target requires either id or selector, but not both.', tourId, stepId)
  const value = hasId ? target.id : target.selector
  if (!isNonEmptyString(value)) invalid('A target ID or selector must not be empty.', tourId, stepId)
  if (target.timeout !== undefined
    && (typeof target.timeout !== 'number' || !Number.isFinite(target.timeout) || target.timeout < 0)) {
    invalid('A target timeout must be a finite, non-negative number.', tourId, stepId)
  }
  if (target.missing !== undefined && target.missing !== 'skip' && target.missing !== 'error') {
    invalid('A target missing policy must be skip or error.', tourId, stepId)
  }
}

function validateStep(step: unknown, tourId: string): string {
  if (!isRecord(step)) invalid('Every tour step must be an object.', tourId)
  if (!isNonEmptyString(step.id)) invalid('A step ID must not be empty.', tourId)
  const stepId = step.id
  if (step.title !== undefined && !isNonEmptyString(step.title)) {
    invalid('A step title must not be empty.', tourId, stepId)
  }
  if (step.ariaLabel !== undefined && !isNonEmptyString(step.ariaLabel)) {
    invalid('A step ariaLabel must not be empty.', tourId, stepId)
  }
  if (!isNonEmptyString(step.title) && !isNonEmptyString(step.ariaLabel)) {
    invalid('A step without a visible title requires ariaLabel.', tourId, stepId)
  }
  if (typeof step.content === 'string' && !step.content.trim()) {
    invalid('Step content must not be empty.', tourId, stepId)
  }
  if (typeof step.content !== 'string' && typeof step.content !== 'function' && !isRecord(step.content)) {
    invalid('Step content must be text or a Vue component.', tourId, stepId)
  }
  if (step.placement !== undefined && !placements.has(String(step.placement))) {
    invalid('A step placement is invalid.', tourId, stepId)
  }
  if (step.offset !== undefined
    && (typeof step.offset !== 'number' || !Number.isFinite(step.offset) || step.offset < 0)) {
    invalid('A step offset must be a finite, non-negative number.', tourId, stepId)
  }
  if (step.interaction !== undefined
    && step.interaction !== 'blocked'
    && step.interaction !== 'target'
    && step.interaction !== 'allowed') {
    invalid('A step interaction mode is invalid.', tourId, stepId)
  }
  if (step.interaction === 'target' && step.target === undefined) {
    invalid('Target interaction requires a target.', tourId, stepId)
  }
  if (step.when !== undefined && typeof step.when !== 'function') {
    invalid('A step condition must be a function.', tourId, stepId)
  }
  if (step.prepare !== undefined && typeof step.prepare !== 'function') {
    invalid('Step preparation must be a function.', tourId, stepId)
  }
  if (step.target !== undefined) validateTarget(step.target, tourId, stepId)
  return stepId
}

export function validateTourDefinition(definition: unknown): asserts definition is TourDefinition {
  if (!isRecord(definition)) invalid('A tour definition is required.')
  if (!isNonEmptyString(definition.id)) invalid('A tour ID must not be empty.')
  if (!Array.isArray(definition.steps) || definition.steps.length === 0) {
    invalid('A tour requires at least one step.', definition.id)
  }

  const stepIds = new Set<string>()
  for (const step of definition.steps) {
    const stepId = validateStep(step, definition.id)
    if (stepIds.has(stepId)) invalid(`Duplicate step ID: ${stepId}.`, definition.id, stepId)
    stepIds.add(stepId)
  }
}

export function defineTour<
  const Id extends string,
  const Steps extends TourSteps,
>(definition: TourDefinition<Id, Steps>): TourDefinition<Id, Steps> {
  validateTourDefinition(definition)
  return definition
}

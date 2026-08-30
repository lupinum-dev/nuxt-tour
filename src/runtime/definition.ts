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
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
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

function validateRouteRecordValues(
  value: unknown,
  tourId: string,
  stepId: string,
  field: 'params' | 'query',
): void {
  if (!isRecord(value)) invalid(`Route ${field} must be an object.`, tourId, stepId)
  for (const entry of Object.values(value)) {
    const values = Array.isArray(entry) ? entry : [entry]
    if (values.some(item => (
      item !== null
      && typeof item !== 'string'
      && (typeof item !== 'number' || !Number.isFinite(item))
    ))) {
      invalid(`Route ${field} values must be strings, finite numbers, null, or arrays of those values.`, tourId, stepId)
    }
    if (field === 'params' && Array.isArray(entry) && values.includes(null)) {
      invalid('Route params arrays must contain only strings or numbers.', tourId, stepId)
    }
  }
}

function validateRoute(route: unknown, tourId: string, stepId: string): void {
  if (typeof route === 'string') {
    if (!route.trim()) invalid('A route path must not be empty.', tourId, stepId)
    return
  }
  if (!isRecord(route)) invalid('A route must be a path string or route object.', tourId, stepId)

  const hasName = route.name !== undefined
  const hasPath = route.path !== undefined
  if (hasName === hasPath) invalid('A route requires either name or path, but not both.', tourId, stepId)
  if (hasName && typeof route.name !== 'symbol' && !isNonEmptyString(route.name)) {
    invalid('A route name must be a non-empty string or symbol.', tourId, stepId)
  }
  if (hasPath && !isNonEmptyString(route.path)) invalid('A route path must not be empty.', tourId, stepId)
  if (hasPath && route.params !== undefined) invalid('A path route cannot contain params.', tourId, stepId)
  if (route.params !== undefined) validateRouteRecordValues(route.params, tourId, stepId, 'params')
  if (route.query !== undefined) validateRouteRecordValues(route.query, tourId, stepId, 'query')
  if (route.hash !== undefined && typeof route.hash !== 'string') {
    invalid('A route hash must be a string.', tourId, stepId)
  }
  if (route.replace !== undefined && typeof route.replace !== 'boolean') {
    invalid('A route replace option must be a boolean.', tourId, stepId)
  }
}

function validateScroll(scroll: unknown, tourId: string, stepId: string): void {
  if (scroll === false) return
  if (!isRecord(scroll)) invalid('Scroll must be false or a ScrollIntoView options object.', tourId, stepId)
  if (scroll.behavior !== undefined && scroll.behavior !== 'auto' && scroll.behavior !== 'smooth') {
    invalid('Scroll behavior must be auto or smooth.', tourId, stepId)
  }
  for (const field of ['block', 'inline'] as const) {
    const value = scroll[field]
    if (value !== undefined && value !== 'start' && value !== 'center' && value !== 'end' && value !== 'nearest') {
      invalid(`Scroll ${field} must be start, center, end, or nearest.`, tourId, stepId)
    }
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
    && step.interaction !== 'modal'
    && step.interaction !== 'target'
    && step.interaction !== 'page') {
    invalid('A step interaction mode is invalid.', tourId, stepId)
  }
  if (step.interaction === 'target' && step.target === undefined) {
    invalid('Target interaction requires a target.', tourId, stepId)
  }
  if (step.scrollTarget !== undefined && step.target === undefined) {
    invalid('A scroll target requires a spotlight target.', tourId, stepId)
  }
  if (step.scrollTarget !== undefined && step.scroll === false) {
    invalid('A scroll target cannot be combined with scroll: false.', tourId, stepId)
  }
  if (step.route !== undefined) validateRoute(step.route, tourId, stepId)
  if (step.scroll !== undefined) validateScroll(step.scroll, tourId, stepId)
  if (step.when !== undefined && typeof step.when !== 'function') {
    invalid('A step condition must be a function.', tourId, stepId)
  }
  if (step.prepare !== undefined && typeof step.prepare !== 'function') {
    invalid('Step preparation must be a function.', tourId, stepId)
  }
  if (step.target !== undefined) validateTarget(step.target, tourId, stepId)
  if (step.scrollTarget !== undefined) validateTarget(step.scrollTarget, tourId, stepId)
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

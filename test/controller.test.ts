import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { TourRuntime } from '../src/runtime/controller'
import { defineTour, validateTourDefinition } from '../src/runtime/definition'
import { TourError } from '../src/runtime/errors'
import type { TourEvent, TourRuntimeAdapter } from '../src/runtime/types'

function adapter(overrides: Partial<TourRuntimeAdapter<string>> = {}): TourRuntimeAdapter<string> {
  return {
    navigate: vi.fn(async () => {}),
    resolveTarget: vi.fn(async target => typeof target === 'string' ? target : null),
    scroll: vi.fn(async () => {}),
    show: vi.fn(async () => {}),
    hide: vi.fn(async () => {}),
    end: vi.fn(async () => {}),
    ...overrides,
  }
}

const basicTour = defineTour({
  id: 'onboarding',
  steps: [
    { id: 'welcome', ariaLabel: 'Welcome', content: 'Welcome.' },
    { id: 'projects', target: 'new-project', title: 'Projects', content: 'Create a project.' },
  ],
})

describe('tour definitions', () => {
  it('preserves tour and step literal types', () => {
    expectTypeOf(basicTour.id).toEqualTypeOf<'onboarding'>()
    expectTypeOf<(typeof basicTour.steps)[number]['id']>().toEqualTypeOf<'welcome' | 'projects'>()
  })

  it('rejects empty, duplicate, and unnamed definitions', () => {
    expect(() => validateTourDefinition({ id: 'empty', steps: [] } as never))
      .toThrowError(expect.objectContaining({ code: 'INVALID_DEFINITION' }))
    expect(() => validateTourDefinition({
      id: 'duplicate',
      steps: [
        { id: 'same', title: 'One', content: 'One' },
        { id: 'same', title: 'Two', content: 'Two' },
      ],
    }))
      .toThrowError(expect.objectContaining({ code: 'INVALID_DEFINITION' }))
    expect(() => validateTourDefinition({
      id: 'unnamed',
      steps: [{ id: 'step', content: 'Content' }],
    } as never))
      .toThrowError(expect.objectContaining({ code: 'INVALID_DEFINITION' }))
    expect(() => validateTourDefinition({
      id: 'targetless-interaction',
      steps: [{ id: 'step', title: 'Step', content: 'Content', interaction: 'target' }],
    }))
      .toThrowError(expect.objectContaining({ code: 'INVALID_DEFINITION' }))
    expect(() => validateTourDefinition({
      id: 'targetless-scroll-anchor',
      steps: [{ id: 'step', title: 'Step', content: 'Content', scrollTarget: 'section' }],
    }))
      .toThrowError(expect.objectContaining({ code: 'INVALID_DEFINITION' }))
    expect(() => validateTourDefinition({
      id: 'disabled-scroll-anchor',
      steps: [{
        id: 'step',
        target: 'control',
        scrollTarget: 'section',
        scroll: false,
        title: 'Step',
        content: 'Content',
      }],
    }))
      .toThrowError(expect.objectContaining({ code: 'INVALID_DEFINITION' }))
  })
})

describe('tour controller', () => {
  it('rejects invalid runtime defaults', () => {
    expect(() => new TourRuntime([basicTour], adapter(), { missingTarget: 'ignore' as never }))
      .toThrowError(expect.objectContaining({ code: 'INVALID_DEFINITION' }))
  })

  it('settles after route, preparation, target resolution, scrolling, and presentation', async () => {
    const calls: string[] = []
    let scrollOptions: Readonly<ScrollIntoViewOptions> | undefined
    const definition = defineTour({
      id: 'ordered',
      steps: [{
        id: 'destination',
        route: '/projects',
        target: 'create-project',
        title: 'Create a project',
        content: 'Start here.',
        when: () => {
          calls.push('when')
          return true
        },
        prepare: () => { calls.push('prepare') },
      }],
    })
    const runtime = new TourRuntime([definition], adapter({
      navigate: vi.fn(async () => { calls.push('route') }),
      resolveTarget: vi.fn(async () => {
        calls.push('target')
        return 'element'
      }),
      scroll: vi.fn(async (_target, options) => {
        calls.push('scroll')
        scrollOptions = options
      }),
      show: vi.fn(async () => { calls.push('show') }),
    }))
    const tour = runtime.controller(definition)

    await tour.start()

    expect(calls).toEqual(['when', 'route', 'prepare', 'target', 'scroll', 'show'])
    expect(scrollOptions).toEqual({ block: 'center', inline: 'nearest' })
    expect(tour.isActive.value).toBe(true)
    expect(tour.currentStepId.value).toBe('destination')
    expect(tour.index.value).toBe(0)
    expect(tour.pending.value).toBe(false)
  })

  it('can scroll a stable section while presenting a precise target', async () => {
    const definition = defineTour({
      id: 'stable-section',
      steps: [{
        id: 'filter',
        target: 'filter-control',
        scrollTarget: 'project-shell',
        title: 'Filter projects',
        content: 'Choose a filter.',
      }],
    })
    const resolveTarget = vi.fn(async (target: string | { id: string } | { selector: string }) => (
      typeof target === 'string' ? `element:${target}` : null
    ))
    const scroll = vi.fn(async () => {})
    const show = vi.fn(async () => {})
    const runtime = new TourRuntime([definition], adapter({ resolveTarget, scroll, show }))

    await runtime.controller(definition).start()

    expect(resolveTarget).toHaveBeenNthCalledWith(
      1,
      'filter-control',
      expect.objectContaining({ timeout: 5_000 }),
    )
    expect(resolveTarget).toHaveBeenNthCalledWith(
      2,
      'project-shell',
      expect.objectContaining({ timeout: 5_000 }),
    )
    expect(scroll).toHaveBeenCalledWith(
      'element:filter-control',
      { block: 'center', inline: 'nearest' },
      expect.any(AbortSignal),
      'element:project-shell',
    )
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ target: 'element:filter-control' }))
  })

  it('stays active while moving between steps', async () => {
    let releaseSecond!: () => void
    let secondStarted!: () => void
    const secondShown = new Promise<void>((resolve) => {
      releaseSecond = resolve
    })
    const showingSecond = new Promise<void>((resolve) => {
      secondStarted = resolve
    })
    const runtime = new TourRuntime([basicTour], adapter({
      show: vi.fn(async (presentation) => {
        if (presentation.step.id === 'projects') {
          secondStarted()
          await secondShown
        }
      }),
    }))
    const tour = runtime.controller(basicTour)

    await tour.start()
    const moving = tour.next()
    await showingSecond

    expect(tour.isActive.value).toBe(true)
    expect(tour.pending.value).toBe(true)
    releaseSecond()
    await moving
    expect(tour.isActive.value).toBe(true)
  })

  it('runs each preparation cleanup exactly once', async () => {
    const cleanups = [vi.fn(), vi.fn()]
    const definition = defineTour({
      id: 'cleanup',
      steps: [
        { id: 'one', title: 'One', content: 'One', prepare: () => cleanups[0] },
        { id: 'two', title: 'Two', content: 'Two', prepare: () => cleanups[1] },
      ],
    })
    const runtime = new TourRuntime([definition], adapter())
    const tour = runtime.controller(definition)

    await tour.start()
    await tour.next()
    await tour.cancel()
    await tour.cancel()

    expect(cleanups[0]).toHaveBeenCalledOnce()
    expect(cleanups[1]).toHaveBeenCalledOnce()
  })

  it('skips false conditions without destination side effects', async () => {
    const firstPrepare = vi.fn()
    const secondPrepare = vi.fn()
    const definition = defineTour({
      id: 'conditions',
      steps: [
        {
          id: 'hidden',
          route: '/hidden',
          target: 'hidden',
          title: 'Hidden',
          content: 'Hidden',
          when: () => false,
          prepare: firstPrepare,
        },
        { id: 'shown', title: 'Shown', content: 'Shown', prepare: secondPrepare },
      ],
    })
    const route = vi.fn(async () => {})
    const resolveTarget = vi.fn(async () => 'hidden')
    const runtime = new TourRuntime([definition], adapter({ navigate: route, resolveTarget }))
    const tour = runtime.controller(definition)

    await tour.start()

    expect(tour.currentStepId.value).toBe('shown')
    expect(firstPrepare).not.toHaveBeenCalled()
    expect(route).not.toHaveBeenCalled()
    expect(resolveTarget).not.toHaveBeenCalled()
    expect(secondPrepare).toHaveBeenCalledOnce()
  })

  it('keeps goTo and an explicit start destination exact', async () => {
    const definition = defineTour({
      id: 'exact',
      steps: [
        { id: 'one', title: 'One', content: 'One' },
        { id: 'unavailable', title: 'Unavailable', content: 'Unavailable', when: () => false },
        { id: 'three', title: 'Three', content: 'Three' },
      ],
    })
    const runtime = new TourRuntime([definition], adapter())
    const tour = runtime.controller(definition)

    await tour.start()
    await expect(tour.goTo('unavailable')).rejects.toMatchObject({ code: 'STEP_UNAVAILABLE' })
    expect(tour.isActive.value).toBe(true)
    expect(tour.currentStepId.value).toBe('one')
    await tour.cancel()

    await expect(tour.start({ at: 'unavailable' })).rejects.toMatchObject({ code: 'STEP_UNAVAILABLE' })
    expect(tour.isActive.value).toBe(false)
  })

  it('rejects a declared route when no router is configured', async () => {
    const definition = defineTour({
      id: 'needs-router',
      steps: [{ id: 'one', route: '/projects', title: 'One', content: 'One' }],
    })
    const runtime = new TourRuntime([definition], {
      resolveTarget: vi.fn(async () => null),
      show: vi.fn(async () => {}),
    })

    await expect(runtime.controller(definition).start()).rejects.toMatchObject({
      code: 'ROUTER_NOT_CONFIGURED',
    })
  })

  it('continues after an explicitly skipped missing target', async () => {
    const definition = defineTour({
      id: 'optional-target',
      steps: [
        {
          id: 'optional',
          target: { id: 'missing', missing: 'skip', timeout: 10 },
          title: 'Optional',
          content: 'Optional',
        },
        { id: 'fallback', title: 'Fallback', content: 'Fallback' },
      ],
    })
    const events: TourEvent[] = []
    const runtime = new TourRuntime([definition], adapter({ resolveTarget: vi.fn(async () => null) }))
    const tour = runtime.controller(definition)
    tour.on('*', event => events.push(event))

    await tour.start()

    expect(tour.currentStepId.value).toBe('fallback')
    expect(events).toContainEqual(expect.objectContaining({
      type: 'target:missing',
      stepId: 'optional',
      behavior: 'skip',
    }))
  })

  it('keeps the current step active until the destination is ready', async () => {
    let resolveDestination!: (target: string) => void
    const destination = new Promise<string>((resolve) => {
      resolveDestination = resolve
    })
    const hide = vi.fn(async () => {})
    const runtime = new TourRuntime([basicTour], adapter({
      hide,
      resolveTarget: vi.fn(async (target) => {
        if (target === 'new-project') return destination
        return String(target)
      }),
    }))
    const tour = runtime.controller(basicTour)
    await tour.start()

    const transition = tour.next()
    await Promise.resolve()

    expect(tour.currentStepId.value).toBe('welcome')
    expect(hide).not.toHaveBeenCalled()

    resolveDestination('element')
    await transition
    expect(tour.currentStepId.value).toBe('projects')
    expect(hide).not.toHaveBeenCalled()

    await tour.cancel()
    expect(hide).toHaveBeenCalledOnce()
  })

  it('fails cleanly when a required target is missing', async () => {
    const cleanup = vi.fn()
    const definition = defineTour({
      id: 'required-target',
      steps: [{
        id: 'required',
        target: 'missing',
        title: 'Required',
        content: 'Required',
        prepare: () => cleanup,
      }],
    })
    const runtime = new TourRuntime([definition], adapter({ resolveTarget: vi.fn(async () => null) }))
    const tour = runtime.controller(definition)

    await expect(tour.start()).rejects.toMatchObject({ code: 'TARGET_NOT_FOUND' })
    expect(cleanup).toHaveBeenCalledOnce()
    expect(tour.isActive.value).toBe(false)
    expect(tour.currentStep.value).toBeNull()
  })

  it('shares identical transitions and rejects conflicting navigation', async () => {
    let release!: () => void
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const runtime = new TourRuntime([basicTour], adapter({
      show: vi.fn(async ({ step }) => {
        if (step.id === 'projects') await blocked
      }),
    }))
    const tour = runtime.controller(basicTour)
    await tour.start()

    const first = tour.next()
    const duplicate = tour.next()
    const conflict = tour.previous()

    expect(duplicate).toBe(first)
    await expect(conflict).rejects.toMatchObject({ code: 'TOUR_BUSY' })
    release()
    await first
    expect(tour.currentStepId.value).toBe('projects')
  })

  it('shares identical starts without creating a second session', async () => {
    let release!: () => void
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const show = vi.fn(async () => blocked)
    const runtime = new TourRuntime([basicTour], adapter({ show }))
    const tour = runtime.controller(basicTour)

    const first = tour.start()
    const duplicate = tour.start()

    expect(duplicate).toBe(first)
    release()
    await first
    expect(show).toHaveBeenCalledOnce()
  })

  it('keeps the current step when backward missing-target skipping exhausts the tour', async () => {
    const definition = defineTour({
      id: 'backward-missing',
      steps: [
        { id: 'missing', target: { id: 'gone', missing: 'skip' }, title: 'Missing', content: 'Missing' },
        { id: 'shown', title: 'Shown', content: 'Shown' },
      ],
    })
    const runtime = new TourRuntime([definition], adapter({ resolveTarget: vi.fn(async () => null) }))
    const tour = runtime.controller(definition)

    await tour.start({ at: 'shown' })
    await tour.previous()

    expect(tour.isActive.value).toBe(true)
    expect(tour.currentStepId.value).toBe('shown')
  })

  it('aborts in-flight preparation and cleans it once', async () => {
    const cleanup = vi.fn()
    let preparationStarted!: () => void
    const started = new Promise<void>((resolve) => {
      preparationStarted = resolve
    })
    const definition = defineTour({
      id: 'abort',
      steps: [{
        id: 'waiting',
        title: 'Waiting',
        content: 'Waiting',
        prepare: ({ signal }) => new Promise<() => void>((resolve) => {
          preparationStarted()
          signal.addEventListener('abort', () => resolve(cleanup), { once: true })
        }),
      }],
    })
    const runtime = new TourRuntime([definition], adapter())
    const tour = runtime.controller(definition)

    const start = tour.start()
    await started
    await tour.cancel('user-closed')
    await start

    expect(cleanup).toHaveBeenCalledOnce()
    expect(tour.isActive.value).toBe(false)
  })

  it('protects the single active-tour invariant and supports replacement', async () => {
    const other = defineTour({
      id: 'other',
      steps: [{ id: 'only', title: 'Only', content: 'Only' }],
    })
    const runtime = new TourRuntime([basicTour, other], adapter())
    const first = runtime.controller(basicTour)
    const second = runtime.controller(other)

    await first.start()
    await expect(second.start()).rejects.toMatchObject({ code: 'TOUR_ALREADY_ACTIVE' })
    await second.start({ replace: true })

    expect(first.isActive.value).toBe(false)
    expect(second.currentStepId.value).toBe('only')
  })

  it('maps route failures to structured errors', async () => {
    const definition = defineTour({
      id: 'route-failure',
      steps: [{ id: 'route', route: '/broken', title: 'Route', content: 'Route' }],
    })
    const runtime = new TourRuntime([definition], adapter({
      navigate: vi.fn(async () => { throw new Error('broken') }),
    }))

    await expect(runtime.controller(definition).start()).rejects.toEqual(expect.objectContaining({
      code: 'ROUTE_FAILED',
      context: expect.objectContaining({ route: '/broken', stepId: 'route' }),
    }))
  })

  it('passes target ambiguity errors through without changing their code', async () => {
    const definition = defineTour({
      id: 'ambiguous',
      steps: [{ id: 'step', target: 'duplicate', title: 'Step', content: 'Step' }],
    })
    const error = new TourError('TARGET_AMBIGUOUS', 'Duplicate target.', {
      target: 'duplicate',
    })
    const runtime = new TourRuntime([definition], adapter({
      resolveTarget: vi.fn(async () => { throw error }),
    }))

    await expect(runtime.controller(definition).start()).rejects.toBe(error)
  })

  it('owns the session while startup is still pending', async () => {
    let release!: () => void
    const shown = new Promise<void>((resolve) => {
      release = resolve
    })
    const runtime = new TourRuntime([basicTour], adapter({ show: () => shown }))
    const tour = runtime.controller(basicTour)

    const start = tour.start()
    await Promise.resolve()

    expect(tour.isActive.value).toBe(true)
    expect(tour.pending.value).toBe(true)
    expect(tour.currentStep.value).toBeNull()

    release()
    await start
  })

  it('runs every consumer callback in the owning application context', async () => {
    let contextDepth = 0
    const observed: string[] = []
    const definition = defineTour({
      id: 'context',
      steps: [{
        id: 'one',
        title: 'One',
        content: 'One',
        when: () => {
          observed.push(`${contextDepth}:when`)
          return true
        },
        prepare: () => {
          observed.push(`${contextDepth}:prepare`)
          return () => observed.push(`${contextDepth}:cleanup`)
        },
      }],
    })
    const runtime = new TourRuntime([definition], adapter({
      runWithContext(callback) {
        contextDepth += 1
        try {
          return callback()
        }
        finally {
          contextDepth -= 1
        }
      },
    }))
    const tour = runtime.controller(definition)
    tour.on('tour:start', () => observed.push(`${contextDepth}:event`))

    await tour.start()
    await tour.cancel()

    expect(observed).toEqual(['1:event', '1:when', '1:prepare', '1:cleanup'])
  })

  it('awaits asynchronous application context during cleanup', async () => {
    const cleanup = vi.fn()
    const definition = defineTour({
      id: 'async-context',
      steps: [{
        id: 'one',
        title: 'One',
        content: 'One',
        prepare: () => cleanup,
      }],
    })
    const runtime = new TourRuntime([definition], adapter({
      async runWithContext(callback) {
        await Promise.resolve()
        return callback()
      },
    }))
    const tour = runtime.controller(definition)

    await tour.start()
    await tour.cancel()

    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('isolates event-listener failures from runtime behavior', async () => {
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {})
    const runtime = new TourRuntime([basicTour], adapter())
    const tour = runtime.controller(basicTour)
    tour.on('tour:start', () => {
      throw new Error('analytics failed')
    })
    tour.on('step:show', async () => {
      throw new Error('async analytics failed')
    })

    await expect(tour.start()).resolves.toBeUndefined()
    await Promise.resolve()
    expect(tour.currentStepId.value).toBe('welcome')
    expect(reported).toHaveBeenCalledTimes(2)
    reported.mockRestore()
  })

  it('cancels callbacks that ignore their abort signal and cleans up late results', async () => {
    const cleanup = vi.fn()
    let resolvePreparation!: (cleanup: () => void) => void
    let preparationStarted!: () => void
    const started = new Promise<void>((resolve) => {
      preparationStarted = resolve
    })
    const definition = defineTour({
      id: 'uncooperative',
      steps: [{
        id: 'one',
        title: 'One',
        content: 'One',
        prepare: () => new Promise<() => void>((resolve) => {
          resolvePreparation = resolve
          preparationStarted()
        }),
      }],
    })
    const runtime = new TourRuntime([definition], adapter())
    const tour = runtime.controller(definition)

    const start = tour.start()
    await started
    await tour.cancel('test')
    await start
    expect(tour.isActive.value).toBe(false)

    resolvePreparation(cleanup)
    await Promise.resolve()
    await Promise.resolve()
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('ends and clears the session even when cleanup throws', async () => {
    const end = vi.fn(async () => {})
    const definition = defineTour({
      id: 'cleanup-error',
      steps: [{
        id: 'one',
        title: 'One',
        content: 'One',
        prepare: () => () => { throw new Error('cleanup failed') },
      }],
    })
    const runtime = new TourRuntime([definition], adapter({ end }))
    const tour = runtime.controller(definition)

    await tour.start()
    await expect(tour.cancel()).rejects.toThrow('cleanup failed')

    expect(end).toHaveBeenCalledWith('cancelled')
    expect(tour.isActive.value).toBe(false)
    expect(tour.currentStep.value).toBeNull()
  })
})

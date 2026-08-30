const positionEpsilon = 0.5
const stableFrameCount = 3
const minimumSettleTime = 64
const noMovementSettleTime = 160
const maximumSettleTime = 3000
const minimumRevealProximity = 96
const maximumRevealProximity = 220
const revealViewportRatio = 0.18
const revealVelocityThreshold = 1.5
const revealStableFrameCount = 2
const revealStableTime = 32

interface ScrollRevealState {
  readonly startedAt: number
  readonly previousFrameAt: number
  readonly previousTop: number
  readonly previousLeft: number
  readonly lastActivityAt: number
  readonly moved: boolean
  readonly stableFrames: number
  readonly revealFrames: number
  readonly revealCandidateAt: number | null
}

interface ScrollSample {
  readonly time: number
  readonly top: number
  readonly left: number
  readonly centerDistance: number
  readonly revealProximity: number
}

interface ScrollRevealDecision {
  readonly state: ScrollRevealState
  readonly ready: boolean
}

function abortError(): Error {
  return new DOMException('The tour transition was aborted.', 'AbortError')
}

export function usesSmoothScroll(target: Element, behavior: ScrollBehavior | undefined): boolean {
  if (behavior === 'smooth') return true
  if (behavior !== undefined && behavior !== 'auto') return false

  const view = target.ownerDocument.defaultView
  if (!view) return false
  for (let element = target.parentElement; element; element = element.parentElement) {
    if (view.getComputedStyle(element).scrollBehavior === 'smooth') return true
  }
  return false
}

function revealProximity(target: Element): number {
  const view = target.ownerDocument.defaultView
  if (!view) return minimumRevealProximity
  return Math.min(
    maximumRevealProximity,
    Math.max(minimumRevealProximity, view.innerHeight * revealViewportRatio),
  )
}

export function sampleScrollReveal(
  previous: ScrollRevealState,
  sample: ScrollSample,
): ScrollRevealDecision {
  const elapsed = Math.max(1, sample.time - previous.previousFrameAt)
  const velocity = Math.max(
    Math.abs(sample.top - previous.previousTop),
    Math.abs(sample.left - previous.previousLeft),
  ) / elapsed
  const stayedStill
    = Math.abs(sample.top - previous.previousTop) <= positionEpsilon
      && Math.abs(sample.left - previous.previousLeft) <= positionEpsilon
  const moved = previous.moved || !stayedStill
  const stableFrames = stayedStill ? previous.stableFrames + 1 : 0
  const lastActivityAt = stayedStill ? previous.lastActivityAt : sample.time
  const revealCandidate = sample.centerDistance <= sample.revealProximity
    && velocity <= revealVelocityThreshold
  const revealFrames = revealCandidate ? previous.revealFrames + 1 : 0
  const revealCandidateAt = revealCandidate
    ? (previous.revealCandidateAt ?? sample.time)
    : null
  const movementSettled = moved
    && stableFrames >= stableFrameCount
    && sample.time - lastActivityAt >= minimumSettleTime
  const noMovementNeeded = !moved && sample.time - previous.startedAt >= noMovementSettleTime
  const readyToReveal = revealFrames >= revealStableFrameCount
    && revealCandidateAt !== null
    && sample.time - revealCandidateAt >= revealStableTime

  return {
    ready: readyToReveal || movementSettled || noMovementNeeded,
    state: {
      ...previous,
      previousFrameAt: sample.time,
      previousTop: sample.top,
      previousLeft: sample.left,
      lastActivityAt,
      moved,
      stableFrames,
      revealFrames,
      revealCandidateAt,
    },
  }
}

function waitForScrollToReveal(target: Element, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(abortError())

  return new Promise<void>((resolve, reject) => {
    const startedAt = performance.now()
    const initialRect = target.getBoundingClientRect()
    let state: ScrollRevealState = {
      startedAt,
      previousFrameAt: startedAt,
      previousTop: initialRect.top,
      previousLeft: initialRect.left,
      lastActivityAt: startedAt,
      moved: false,
      stableFrames: 0,
      revealFrames: 0,
      revealCandidateAt: null,
    }
    let frame = 0
    let settled = false
    const document = target.ownerDocument
    const view = document.defaultView

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      document.removeEventListener('scroll', markScrollActivity, true)
      view?.removeEventListener('scroll', markScrollActivity, true)
      if (error) reject(error)
      else resolve()
    }
    const abort = () => finish(abortError())
    const markScrollActivity = () => {
      state = {
        ...state,
        moved: true,
        lastActivityAt: performance.now(),
        stableFrames: 0,
      }
    }
    const sample = (time: number) => {
      const rect = target.getBoundingClientRect()
      const decision = sampleScrollReveal(state, {
        time,
        top: rect.top,
        left: rect.left,
        centerDistance: view
          ? Math.abs(rect.top + rect.height / 2 - view.innerHeight / 2)
          : Number.POSITIVE_INFINITY,
        revealProximity: revealProximity(target),
      })
      state = decision.state
      if (decision.ready) {
        finish()
        return
      }
      frame = requestAnimationFrame(sample)
    }

    const timer = globalThis.setTimeout(() => finish(), maximumSettleTime)
    signal.addEventListener('abort', abort, { once: true })
    document.addEventListener('scroll', markScrollActivity, true)
    view?.addEventListener('scroll', markScrollActivity, true)
    frame = requestAnimationFrame(sample)
  })
}

export async function scrollTourTarget(
  target: Element,
  options: ScrollIntoViewOptions,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) throw abortError()
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const waitForSettlement = !reducedMotion && usesSmoothScroll(target, options.behavior)
  target.scrollIntoView({
    ...options,
    behavior: reducedMotion ? ('instant' as ScrollBehavior) : options.behavior,
  })
  if (waitForSettlement) await waitForScrollToReveal(target, signal)
}

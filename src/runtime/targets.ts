import { TourError } from './errors'
import type { TourTarget } from './types'

type TargetListener = () => void

const targetVisibilityAttributes = ['class', 'style', 'hidden', 'open', 'popover']

function abortError(): Error {
  return new DOMException('The tour transition was aborted.', 'AbortError')
}

export function isVisibleTarget(element: Element): boolean {
  if (!element.isConnected) return false
  const style = globalThis.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
    return false
  }
  return [...element.getClientRects()].some(rect => rect.width > 0 && rect.height > 0)
}

function oneVisible(
  candidates: Iterable<Element>,
  target: TourTarget,
  registeredTargets: readonly string[],
): Element | null {
  const visible = [...new Set(candidates)].filter(isVisibleTarget)
  if (visible.length > 1) {
    throw new TourError('TARGET_AMBIGUOUS', 'More than one visible element matches the tour target.', {
      target,
      registeredTargets,
    })
  }
  return visible[0] ?? null
}

export class TourTargetRegistry {
  readonly #targets = new Map<string, Map<Element, number>>()
  readonly #listeners = new Set<TargetListener>()

  get ids(): readonly string[] {
    return [...this.#targets]
      .filter(([, elements]) => [...elements.keys()].some(element => element.isConnected))
      .map(([id]) => id)
      .sort()
  }

  register(id: string, element: Element): () => void {
    if (!id.trim()) {
      throw new TourError('INVALID_DEFINITION', 'A semantic target ID must not be empty.')
    }
    const elements = this.#targets.get(id) ?? new Map<Element, number>()
    elements.set(element, (elements.get(element) ?? 0) + 1)
    this.#targets.set(id, elements)
    this.#notify()

    let registered = true
    return () => {
      if (!registered) return
      registered = false
      const registrations = elements.get(element) ?? 0
      if (registrations <= 1) elements.delete(element)
      else elements.set(element, registrations - 1)
      if (elements.size === 0) this.#targets.delete(id)
      this.#notify()
    }
  }

  resolve(target: TourTarget, root: ParentNode = document): Element | null {
    if (typeof target === 'object' && target.selector !== undefined) {
      let candidates: NodeListOf<Element>
      try {
        candidates = root.querySelectorAll(target.selector)
      }
      catch (cause) {
        throw new TourError('INVALID_DEFINITION', `Invalid target selector: ${target.selector}.`, {
          target,
          registeredTargets: this.ids,
          cause,
        })
      }
      return oneVisible(candidates, target, this.ids)
    }

    const id = typeof target === 'string' ? target : target.id
    const registered = this.#targets.get(id)
    return oneVisible(registered?.keys() ?? [], target, this.ids)
  }

  observeVisibility(element: Element, listener: () => void): () => void {
    let active = true
    let stopObserving = () => {}
    const check = () => {
      if (!active || isVisibleTarget(element)) return
      active = false
      stopObserving()
      listener()
    }
    stopObserving = observeTargetChanges(element.getRootNode(), check, element)
    check()
    return () => {
      active = false
      stopObserving()
    }
  }

  wait(
    target: TourTarget,
    options: { signal: AbortSignal, timeout: number, root?: ParentNode },
  ): Promise<Element | null> {
    const { signal, timeout, root = document } = options
    if (signal.aborted) return Promise.reject(abortError())

    const immediate = this.resolve(target, root)
    if (immediate || timeout === 0) return Promise.resolve(immediate)

    return new Promise<Element | null>((resolve, reject) => {
      let settled = false
      let frame = 0
      let lastFrameCheck = 0
      const finish = (result: Element | null, error?: unknown) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        stopObserving()
        cancelAnimationFrame(frame)
        signal.removeEventListener('abort', abort)
        this.#listeners.delete(check)
        if (error) reject(error)
        else resolve(result)
      }
      const check = () => {
        try {
          const result = this.resolve(target, root)
          if (result) finish(result)
        }
        catch (error) {
          finish(null, error)
        }
      }
      const abort = () => finish(null, abortError())
      const poll = (time: number) => {
        if (settled) return
        if (time - lastFrameCheck >= 50) {
          lastFrameCheck = time
          check()
        }
        frame = requestAnimationFrame(poll)
      }
      frame = requestAnimationFrame(poll)
      const stopObserving = observeTargetChanges(root, check)
      const timer = globalThis.setTimeout(() => finish(null), timeout)
      this.#listeners.add(check)
      signal.addEventListener('abort', abort, { once: true })
    })
  }

  #notify(): void {
    for (const listener of [...this.#listeners]) listener()
  }
}

function observeTargetChanges(
  root: Node,
  listener: () => void,
  resizedElement?: Element,
): () => void {
  const observer = new MutationObserver(listener)
  const observedNode = root instanceof Document ? root.documentElement : root
  observer.observe(observedNode, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: targetVisibilityAttributes,
  })
  const resizeObserver = resizedElement && typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(listener)
    : undefined
  if (resizeObserver && resizedElement) resizeObserver.observe(resizedElement)
  globalThis.addEventListener('resize', listener)

  return () => {
    observer.disconnect()
    resizeObserver?.disconnect()
    globalThis.removeEventListener('resize', listener)
  }
}

const scrollPositionEpsilon = 0.5
const scrollStableFrames = 3
const minimumSettleTime = 64
const noMovementSettleTime = 160
const maximumSettleTime = 3000
const revealMinimumProximity = 96
const revealMaximumProximity = 220
const revealViewportRatio = 0.18
// Allow the reveal during the scroll's gentle final deceleration. Faster
// movement stays covered so the spotlight never chases a visibly moving target.
const revealVelocityThreshold = 1.5
const revealStableFrames = 2
const revealStableTime = 32

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

function targetCenterDistance(target: Element): number {
  // Early reveal follows the default `block: 'center'` contract. Custom scroll
  // alignment still uses the settlement fallback below, so it remains correct
  // without adding a second geometry model for every ScrollIntoView option.
  const rect = target.getBoundingClientRect()
  const view = target.ownerDocument.defaultView
  if (!view) return Number.POSITIVE_INFINITY
  return Math.abs(rect.top + rect.height / 2 - view.innerHeight / 2)
}

function revealProximity(target: Element): number {
  const view = target.ownerDocument.defaultView
  if (!view) return revealMinimumProximity
  return Math.min(
    revealMaximumProximity,
    Math.max(revealMinimumProximity, view.innerHeight * revealViewportRatio),
  )
}

function waitForScrollToReveal(target: Element, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(abortError())

  return new Promise<void>((resolve, reject) => {
    const startedAt = performance.now()
    let previous = target.getBoundingClientRect()
    let lastActivityAt = startedAt
    let moved = false
    let stableFrames = 0
    let frame = 0
    let settled = false
    let previousFrameAt = startedAt
    let revealFrames = 0
    let revealCandidateAt: number | null = null
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
      moved = true
      lastActivityAt = performance.now()
      stableFrames = 0
    }
    const sample = (time: number) => {
      const current = target.getBoundingClientRect()
      const elapsed = Math.max(1, time - previousFrameAt)
      const velocity = Math.max(
        Math.abs(current.top - previous.top),
        Math.abs(current.left - previous.left),
      ) / elapsed
      const stayedStill
        = Math.abs(current.top - previous.top) <= scrollPositionEpsilon
          && Math.abs(current.left - previous.left) <= scrollPositionEpsilon
      if (stayedStill) {
        stableFrames += 1
      }
      else {
        moved = true
        lastActivityAt = time
        stableFrames = 0
      }
      previous = current
      previousFrameAt = time

      const movementSettled = moved
        && stableFrames >= scrollStableFrames
        && time - lastActivityAt >= minimumSettleTime
      const noMovementNeeded = !moved && time - startedAt >= noMovementSettleTime
      const revealCandidate = targetCenterDistance(target) <= revealProximity(target)
        && velocity <= revealVelocityThreshold
      if (revealCandidate) {
        revealFrames += 1
        revealCandidateAt ??= time
      }
      else {
        revealFrames = 0
        revealCandidateAt = null
      }
      const readyToReveal = revealFrames >= revealStableFrames
        && revealCandidateAt !== null
        && time - revealCandidateAt >= revealStableTime
      if (readyToReveal || movementSettled || noMovementNeeded) {
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
    // `instant` also prevents a page-level `scroll-behavior: smooth` rule from
    // overriding the user's reduced-motion preference.
    behavior: reducedMotion ? ('instant' as ScrollBehavior) : options.behavior,
  })
  if (waitForSettlement) await waitForScrollToReveal(target, signal)
}

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

/** Own native scrolling beyond the earlier point at which the card can appear. */
export function createTourScroller() {
  let stopCurrent: (() => void) | undefined
  return {
    stop() { stopCurrent?.() },
    scroll(target: Element, options: ScrollIntoViewOptions, signal: AbortSignal): Promise<void> {
      stopCurrent?.()
      if (signal.aborted) return Promise.reject(abortError())
      const document = target.ownerDocument
      const view = document.defaultView!
      const preference = view.matchMedia?.('(prefers-reduced-motion: reduce)')
      const effective = { ...options, behavior: preference?.matches ? 'instant' as const : options.behavior }
      const smooth = usesSmoothScroll(target, effective.behavior)
      // Capture only the scroll containers affected by this operation. Do not
      // cancel an unrelated application's animation elsewhere in the document.
      const containers = scrollContainers(target)
      const stopNative = () => {
        for (const element of containers) {
          element.scrollTo?.({ left: element.scrollLeft, top: element.scrollTop, behavior: 'instant' })
        }
      }
      target.scrollIntoView(effective)
      if (!smooth) return Promise.resolve()

      return new Promise<void>((resolve, reject) => {
        const startedAt = view.performance.now()
        const initial = target.getBoundingClientRect()
        let state: ScrollRevealState = {
          startedAt, previousFrameAt: startedAt, previousTop: initial.top,
          previousLeft: initial.left, lastActivityAt: startedAt, moved: false,
          stableFrames: 0, revealFrames: 0, revealCandidateAt: null,
        }
        let previousOffsets = containers.map(element => [element.scrollLeft, element.scrollTop])
        let scrollActivityAt = startedAt
        let scrolled = false
        let stableScrollFrames = 0
        let frame = 0
        let finished = false
        const ready = (error?: Error) => error ? reject(error) : resolve()
        const finish = (error?: Error) => {
          if (finished) return
          finished = true
          view.cancelAnimationFrame(frame)
          clearTimeout(timer)
          signal.removeEventListener('abort', abort)
          document.removeEventListener('visibilitychange', onVisibility)
          preference?.removeEventListener?.('change', onPreference)
          if (stopCurrent === stop) stopCurrent = undefined
          ready(error)
        }
        const stop = () => {
          stopNative()
          finish(abortError())
        }
        const abort = () => stop()
        const onVisibility = () => {
          if (document.hidden) {
            stopNative()
            finish()
          }
        }
        const onPreference = () => {
          if (!preference?.matches) return
          target.scrollIntoView({ ...options, behavior: 'instant' })
          finish()
        }
        const sample = (time: number) => {
          if (!target.isConnected) {
            stop()
            return
          }
          const rect = target.getBoundingClientRect()
          const decision = sampleScrollReveal(state, {
            time, top: rect.top, left: rect.left,
            centerDistance: Math.abs(rect.top + rect.height / 2 - view.innerHeight / 2),
            revealProximity: revealProximity(target),
          })
          state = decision.state
          const offsets = containers.map(element => [element.scrollLeft, element.scrollTop])
          const changed = offsets.some((offset, index) => offset.some((value, axis) => Math.abs(value - previousOffsets[index]![axis]!) > positionEpsilon))
          previousOffsets = offsets
          if (changed) {
            scrolled = true
            stableScrollFrames = 0
            scrollActivityAt = time
          }
          else stableScrollFrames += 1
          if (decision.ready) ready()
          // Revealing the card must not release cancellation or reduced-motion
          // ownership while native scrolling still has a tail.
          if (((state.moved || scrolled) && state.stableFrames >= stableFrameCount && stableScrollFrames >= stableFrameCount
            && time - Math.max(state.lastActivityAt, scrollActivityAt) >= minimumSettleTime)
          || (!state.moved && !scrolled && time - startedAt >= noMovementSettleTime)) {
            finish()
            return
          }
          frame = view.requestAnimationFrame(sample)
        }
        const timer = globalThis.setTimeout(() => {
          stopNative()
          finish()
        }, maximumSettleTime)
        stopCurrent = stop
        signal.addEventListener('abort', abort, { once: true })
        document.addEventListener('visibilitychange', onVisibility)
        preference?.addEventListener?.('change', onPreference)
        if (document.hidden) {
          onVisibility()
          return
        }
        frame = view.requestAnimationFrame(sample)
      })
    },
  }
}

function scrollContainers(target: Element): Element[] {
  const document = target.ownerDocument
  const view = document.defaultView!
  const result: Element[] = []
  for (let element = target.parentElement; element; element = element.parentElement) {
    const style = view.getComputedStyle(element)
    if (element !== document.scrollingElement && /auto|scroll|hidden/u.test(`${style.overflowX} ${style.overflowY}`)) result.push(element)
  }
  if (document.scrollingElement) result.push(document.scrollingElement)
  return result
}

/** Respect alignment, margins, padding, and clamping before choosing a handoff. */
export function needsTourScroll(target: Element, options: ScrollIntoViewOptions): boolean {
  const view = target.ownerDocument.defaultView
  if (!view) return true
  const rect = target.getBoundingClientRect()
  const style = view.getComputedStyle(target)
  const number = (value: string) => Number.parseFloat(value) || 0
  const bounds = { top: rect.top - number(style.scrollMarginTop), bottom: rect.bottom + number(style.scrollMarginBottom), left: rect.left - number(style.scrollMarginLeft), right: rect.right + number(style.scrollMarginRight) }
  const delta = (start: number, end: number, low: number, high: number, alignment: ScrollLogicalPosition) => {
    if (alignment === 'center') return (start + end - low - high) / 2
    if (alignment === 'start') return start - low
    if (alignment === 'end') return end - high
    if (start < low && end > high) return 0
    if (start < low) return end - start <= high - low ? start - low : end - high
    if (end > high) return end - start <= high - low ? end - high : start - low
    return 0
  }
  for (const element of scrollContainers(target)) {
    const root = element === target.ownerDocument.scrollingElement
    const parent = view.getComputedStyle(element)
    const box = element.getBoundingClientRect()
    const top = root ? 0 : box.top + element.clientTop
    const left = root ? 0 : box.left + element.clientLeft
    const height = root ? view.innerHeight : element.clientHeight
    const width = root ? view.innerWidth : element.clientWidth
    // Native scrolling remains authoritative for vertical writing modes.
    if (parent.writingMode && parent.writingMode !== 'horizontal-tb') return true
    const padding = (value: string, extent: number) => value.endsWith('%') ? number(value) * extent / 100 : number(value)
    const inline = options.inline ?? 'nearest'
    const physicalInline = parent.direction === 'rtl'
      ? inline === 'start' ? 'end' : inline === 'end' ? 'start' : inline
      : inline
    const dy = delta(bounds.top, bounds.bottom, top + padding(parent.scrollPaddingTop, height), top + height - padding(parent.scrollPaddingBottom, height), options.block ?? 'start')
    const dx = delta(bounds.left, bounds.right, left + padding(parent.scrollPaddingLeft, width), left + width - padding(parent.scrollPaddingRight, width), physicalInline)
    const y = Math.max(0, Math.min(element.scrollHeight - height, element.scrollTop + dy))
    const maxX = Math.max(0, element.scrollWidth - width)
    const x = parent.direction === 'rtl'
      ? Math.max(-maxX, Math.min(0, element.scrollLeft + dx))
      : Math.max(0, Math.min(maxX, element.scrollLeft + dx))
    if (Math.abs(y - element.scrollTop) > positionEpsilon || Math.abs(x - element.scrollLeft) > positionEpsilon) return true
  }
  return false
}

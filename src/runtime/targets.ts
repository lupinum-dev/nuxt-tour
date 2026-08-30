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

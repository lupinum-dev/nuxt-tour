import { TourError } from './errors'
import type { TourTarget } from './types'

type TargetListener = () => void

function abortError(): Error {
  return new DOMException('The tour transition was aborted.', 'AbortError')
}

export function isVisibleTarget(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement) || !element.isConnected) return false
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
): HTMLElement | null {
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
  readonly #targets = new Map<string, Set<HTMLElement>>()
  readonly #listeners = new Set<TargetListener>()

  get ids(): readonly string[] {
    return [...this.#targets]
      .filter(([, elements]) => [...elements].some(element => element.isConnected))
      .map(([id]) => id)
      .sort()
  }

  register(id: string, element: HTMLElement): () => void {
    if (!id.trim()) {
      throw new TourError('INVALID_DEFINITION', 'A semantic target ID must not be empty.')
    }
    const elements = this.#targets.get(id) ?? new Set<HTMLElement>()
    elements.add(element)
    this.#targets.set(id, elements)
    this.#notify()

    let registered = true
    return () => {
      if (!registered) return
      registered = false
      elements.delete(element)
      if (elements.size === 0) this.#targets.delete(id)
      this.#notify()
    }
  }

  resolve(target: TourTarget, root: ParentNode = document): HTMLElement | null {
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
    if (registered) {
      const match = oneVisible(registered, target, this.ids)
      if (match) return match
    }

    const candidates = [...root.querySelectorAll<HTMLElement>('[data-tour-target]')]
      .filter(element => element.dataset.tourTarget === id)
    return oneVisible(candidates, target, this.ids)
  }

  wait(
    target: TourTarget,
    options: { signal: AbortSignal, timeout: number, root?: ParentNode },
  ): Promise<HTMLElement | null> {
    const { signal, timeout, root = document } = options
    if (signal.aborted) return Promise.reject(abortError())

    const immediate = this.resolve(target, root)
    if (immediate || timeout === 0) return Promise.resolve(immediate)

    return new Promise<HTMLElement | null>((resolve, reject) => {
      let settled = false
      const finish = (result: HTMLElement | null, error?: unknown) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        observer.disconnect()
        globalThis.removeEventListener('resize', check)
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
      const observer = new MutationObserver(check)
      const observedNode = root instanceof Document ? root.documentElement : root
      observer.observe(observedNode, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'data-tour-target'],
      })
      const timer = globalThis.setTimeout(() => finish(null), timeout)
      this.#listeners.add(check)
      globalThis.addEventListener('resize', check)
      signal.addEventListener('abort', abort, { once: true })
    })
  }

  #notify(): void {
    for (const listener of [...this.#listeners]) listener()
  }
}

export function scrollTourTarget(
  target: HTMLElement,
  options: ScrollIntoViewOptions,
  signal: AbortSignal,
): void {
  if (signal.aborted) throw abortError()
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  target.scrollIntoView({
    ...options,
    behavior: reducedMotion && options.behavior === 'smooth' ? 'auto' : options.behavior,
  })
}

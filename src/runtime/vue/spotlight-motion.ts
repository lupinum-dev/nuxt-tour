interface Geometry {
  x: number
  y: number
  width: number
  height: number
}

const axes = ['x', 'y', 'width', 'height'] as const
const restingVelocity = () => ({ x: 0, y: 0, width: 0, height: 0 })

/** Own only painted geometry. Tour state and target hit areas stay in the host. */
export function createSpotlightMotion(element: HTMLElement) {
  const view = element.ownerDocument.defaultView!
  const document = element.ownerDocument
  const preference = view.matchMedia?.('(prefers-reduced-motion: reduce)')
  let displayed: Geometry | undefined
  let destination: Geometry | undefined
  let velocity = restingVelocity()
  let frame = 0
  let complete: (() => void) | undefined

  const paint = (geometry: Geometry) => {
    displayed = geometry
    Object.assign(element.style, {
      transform: `translate3d(${geometry.x}px, ${geometry.y}px, 0)`,
      width: `${geometry.width}px`,
      height: `${geometry.height}px`,
    })
  }
  const stop = () => {
    view.cancelAnimationFrame(frame)
    frame = 0
    complete?.()
    complete = undefined
  }
  const finish = () => {
    if (destination) paint(destination)
    velocity = restingVelocity()
    stop()
  }
  const onPreference = () => {
    if (preference?.matches) finish()
  }
  const onVisibility = () => {
    if (document.hidden) finish()
  }
  preference?.addEventListener?.('change', onPreference)
  document.addEventListener('visibilitychange', onVisibility)

  return {
    move(rect: DOMRect, animate: boolean): Promise<void> {
      // Computed padding resolves rem/em values through CSS, unlike parseFloat
      // on the custom property. It is visual padding, never a pointer hit area.
      const padding = Number.parseFloat(view.getComputedStyle(element).paddingTop) || 0
      const next = { x: rect.left - padding, y: rect.top - padding, width: rect.width + padding * 2, height: rect.height + padding * 2 }
      if (destination && next.x === destination.x && next.y === destination.y
        && next.width === destination.width && next.height === destination.height) {
        return new Promise((resolve) => {
          if (!complete) resolve()
          else {
            const previous = complete
            complete = () => {
              previous()
              resolve()
            }
          }
        })
      }
      const redirectedVelocity = frame ? { ...velocity } : undefined
      stop()
      destination = next
      const start = displayed
      if (!animate || !start || preference?.matches || document.hidden) {
        paint(next)
        velocity = restingVelocity()
        return Promise.resolve()
      }
      const distance = Math.hypot(next.x - start.x, next.y - start.y, (next.width - start.width) / 2, (next.height - start.height) / 2)
      const duration = Math.min(280, Math.max(160, 120 + Math.sqrt(distance) * 6))
      const initialVelocity = redirectedVelocity ?? {
        x: (next.x - start.x) * 3 / duration, y: (next.y - start.y) * 3 / duration,
        width: (next.width - start.width) * 3 / duration, height: (next.height - start.height) * 3 / duration,
      }
      const startedAt = view.performance.now()
      return new Promise((resolve) => {
        complete = resolve
        const tick = (time: number) => {
          const progress = Math.min(1, Math.max(0, (time - startedAt) / duration))
          // Cubic Hermite motion preserves the current velocity on redirection
          // and reaches the destination with zero velocity. Normal starts retain
          // the existing quick ease-out response without a spring dependency.
          const u = progress
          const position = { ...start }
          for (const axis of axes) {
            const delta = next[axis] - start[axis]
            position[axis] = start[axis] + (-2 * u ** 3 + 3 * u ** 2) * delta
              + (u ** 3 - 2 * u ** 2 + u) * duration * initialVelocity[axis]
            velocity[axis] = (-6 * u ** 2 + 6 * u) * delta / duration
              + (3 * u ** 2 - 4 * u + 1) * initialVelocity[axis]
          }
          position.width = Math.max(0, position.width)
          position.height = Math.max(0, position.height)
          paint(position)
          if (progress === 1) stop()
          else frame = view.requestAnimationFrame(tick)
        }
        frame = view.requestAnimationFrame(tick)
      })
    },
    dispose() {
      stop()
      preference?.removeEventListener?.('change', onPreference)
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}

export function canTravelBetween(from: Element | null, to: Element | null): to is Element {
  if (!from?.isConnected || !to?.isConnected || from.ownerDocument !== to.ownerDocument) return false
  const view = to.ownerDocument.defaultView
  if (!view) return false
  const first = from.getBoundingClientRect()
  const second = to.getBoundingClientRect()
  const visible = (rect: DOMRect) => rect.width > 0 && rect.height > 0
    && rect.top >= 0 && rect.left >= 0 && rect.bottom <= view.innerHeight && rect.right <= view.innerWidth
  return visible(first) && visible(second)
    && Math.hypot(second.x - first.x, second.y - first.y) <= Math.hypot(view.innerWidth, view.innerHeight) * 0.75
}

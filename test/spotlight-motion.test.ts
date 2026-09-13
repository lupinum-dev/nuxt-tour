// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSpotlightMotion } from '../src/runtime/vue/spotlight-motion'

afterEach(() => vi.restoreAllMocks())

function fixture() {
  const element = document.createElement('div')
  element.style.padding = '8px'
  document.body.append(element)
  let time = 0
  let id = 0
  const frames = new Map<number, FrameRequestCallback>()
  vi.spyOn(window.performance, 'now').mockImplementation(() => time)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++id, callback)
    return id
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id)
  })
  const preference = Object.assign(new EventTarget(), { matches: false })
  // Only matches and change events are consumed at this browser API boundary.
  vi.spyOn(window, 'matchMedia').mockReturnValue(preference as MediaQueryList)
  const motion = createSpotlightMotion(element)
  return {
    element, motion, frames, preference,
    advance(next: number) {
      time = next
      const callbacks = [...frames.values()]
      frames.clear()
      for (const callback of callbacks) callback(time)
    },
    dispose() {
      motion.dispose()
      element.remove()
    },
  }
}

describe('spotlight motion', () => {
  it('retargets from the painted rectangle and resolves interrupted work', async () => {
    const f = fixture()
    await f.motion.move(new DOMRect(0, 0, 100, 40), false)
    const outgoing = f.motion.move(new DOMRect(200, 100, 200, 80), true)
    f.advance(100)
    const painted = f.element.style.transform
    expect(Number.parseFloat(f.element.style.width)).toBeGreaterThan(116)
    expect(Number.parseFloat(f.element.style.width)).toBeLessThan(216)
    const incoming = f.motion.move(new DOMRect(20, 20, 100, 40), true)
    await outgoing
    expect(f.element.style.transform).toBe(painted)
    f.advance(320)
    await incoming
    expect(f.element.style.transform).toBe('translate3d(12px, 12px, 0)')
    expect(f.frames.size).toBe(0)
    f.dispose()
  })

  it('tracks scroll immediately and stops stale animation frames on disposal', async () => {
    const f = fixture()
    await f.motion.move(new DOMRect(0, 0, 100, 40), false)
    const moving = f.motion.move(new DOMRect(200, 100, 200, 80), true)
    f.advance(50)
    await f.motion.move(new DOMRect(200, 80, 200, 80), false)
    await moving
    expect(f.element.style.transform).toBe('translate3d(192px, 72px, 0)')
    const cancelled = f.motion.move(new DOMRect(400, 100, 200, 80), true)
    f.dispose()
    await cancelled
    expect(f.frames.size).toBe(0)
  })

  it('finishes at the destination when reduced motion changes during travel', async () => {
    const f = fixture()
    await f.motion.move(new DOMRect(0, 0, 100, 40), false)
    const moving = f.motion.move(new DOMRect(200, 100, 200, 80), true)
    f.advance(50)
    f.preference.matches = true
    f.preference.dispatchEvent(new Event('change'))
    await moving
    expect(f.element.style.transform).toBe('translate3d(192px, 92px, 0)')
    expect(f.frames.size).toBe(0)
    f.dispose()
  })
  it('preserves velocity when redirected in the opposite direction', async () => {
    const f = fixture()
    await f.motion.move(new DOMRect(0, 0, 100, 40), false)
    const first = f.motion.move(new DOMRect(200, 0, 100, 40), true)
    f.advance(60)
    const x = () => Number(f.element.style.transform.match(/translate3d\(([-\d.]+)/u)![1])
    const before = x()
    const redirected = f.motion.move(new DOMRect(20, 0, 100, 40), true)
    await first
    f.advance(61)
    expect(x()).toBeGreaterThan(before)
    f.advance(340)
    await redirected
    expect(x()).toBe(12)
    f.dispose()
  })
  it('keeps a redirected path consistent across different frame sampling rates', async () => {
    const samplePath = async (times: number[]) => {
      const f = fixture()
      await f.motion.move(new DOMRect(0, 0, 100, 40), false)
      const first = f.motion.move(new DOMRect(200, 0, 100, 40), true)
      f.advance(60)
      const redirected = f.motion.move(new DOMRect(20, 0, 100, 40), true)
      await first
      for (const time of times) f.advance(time)
      const position = f.element.style.transform
      f.advance(340)
      await redirected
      f.dispose()
      return position
    }
    expect(await samplePath([61, 80, 100])).toBe(await samplePath([100]))
  })
})

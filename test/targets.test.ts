// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { scrollTourTarget } from '../src/runtime/targets'

describe('tour target scrolling', () => {
  it('does not settle during a smooth scroll startup pause', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    let top = 900
    Object.defineProperties(target, {
      getBoundingClientRect: {
        value: () => ({ top, left: 0, right: 100, bottom: top + 40, width: 100, height: 40 }),
      },
      scrollIntoView: {
        value: () => {
          setTimeout(() => {
            top = 650
            document.dispatchEvent(new Event('scroll'))
          }, 90)
          setTimeout(() => {
            top = 380
            document.dispatchEvent(new Event('scroll'))
          }, 130)
        },
      },
    })

    let settled = false
    const scrolling = scrollTourTarget(
      target,
      { behavior: 'smooth', block: 'center' },
      new AbortController().signal,
    ).then(() => {
      settled = true
    })

    await new Promise(resolve => setTimeout(resolve, 80))
    expect(settled).toBe(false)
    await scrolling
    expect(settled).toBe(true)
    target.remove()
  })

  it('reveals near a centered target before native smooth scrolling fully settles', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    let top = 900
    Object.defineProperties(target, {
      getBoundingClientRect: {
        value: () => ({ top, left: 0, right: 100, bottom: top + 40, width: 100, height: 40 }),
      },
      scrollIntoView: {
        value: () => {
          setTimeout(() => {
            top = 420
            document.dispatchEvent(new Event('scroll'))
          }, 30)
          setTimeout(() => {
            top = 364
            document.dispatchEvent(new Event('scroll'))
          }, 220)
        },
      },
    })

    const startedAt = performance.now()
    await scrollTourTarget(
      target,
      { behavior: 'smooth', block: 'center' },
      new AbortController().signal,
    )

    expect(performance.now() - startedAt).toBeLessThan(220)
    expect(top).toBe(420)
    target.remove()
  })

  it('reveals during gentle final deceleration instead of waiting for a full stop', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    let top = 900
    Object.defineProperties(target, {
      getBoundingClientRect: {
        value: () => ({ top, left: 0, right: 100, bottom: top + 40, width: 100, height: 40 }),
      },
      scrollIntoView: {
        value: () => {
          setTimeout(() => {
            top = 470
            document.dispatchEvent(new Event('scroll'))
          }, 20)
          setTimeout(() => {
            top = 460
            document.dispatchEvent(new Event('scroll'))
          }, 40)
          setTimeout(() => {
            top = 450
            document.dispatchEvent(new Event('scroll'))
          }, 60)
          setTimeout(() => {
            top = 440
            document.dispatchEvent(new Event('scroll'))
          }, 80)
          setTimeout(() => {
            top = 420
            document.dispatchEvent(new Event('scroll'))
          }, 220)
        },
      },
    })

    await scrollTourTarget(
      target,
      { behavior: 'smooth', block: 'center' },
      new AbortController().signal,
    )

    expect(top).toBeGreaterThan(420)
    target.remove()
  })

  it('keeps the reveal closed while a nearby target is still moving quickly', async () => {
    const target = document.createElement('div')
    document.body.append(target)
    let top = 900
    Object.defineProperties(target, {
      getBoundingClientRect: {
        value: () => ({ top, left: 0, right: 100, bottom: top + 40, width: 100, height: 40 }),
      },
      scrollIntoView: {
        value: () => {
          setTimeout(() => {
            top = 430
            document.dispatchEvent(new Event('scroll'))
          }, 20)
          setTimeout(() => {
            top = 410
            document.dispatchEvent(new Event('scroll'))
          }, 40)
          setTimeout(() => {
            top = 390
            document.dispatchEvent(new Event('scroll'))
          }, 60)
        },
      },
    })

    let revealed = false
    const scrolling = scrollTourTarget(
      target,
      { behavior: 'smooth', block: 'center' },
      new AbortController().signal,
    ).then(() => {
      revealed = true
    })

    await new Promise(resolve => setTimeout(resolve, 70))
    expect(revealed).toBe(false)
    await scrolling
    expect(revealed).toBe(true)
    target.remove()
  })
})

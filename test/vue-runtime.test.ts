// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { defineTour } from '../src/runtime/definition'
import { TourTargetRegistry } from '../src/runtime/targets'
import TourHost from '../src/runtime/vue/TourHost.vue'
import { createTourInstallation, createTourPlugin } from '../src/runtime/vue/plugin'
import { vTourTarget } from '../src/runtime/vue/tour-target-directive'
import { useTour } from '../src/runtime/vue/use-tour'
import { useTourTarget } from '../src/runtime/vue/use-tour-target'
import { TourVueRuntime } from '../src/runtime/vue/runtime'

const visibleRect = {
  x: 40,
  y: 40,
  top: 40,
  left: 40,
  right: 140,
  bottom: 80,
  width: 100,
  height: 40,
  toJSON: () => ({}),
}

function makeVisible(element: HTMLElement): void {
  Object.defineProperties(element, {
    getClientRects: { value: () => [visibleRect], configurable: true },
    getBoundingClientRect: { value: () => visibleRect, configurable: true },
    scrollIntoView: { value: () => {}, configurable: true },
  })
}

async function flushTour(): Promise<void> {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}

describe('Vue runtime', () => {
  it('renders a named dialog and restores focus after Escape', async () => {
    const definition = defineTour({
      id: 'welcome',
      steps: [{ id: 'hello', title: 'Welcome', content: 'Let us begin.' }],
    })
    const installation = createTourInstallation({ tours: [definition] })
    const App = defineComponent({
      setup() {
        const tour = useTour(definition)
        return () => h('main', [
          h('button', { id: 'start', onClick: () => tour.start() }, 'Start tour'),
          h(TourHost),
        ])
      },
    })
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [installation.plugin] } })
    const start = wrapper.get('#start')
    const appRoot = wrapper.element.parentElement as HTMLElement
    makeVisible(start.element as HTMLElement)
    ;(start.element as HTMLElement).focus()

    await start.trigger('click')
    await flushTour()

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.textContent).toContain('Welcome')
    expect(dialog?.textContent).toContain('Let us begin.')
    expect(document.activeElement?.getAttribute('data-tour-part')).toBe('title')
    expect(appRoot.inert).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushTour()

    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(start.element)
    expect(appRoot.inert).toBe(false)
    wrapper.unmount()
  })

  it('supports semantic refs and disposes their registrations', async () => {
    const definition = defineTour({
      id: 'targets',
      steps: [{ id: 'one', title: 'One', content: 'One' }],
    })
    const installation = createTourInstallation({ tours: [definition] })
    const target = ref<HTMLElement | null>(null)
    const App = defineComponent({
      setup() {
        useTourTarget('save', target)
        return () => h('button', { ref: target }, 'Save')
      },
    })
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [installation.plugin] } })
    makeVisible(wrapper.element as HTMLElement)
    await nextTick()

    expect(installation.runtime.targets.resolve('save')).toBe(wrapper.element)
    wrapper.unmount()
    expect(installation.runtime.targets.ids).toEqual([])
  })

  it('emits the directive attribute without a runtime registry dependency', () => {
    const element = document.createElement('button')
    vTourTarget.mounted?.(element, { value: 'save' } as never, {} as never, null)
    expect(element.dataset.tourTarget).toBe('save')
  })

  it('waits for late targets and reports visible duplicates', async () => {
    const registry = new TourTargetRegistry()
    const controller = new AbortController()
    const waiting = registry.wait('late', { signal: controller.signal, timeout: 100 })
    const late = document.createElement('button')
    makeVisible(late)
    document.body.append(late)
    const unregister = registry.register('late', late)
    await expect(waiting).resolves.toBe(late)
    unregister()
    late.remove()

    const first = document.createElement('button')
    const second = document.createElement('button')
    makeVisible(first)
    makeVisible(second)
    document.body.append(first, second)
    const stopFirst = registry.register('duplicate', first)
    const stopSecond = registry.register('duplicate', second)

    expect(() => registry.resolve('duplicate')).toThrowError(expect.objectContaining({
      code: 'TARGET_AMBIGUOUS',
    }))
    stopFirst()
    stopSecond()
    first.remove()
    second.remove()
  })

  it('fails clearly when TourHost is absent', async () => {
    const definition = defineTour({
      id: 'hostless',
      steps: [{ id: 'one', title: 'One', content: 'One' }],
    })
    const installation = createTourInstallation({ tours: [definition] })

    await expect(installation.runtime.controller(definition).start()).rejects.toEqual(expect.objectContaining({
      code: 'HOST_NOT_FOUND',
    }))
  })

  it('cancels while the host is preparing a presentation', async () => {
    const definition = defineTour({
      id: 'cancel-render',
      steps: [{ id: 'one', title: 'One', content: 'One' }],
    })
    const runtime = new TourVueRuntime([definition])
    const unregister = runtime.registerHost()
    const tour = runtime.controller(definition)

    const start = tour.start()
    await Promise.resolve()
    await tour.cancel('test')
    await start

    expect(tour.status.value).toBe('idle')
    expect(runtime.presentation.value).toBeNull()
    unregister()
  })

  it('accepts Vue Router directly without a navigation wrapper', async () => {
    const definition = defineTour({
      id: 'vue-router',
      steps: [{ id: 'route', route: '/projects', title: 'Route', content: 'Route' }],
    })
    const pushed: unknown[] = []
    const installation = createTourInstallation({
      tours: [definition],
      router: {
        async push(route: unknown) {
          pushed.push(route)
        },
      },
    })
    const unregister = installation.runtime.registerHost()
    const start = installation.runtime.controller(definition).start()
    await flushTour()
    const presentation = installation.runtime.presentation.value
    expect(presentation).not.toBeNull()
    installation.runtime.ready(presentation!.transitionId)

    await start
    expect(pushed).toEqual(['/projects'])
    unregister()
  })

  it('keeps runtime internals out of the public Vue plugin', () => {
    const definition = defineTour({
      id: 'public-plugin',
      steps: [{ id: 'one', title: 'One', content: 'One' }],
    })
    expect(createTourPlugin({ tours: [definition] })).not.toHaveProperty('runtime')
  })
})

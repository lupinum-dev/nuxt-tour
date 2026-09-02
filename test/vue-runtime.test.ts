// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { defineComponent, h, inject, nextTick, ref } from 'vue'
import type { App, InjectionKey } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { defineTour } from '../src/runtime/definition'
import type { TourController } from '../src/runtime/types'
import { TourTargetRegistry } from '../src/runtime/targets'
import TourHost from '../src/runtime/vue/TourHost.vue'
import { createTourPlugin, installTour } from '../src/runtime/vue/plugin'
import type { TourPluginOptions } from '../src/runtime/vue/plugin'
import { createTourTargetDirective } from '../src/runtime/vue/tour-target-directive'
import { useTour } from '../src/runtime/vue/use-tour'
import { useTourTarget } from '../src/runtime/vue/use-tour-target'
import { TourVueRuntime } from '../src/runtime/vue/runtime'

vi.stubGlobal('matchMedia', () => ({ matches: true }))

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

function createTourInstallation(options: TourPluginOptions) {
  let runtime: TourVueRuntime | undefined
  return {
    plugin: {
      install(app: App) {
        runtime = installTour(app, options)
      },
    },
    get runtime(): TourVueRuntime {
      if (!runtime) throw new Error('The test application is not mounted.')
      return runtime
    },
  }
}

async function flushTour(): Promise<void> {
  await nextTick()
  // TourHost intentionally holds its covered, positioned state through a
  // browser paint before revealing. Advance enough frames to settle either a
  // targeted or centered step without replacing that production behaviour.
  for (let frame = 0; frame < 4; frame += 1) {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }
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

  it('keeps the spotlight mounted while replacing targeted steps', async () => {
    const definition = defineTour({
      id: 'continuous-backdrop',
      steps: [
        { id: 'one', target: 'one', title: 'One', content: 'One' },
        { id: 'two', target: 'two', title: 'Two', content: 'Two' },
      ],
    })
    const installation = createTourInstallation({ tours: [definition] })
    const App = defineComponent({
      setup() {
        const tour = useTour(definition)
        return () => h('main', [
          h('button', { id: 'start', onClick: () => tour.start() }, 'Start tour'),
          h('button', { id: 'first-target' }, 'First target'),
          h('button', { id: 'second-target' }, 'Second target'),
          h(TourHost),
        ])
      },
    })
    const wrapper = mount(App, { attachTo: document.body, global: { plugins: [installation.plugin] } })
    for (const element of wrapper.findAll('button')) makeVisible(element.element as HTMLElement)
    const stopFirst = installation.runtime.targets.register('one', wrapper.get('#first-target').element)
    const stopSecond = installation.runtime.targets.register('two', wrapper.get('#second-target').element)

    await wrapper.get('#start').trigger('click')
    await flushTour()
    const spotlight = document.querySelector('[data-tour-part="spotlight"]')
    const arrow = document.querySelector('[data-tour-part="arrow"]')
    expect(spotlight).not.toBeNull()
    expect(arrow).toBeInstanceOf(SVGSVGElement)
    expect(arrow?.getAttribute('viewBox')).toBe('0 0 14 14')
    expect(arrow?.querySelector('path')?.getAttribute('d')).toBe('M1 8.5 6.15 2.35Q7 1.4 7.85 2.35L13 8.5Z')

    document.querySelector<HTMLButtonElement>('[data-tour-part="actions"] button:last-child')?.click()
    await flushTour()

    expect(document.querySelector('[data-tour-part="spotlight"]')).toBe(spotlight)
    expect(document.querySelector('[data-tour-part="root"]')?.getAttribute('data-tour-step-id')).toBe('two')
    stopFirst()
    stopSecond()
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

  it('registers directive targets with the owning application registry', () => {
    const registry = new TourTargetRegistry()
    const directive = createTourTargetDirective(registry)
    const element = document.createElement('button')
    makeVisible(element)
    document.body.append(element)
    directive.mounted?.(element, { value: 'save' } as never, {} as never, null)
    expect(element.dataset.tourTarget).toBe('save')
    expect(registry.resolve('save')).toBe(element)

    directive.beforeUnmount?.(element, { value: 'save' } as never, {} as never, null)
    expect(registry.resolve('save')).toBeNull()
    element.remove()
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

  it('isolates semantic IDs by registry, reference-counts registrations, and supports selectors and SVG', async () => {
    const registry = new TourTargetRegistry()
    const otherRegistry = new TourTargetRegistry()
    const registered = document.createElement('button')
    const attributed = document.createElement('button')
    attributed.setAttribute('data-tour-target', 'duplicate')
    makeVisible(registered)
    makeVisible(attributed)
    document.body.append(registered, attributed)
    const stopRegistered = registry.register('duplicate', registered)
    const stopOther = otherRegistry.register('duplicate', attributed)

    expect(registry.resolve('duplicate')).toBe(registered)
    expect(otherRegistry.resolve('duplicate')).toBe(attributed)

    const stopAgain = registry.register('duplicate', registered)
    stopRegistered()
    expect(registry.resolve('duplicate')).toBe(registered)
    stopAgain()
    registered.remove()
    expect(registry.resolve('duplicate')).toBeNull()
    expect(registry.resolve({ selector: '[data-tour-target="duplicate"]' })).toBe(attributed)
    stopOther()
    attributed.remove()

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('data-tour-target', 'chart')
    Object.defineProperties(svg, {
      getClientRects: { value: () => [visibleRect], configurable: true },
      getBoundingClientRect: { value: () => visibleRect, configurable: true },
    })
    document.body.append(svg)
    const stopSvg = registry.register('chart', svg)
    expect(registry.resolve('chart')).toBe(svg)
    stopSvg()
    svg.remove()
  })

  it('detects a layout-only visibility change while waiting', async () => {
    const registry = new TourTargetRegistry()
    const controller = new AbortController()
    const target = document.createElement('button')
    target.setAttribute('data-tour-target', 'animated')
    let visible = false
    Object.defineProperty(target, 'getClientRects', {
      value: () => visible ? [visibleRect] : [],
      configurable: true,
    })
    document.body.append(target)
    const unregister = registry.register('animated', target)

    const waiting = registry.wait('animated', { signal: controller.signal, timeout: 250 })
    await new Promise(resolve => setTimeout(resolve, 60))
    visible = true

    await expect(waiting).resolves.toBe(target)
    unregister()
    target.remove()
  })

  it('observes active target visibility through the registry', async () => {
    const registry = new TourTargetRegistry()
    const target = document.createElement('button')
    makeVisible(target)
    document.body.append(target)
    const listener = vi.fn()
    const stop = registry.observeVisibility(target, listener)

    target.remove()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(listener).toHaveBeenCalledOnce()
    stop()
  })

  it('fails clearly when TourHost is absent', async () => {
    const definition = defineTour({
      id: 'hostless',
      steps: [{ id: 'one', title: 'One', content: 'One' }],
    })
    const runtime = new TourVueRuntime([definition])

    await expect(runtime.controller(definition).start()).rejects.toEqual(expect.objectContaining({
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

    expect(tour.isActive.value).toBe(false)
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
        async replace(route: unknown) {
          pushed.push(route)
        },
      },
    })
    const wrapper = mount(defineComponent(() => () => null), {
      global: { plugins: [installation.plugin] },
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
    wrapper.unmount()
  })

  it('uses router replacement without treating its own navigation as external', async () => {
    const definition = defineTour({
      id: 'vue-router-replace',
      steps: [{
        id: 'route',
        route: { path: '/projects', query: { tab: 'open' }, replace: true },
        title: 'Route',
        content: 'Route',
      }],
    })
    let afterEach!: () => void
    const push = vi.fn()
    const replace = vi.fn(() => {
      afterEach()
    })
    const installation = createTourInstallation({
      tours: [definition],
      router: {
        push,
        replace,
        afterEach(handler) {
          afterEach = handler
          return () => {}
        },
      },
    })
    const wrapper = mount(defineComponent(() => () => null), {
      global: { plugins: [installation.plugin] },
    })
    const unregister = installation.runtime.registerHost()
    const start = installation.runtime.controller(definition).start()
    await flushTour()
    const presentation = installation.runtime.presentation.value
    expect(presentation).not.toBeNull()
    installation.runtime.ready(presentation!.transitionId)

    await start
    expect(push).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith({ path: '/projects', query: { tab: 'open' } })
    expect(installation.runtime.controller(definition).isActive.value).toBe(true)
    unregister()
    wrapper.unmount()
  })

  it('keeps runtime internals out of the public Vue plugin', () => {
    const definition = defineTour({
      id: 'public-plugin',
      steps: [{ id: 'one', title: 'One', content: 'One' }],
    })
    expect(createTourPlugin({ tours: [definition] })).not.toHaveProperty('runtime')
  })

  it('creates independent runtimes when one plugin object is reused', async () => {
    const definition = defineTour({
      id: 'isolated',
      steps: [{ id: 'one', target: 'shared', title: 'One', content: 'One' }],
    })
    const plugin = createTourPlugin({ tours: [definition] })
    const controllers: TourController<'one'>[] = []
    const App = defineComponent({
      setup() {
        const tour = useTour(definition)
        controllers.push(tour)
        const target = ref<HTMLElement | null>(null)
        useTourTarget('shared', target)
        return () => h('main', [
          h('button', { ref: target, class: 'target' }, 'Target'),
          h(TourHost),
        ])
      },
    })
    const first = mount(App, { attachTo: document.body, global: { plugins: [plugin] } })
    const second = mount(App, { attachTo: document.body, global: { plugins: [plugin] } })
    makeVisible(first.get('.target').element as HTMLElement)
    makeVisible(second.get('.target').element as HTMLElement)

    await controllers[0]!.start()
    await flushTour()

    expect(controllers[0]!.isActive.value).toBe(true)
    expect(controllers[1]!.isActive.value).toBe(false)
    expect(document.querySelector('[data-tour-part="root"]')).not.toBeNull()

    await controllers[0]!.cancel()
    first.unmount()
    second.unmount()
  })

  it('runs lifecycle callbacks with values provided by the owning Vue app', async () => {
    const key: InjectionKey<string> = Symbol('application')
    const observed: string[] = []
    const definition = defineTour({
      id: 'injection-context',
      steps: [{
        id: 'one',
        title: 'One',
        content: 'One',
        when: () => {
          observed.push(inject(key) ?? 'missing')
          return true
        },
        prepare: () => {
          observed.push(inject(key) ?? 'missing')
          return () => observed.push(inject(key) ?? 'missing')
        },
      }],
    })
    let controller!: TourController<'one'>
    const App = defineComponent({
      setup() {
        controller = useTour(definition)
        return () => h(TourHost)
      },
    })
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { plugins: [createTourPlugin({ tours: [definition] })], provide: { [key as symbol]: 'first' } },
    })

    await controller.start()
    await flushTour()
    await controller.cancel()

    expect(observed).toEqual(['first', 'first', 'first'])
    wrapper.unmount()
  })

  it('cancels a visible session when its host unmounts', async () => {
    const definition = defineTour({
      id: 'host-lifecycle',
      steps: [{ id: 'one', title: 'One', content: 'One' }],
    })
    const showHost = ref(true)
    let controller!: TourController<'one'>
    const App = defineComponent({
      setup() {
        controller = useTour(definition)
        return () => showHost.value ? h(TourHost) : null
      },
    })
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { plugins: [createTourPlugin({ tours: [definition] })] },
    })
    await controller.start()
    await flushTour()
    expect(controller.isActive.value).toBe(true)

    showHost.value = false
    await flushTour()
    await flushTour()

    expect(controller.isActive.value).toBe(false)
    expect(document.querySelector('[data-tour-part="root"]')).toBeNull()
    wrapper.unmount()
  })

  it('keeps a custom card named and described through its typed slot contract', async () => {
    const definition = defineTour({
      id: 'custom-card',
      steps: [{ id: 'one', title: 'Custom title', content: 'Custom content' }],
    })
    let controller!: TourController<'one'>
    const App = defineComponent({
      setup() {
        controller = useTour(definition)
        return () => h(TourHost, null, {
          card: ({ descriptionId }: { descriptionId: string }) => (
            h('p', { id: descriptionId }, 'Custom description')
          ),
        })
      },
    })
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { plugins: [createTourPlugin({ tours: [definition] })] },
    })

    await controller.start()
    await flushTour()

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.getAttribute('aria-label')).toBe('Custom title')
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)).not.toBeNull()

    await controller.cancel()
    wrapper.unmount()
  })

  it('checks for a host before running route side effects', async () => {
    const definition = defineTour({
      id: 'preflight',
      steps: [{ id: 'one', route: '/projects', title: 'One', content: 'One' }],
    })
    const navigate = vi.fn(async () => {})
    const runtime = new TourVueRuntime([definition], {}, { navigate })

    await expect(runtime.controller(definition).start()).rejects.toMatchObject({ code: 'HOST_NOT_FOUND' })
    expect(navigate).not.toHaveBeenCalled()
  })

  it('cancels a plain Vue tour when external navigation wins during startup', async () => {
    let afterEach!: () => void
    let preparationStarted!: () => void
    const started = new Promise<void>((resolve) => {
      preparationStarted = resolve
    })
    const definition = defineTour({
      id: 'external-route',
      steps: [{
        id: 'one',
        title: 'One',
        content: 'One',
        prepare: () => {
          preparationStarted()
          return new Promise<never>(() => {})
        },
      }],
    })
    let controller!: TourController<'one'>
    const App = defineComponent({
      setup() {
        controller = useTour(definition)
        return () => h(TourHost)
      },
    })
    const wrapper = mount(App, {
      attachTo: document.body,
      global: {
        plugins: [createTourPlugin({
          tours: [definition],
          router: {
            push: vi.fn(),
            replace: vi.fn(),
            afterEach(handler) {
              afterEach = () => handler()
              return () => {}
            },
          },
        })],
      },
    })

    const start = controller.start()
    await started
    afterEach()
    await start

    expect(controller.isActive.value).toBe(false)
    wrapper.unmount()
  })
})

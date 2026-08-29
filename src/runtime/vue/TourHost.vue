<script setup lang="ts">
import { arrow as floatingArrow, autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { CSSProperties } from 'vue'
import type { TourController, TourLabels } from '../types'
import { tourRuntimeKey } from './injection'
import { TourContent } from './TourContent'

const props = defineProps<{
  labels?: Partial<TourLabels>
}>()

const defaultLabels: TourLabels = {
  previous: 'Previous',
  next: 'Next',
  finish: 'Finish',
  skip: 'Skip tour',
  close: 'Close tour',
  progress: (current, total) => `Step ${current} of ${total}`,
}

const runtime = inject(tourRuntimeKey)
if (!runtime) throw new Error('TourHost requires the Nuxt Tour plugin.')

const mounted = ref(false)
const root = shallowRef<HTMLElement | null>(null)
const card = shallowRef<HTMLElement | null>(null)
const reference = shallowRef<HTMLElement | null>(null)
const floating = shallowRef<HTMLElement | null>(null)
const arrow = shallowRef<HTMLElement | null>(null)
const targetRect = ref<DOMRect | null>(null)
const returnFocus = shallowRef<HTMLElement | null>(null)
const inertState = new Map<HTMLElement, boolean>()

const presentation = computed(() => runtime.presentation.value)
const controller = computed<TourController | null>(() => {
  const current = presentation.value
  return current ? runtime.controller(current.definition.id) : null
})
const labels = computed<TourLabels>(() => ({ ...defaultLabels, ...props.labels }))
const placement = computed(() => presentation.value?.step.placement ?? 'bottom')
const interaction = computed(() => presentation.value?.step.interaction ?? 'blocked')
const middleware = computed(() => [
  offset(presentation.value?.step.offset ?? 12),
  flip({ padding: 12 }),
  shift({ padding: 12 }),
  floatingArrow({ element: arrow }),
])

function updateTargetRect(): void {
  targetRect.value = reference.value?.getBoundingClientRect() ?? null
}

const { floatingStyles, middlewareData, placement: resolvedPlacement, update } = useFloating(reference, floating, {
  placement,
  middleware,
  strategy: 'fixed',
  whileElementsMounted(referenceElement, floatingElement, updatePosition) {
    return autoUpdate(referenceElement, floatingElement, () => {
      updateTargetRect()
      updatePosition()
    })
  },
})

const arrowStyle = computed<CSSProperties>(() => {
  const position = middlewareData.value.arrow
  const side = resolvedPlacement.value.split('-')[0]!
  const staticSide = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }[side]
  return {
    left: position?.x === undefined ? undefined : `${position.x}px`,
    top: position?.y === undefined ? undefined : `${position.y}px`,
    [staticSide ?? 'top']: '-0.3125rem',
  }
})

const cardStyle = computed<CSSProperties>(() => presentation.value?.target
  ? floatingStyles.value
  : {
      position: 'fixed',
      insetInlineStart: '50%',
      insetBlockStart: '50%',
      transform: 'translate(-50%, -50%)',
    })

const spotlightStyle = computed<CSSProperties | undefined>(() => {
  const rect = targetRect.value
  if (!rect) return undefined
  return {
    insetInlineStart: `${rect.left}px`,
    insetBlockStart: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  }
})

const blockers = computed<CSSProperties[]>(() => {
  if (interaction.value !== 'target' || !targetRect.value) return []
  const rect = targetRect.value
  return [
    { inset: '0 0 auto 0', height: `${Math.max(0, rect.top)}px` },
    { inset: `${rect.bottom}px 0 0 0` },
    { inset: `${rect.top}px auto auto 0`, width: `${Math.max(0, rect.left)}px`, height: `${rect.height}px` },
    { inset: `${rect.top}px 0 auto ${rect.right}px`, height: `${rect.height}px` },
  ]
})

function clearInert(): void {
  for (const [element, wasInert] of inertState) element.inert = wasInert
  inertState.clear()
}

function applyInert(): void {
  clearInert()
  if (interaction.value !== 'blocked' || !root.value) return
  for (const child of document.body.children) {
    if (!(child instanceof HTMLElement) || child === root.value) continue
    inertState.set(child, child.inert)
    child.inert = true
  }
}

function focusableWithin(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',')
  const result = [...container.querySelectorAll<HTMLElement>(selector)]
  if (container.matches(selector)) result.unshift(container)
  return result.filter(element => !element.hidden && element.getClientRects().length > 0)
}

function trappedElements(): HTMLElement[] {
  if (!root.value) return []
  const elements = focusableWithin(root.value)
  if (interaction.value === 'target' && reference.value) {
    elements.unshift(...focusableWithin(reference.value))
  }
  return [...new Set(elements)]
}

function onKeydown(event: KeyboardEvent): void {
  if (!presentation.value || !controller.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    void controller.value.cancel('escape')
    return
  }
  if (event.key !== 'Tab' || interaction.value === 'allowed') return

  const elements = trappedElements()
  if (elements.length === 0) {
    event.preventDefault()
    card.value?.focus()
    return
  }
  const activeIndex = elements.indexOf(document.activeElement as HTMLElement)
  const nextIndex = event.shiftKey
    ? (activeIndex <= 0 ? elements.length - 1 : activeIndex - 1)
    : (activeIndex < 0 || activeIndex === elements.length - 1 ? 0 : activeIndex + 1)
  event.preventDefault()
  elements[nextIndex]?.focus()
}

function run(command: (() => Promise<void>) | undefined): void {
  void command?.().catch(() => {})
}

function closeTour(): void {
  run(() => controller.value?.cancel('close-button') ?? Promise.resolve())
}

watch(
  presentation,
  async (current) => {
    reference.value = current?.target ?? null
    if (!current) {
      targetRect.value = null
      return
    }
    if (!current.target) targetRect.value = null
    try {
      await nextTick()
      if (presentation.value?.transitionId !== current.transitionId) return
      updateTargetRect()
      await update()
      await nextTick()
      if (presentation.value?.transitionId !== current.transitionId) return
      const title = root.value?.querySelector<HTMLElement>('[data-tour-part="title"]')
      ;(title ?? card.value)?.focus({ preventScroll: true })
      applyInert()
      runtime.ready(current.transitionId)
    }
    catch (error) {
      runtime.fail(current.transitionId, error)
    }
  },
  { flush: 'post' },
)

watch(
  () => runtime.sessionActive.value,
  (active, wasActive) => {
    if (active && !wasActive) {
      returnFocus.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
      return
    }
    if (!active && wasActive) {
      clearInert()
      if (returnFocus.value?.isConnected) returnFocus.value.focus({ preventScroll: true })
      returnFocus.value = null
    }
  },
)

let unregisterHost: (() => void) | undefined
onMounted(() => {
  mounted.value = true
  unregisterHost = runtime.registerHost()
  document.addEventListener('keydown', onKeydown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown, true)
  unregisterHost?.()
  clearInert()
})
</script>

<template>
  <Teleport
    v-if="mounted && runtime.sessionActive.value"
    to="body"
  >
    <div
      ref="root"
      data-tour-part="root"
      :data-tour-id="presentation?.definition.id"
      :data-tour-step-id="presentation?.step.id"
    >
      <div
        data-tour-part="overlay"
        :data-centered="presentation && (!presentation.target || !targetRect) ? '' : undefined"
        aria-hidden="true"
      />

      <div
        v-if="presentation?.target && targetRect"
        data-tour-part="spotlight"
        :style="spotlightStyle"
        aria-hidden="true"
      />

      <div
        v-if="interaction === 'blocked'"
        data-tour-part="blocker"
        aria-hidden="true"
      />
      <div
        v-for="(style, blockerIndex) in blockers"
        :key="blockerIndex"
        data-tour-part="blocker"
        :style="style"
        aria-hidden="true"
      />

      <div
        v-if="presentation && controller"
        ref="floating"
        data-tour-part="positioner"
        :style="cardStyle"
      >
        <section
          ref="card"
          data-tour-part="card"
          role="dialog"
          :aria-modal="interaction === 'blocked' ? 'true' : undefined"
          :aria-labelledby="presentation.step.title ? `tour-title-${presentation.transitionId}` : undefined"
          :aria-label="presentation.step.title ? undefined : presentation.step.ariaLabel"
          tabindex="-1"
        >
          <slot
            name="card"
            :step="presentation.step"
            :controller="controller"
            :index="presentation.index"
            :total="controller.total.value"
          >
            <button
              type="button"
              data-tour-part="close"
              :aria-label="labels.close"
              @click="closeTour"
            >
              <span aria-hidden="true">×</span>
            </button>

            <p data-tour-part="progress">
              {{ labels.progress(presentation.index + 1, controller.total.value) }}
            </p>
            <h2
              v-if="presentation.step.title"
              :id="`tour-title-${presentation.transitionId}`"
              data-tour-part="title"
              tabindex="-1"
            >
              {{ presentation.step.title }}
            </h2>
            <TourContent :step="presentation.step" />

            <div data-tour-part="actions">
              <button
                v-if="presentation.index > 0"
                type="button"
                :disabled="controller.pending.value"
                @click="run(controller.previous)"
              >
                {{ labels.previous }}
              </button>
              <button
                type="button"
                :disabled="controller.pending.value"
                @click="run(controller.skip)"
              >
                {{ labels.skip }}
              </button>
              <button
                type="button"
                :disabled="controller.pending.value"
                @click="run(controller.next)"
              >
                {{ presentation.index === controller.total.value - 1 ? labels.finish : labels.next }}
              </button>
            </div>
          </slot>
        </section>
        <span
          v-if="presentation.target"
          ref="arrow"
          data-tour-part="arrow"
          :style="arrowStyle"
          aria-hidden="true"
        />
      </div>
    </div>
  </Teleport>
</template>

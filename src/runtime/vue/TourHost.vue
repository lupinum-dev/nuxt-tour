<script setup lang="ts">
import { arrow as floatingArrow, autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { createFocusTrap } from 'focus-trap'
import type { FocusTrap } from 'focus-trap'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { isVisibleTarget } from '../targets'
import type { TourCardSlotProps, TourController, TourLabels } from '../types'
import { TourContent } from './TourContent'
import { useTourRuntime } from './use-runtime'

const props = defineProps<{
  labels?: Partial<TourLabels>
}>()

defineSlots<{
  card: (props: TourCardSlotProps) => unknown
}>()

const defaultLabels: TourLabels = {
  previous: 'Previous',
  next: 'Next',
  finish: 'Finish',
  skip: 'Skip tour',
  close: 'Close tour',
  pending: 'Loading next step',
  progress: (current, total) => `Step ${current} of ${total}`,
}

const runtime = useTourRuntime('TourHost')

const mounted = ref(false)
const root = shallowRef<HTMLElement | null>(null)
const card = shallowRef<HTMLElement | null>(null)
const reference = shallowRef<Element | null>(null)
const floating = shallowRef<HTMLElement | null>(null)
const arrow = shallowRef<HTMLElement | null>(null)
const targetRect = ref<DOMRect | null>(null)
const positionReady = ref(false)
let focusTrap: FocusTrap | null = null

const scene = computed(() => runtime.scene.value)
const presentation = computed(() => scene.value.phase === 'hidden' ? null : scene.value.presentation)
const visualTarget = computed(() => scene.value.phase === 'hidden' ? null : scene.value.target)
const visualPhase = computed(() => scene.value.phase)
const relocating = computed(() => visualPhase.value === 'moving')
const controller = computed<TourController | null>(() => {
  const current = presentation.value
  return current ? runtime.controller(current.definition.id) : null
})
const labels = computed<TourLabels>(() => ({ ...defaultLabels, ...props.labels }))
const placement = computed(() => presentation.value?.step.placement ?? 'bottom')
const interaction = computed(() => presentation.value?.step.interaction ?? 'modal')
const titleId = computed(() => presentation.value?.step.title
  ? `tour-title-${presentation.value.transitionId}`
  : undefined)
const descriptionId = computed(() => presentation.value
  ? `tour-description-${presentation.value.transitionId}`
  : '')
const middleware = computed(() => [
  offset(presentation.value?.step.offset ?? 12),
  flip({ padding: 12 }),
  shift({ padding: 12, crossAxis: true }),
  floatingArrow({ element: arrow }),
])

function updateTargetRect(target = visualTarget.value): void {
  if (!target || !isVisibleTarget(target)) {
    targetRect.value = null
    return
  }

  const rect = target.getBoundingClientRect()
  const view = target.ownerDocument.defaultView
  const intersectsViewport = !view
    || (rect.bottom > 0 && rect.right > 0 && rect.top < view.innerHeight && rect.left < view.innerWidth)
  targetRect.value = intersectsViewport ? rect : null
}

const { floatingStyles, middlewareData, placement: resolvedPlacement, update } = useFloating(reference, floating, {
  placement,
  middleware,
  strategy: 'fixed',
  whileElementsMounted(referenceElement, floatingElement, updatePosition) {
    return autoUpdate(referenceElement, floatingElement, updatePosition)
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
  ? {
      ...floatingStyles.value,
      visibility: positionReady.value ? undefined : 'hidden',
    }
  : {
      position: 'fixed',
      insetInlineStart: '50%',
      insetBlockStart: '50%',
      transform: 'translate(-50%, -50%)',
    })

const spotlightStyle = computed<CSSProperties | undefined>(() => {
  const rect = targetRect.value
  if (!rect) return undefined
  const padding = root.value
    ? Number.parseFloat(getComputedStyle(root.value).getPropertyValue('--tour-spotlight-padding')) || 0
    : 0
  return {
    left: '0',
    top: '0',
    transform: `translate3d(${rect.left - padding}px, ${rect.top - padding}px, 0)`,
    width: `${rect.width + padding * 2}px`,
    height: `${rect.height + padding * 2}px`,
  }
})

const blockers = computed<CSSProperties[]>(() => {
  if (visualPhase.value === 'covering' || visualPhase.value === 'moving') {
    return interaction.value === 'modal' ? [] : [{ inset: '0' }]
  }
  if (interaction.value !== 'target' || !targetRect.value) return []
  const rect = targetRect.value
  return [
    { inset: '0 0 auto 0', height: `${Math.max(0, rect.top)}px` },
    { inset: `${rect.bottom}px 0 0 0` },
    { inset: `${rect.top}px auto auto 0`, width: `${Math.max(0, rect.left)}px`, height: `${rect.height}px` },
    { inset: `${rect.top}px 0 auto ${rect.right}px`, height: `${rect.height}px` },
  ]
})

function onKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.key !== 'Escape' || !presentation.value || !controller.value) return
  event.preventDefault()
  void controller.value.cancel('escape')
}

function deactivateFocusTrap(): void {
  focusTrap?.deactivate({ returnFocus: false })
  focusTrap = null
}

function activateFocusTrap(): void {
  deactivateFocusTrap()
  const currentCard = card.value
  if (!currentCard || interaction.value === 'page') return
  const focusableTarget = reference.value instanceof HTMLElement || reference.value instanceof SVGElement
    ? reference.value
    : null
  const containers = interaction.value === 'target' && focusableTarget
    ? [currentCard, focusableTarget]
    : [currentCard]
  const tabbableOptions = {
    // Include a target that is itself interactive, such as a button or link.
    includeContainer: true,
    displayCheck: 'full' as const,
  }
  focusTrap = createFocusTrap(containers, {
    escapeDeactivates: false,
    fallbackFocus: currentCard,
    initialFocus: () => root.value?.querySelector<HTMLElement>('[data-tour-part="title"]') ?? currentCard,
    isolateSubtrees: 'inert',
    delayInitialFocus: false,
    preventScroll: true,
    returnFocusOnDeactivate: false,
    tabbableOptions,
  })
  focusTrap.activate()
}

function run(command: (() => Promise<void>) | undefined): void {
  void command?.().catch((error) => {
    if (typeof globalThis.reportError === 'function') globalThis.reportError(error)
    else console.error('[nuxt-tour] A tour action failed.', error)
  })
}

async function waitForAnimationFrames(count: number): Promise<void> {
  for (let frame = 0; frame < count; frame += 1) {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }
}

function closeTour(): void {
  run(() => controller.value?.cancel('close-button') ?? Promise.resolve())
}

watch(
  visualTarget,
  async (target, _previous, onCleanup) => {
    if (!target) {
      targetRect.value = null
      return
    }
    await nextTick()
    if (visualTarget.value !== target) return
    updateTargetRect(target)
    if (root.value) onCleanup(autoUpdate(target, root.value, () => updateTargetRect(target)))
  },
  { flush: 'post' },
)

async function waitForCoverAnimations(): Promise<void> {
  await nextTick()
  const elements = [floating.value, root.value?.querySelector<HTMLElement>('[data-tour-part="spotlight"]')]
    .filter((element): element is HTMLElement => element !== null && element !== undefined)
    .filter(element => typeof element.getAnimations === 'function')
  if (elements.length === 0) return
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  const animations = elements
    .flatMap(element => element.getAnimations())
    // Consumer styling must not be able to deadlock a tour with an unrelated
    // infinite animation on one of the host elements.
    .filter(animation => Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))
  await Promise.allSettled(animations.map(animation => animation.finished))
}

watch(
  scene,
  async (current) => {
    if (current.phase !== 'moving') return
    const transitionId = current.presentation.transitionId
    await waitForCoverAnimations()
    const latest = scene.value
    if (latest.phase === 'moving' && latest.presentation.transitionId === transitionId) {
      runtime.covered(transitionId)
    }
  },
  { flush: 'post' },
)

watch(
  presentation,
  async (current, _previous, onCleanup) => {
    positionReady.value = false
    reference.value = current?.target ?? null
    if (!current) {
      targetRect.value = null
      deactivateFocusTrap()
      return
    }
    if (!current.target) targetRect.value = null
    if (current.target) {
      let recovering = false
      const stopObserving = runtime.targets.observeVisibility(current.target, () => {
        if (recovering) return
        recovering = true
        reference.value = null
        targetRect.value = null
        activateFocusTrap()
        void runtime.targetDisconnected(current.transitionId).catch((error) => {
          if (typeof globalThis.reportError === 'function') globalThis.reportError(error)
          else console.error('[nuxt-tour] The active target could not be recovered.', error)
        })
      })
      onCleanup(stopObserving)
    }
    try {
      await nextTick()
      if (presentation.value?.transitionId !== current.transitionId) return
      updateTargetRect()
      update()
      // Floating UI calculates asynchronously. Keep the card hidden until its
      // first real coordinates have reached the DOM, so it never flashes at 0,0.
      if (current.target) {
        await waitForAnimationFrames(1)
      }
      await nextTick()
      if (presentation.value?.transitionId !== current.transitionId) return
      positionReady.value = true
      await nextTick()
      if (presentation.value?.transitionId !== current.transitionId) return
      // A Vue DOM flush does not guarantee that the browser painted the
      // covered spotlight and hidden card. Keep that starting state for one
      // real frame so the following CSS transitions cannot be skipped.
      await waitForAnimationFrames(2)
      if (presentation.value?.transitionId !== current.transitionId) return
      runtime.reveal(current.transitionId)
      await nextTick()
      if (presentation.value?.transitionId !== current.transitionId) return
      activateFocusTrap()
      if (interaction.value === 'page') {
        const title = root.value?.querySelector<HTMLElement>('[data-tour-part="title"]')
        ;(title ?? card.value)?.focus({ preventScroll: true })
      }
      runtime.ready(current.transitionId)
    }
    catch (error) {
      runtime.fail(current.transitionId, error)
    }
  },
  // Hide the old positioned card before Vue can paint the destination content.
  // The async branch then reveals it only after Floating UI has settled.
  { flush: 'sync' },
)

let unregisterHost: (() => void) | undefined
onMounted(() => {
  mounted.value = true
  unregisterHost = runtime.registerHost()
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  unregisterHost?.()
  deactivateFocusTrap()
})
</script>

<template>
  <Teleport
    v-if="mounted && visualPhase !== 'hidden'"
    to="body"
  >
    <div
      ref="root"
      data-tour-part="root"
      :data-tour-id="presentation?.definition.id"
      :data-tour-step-id="presentation?.step.id"
      :data-visual-phase="visualPhase"
      :data-relocating="relocating ? '' : undefined"
    >
      <div
        data-tour-part="overlay"
        :data-centered="!visualTarget || !targetRect ? '' : undefined"
        aria-hidden="true"
      />

      <div
        v-if="visualTarget && targetRect"
        data-tour-part="spotlight"
        :style="spotlightStyle"
        aria-hidden="true"
      />

      <div
        v-if="interaction === 'modal'"
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
        :data-placement="presentation.target ? resolvedPlacement : undefined"
        :data-positioned="!presentation.target || positionReady ? '' : undefined"
        :style="cardStyle"
      >
        <section
          ref="card"
          data-tour-part="card"
          role="dialog"
          :aria-modal="interaction === 'modal' ? 'true' : undefined"
          :aria-label="presentation.step.ariaLabel ?? presentation.step.title"
          :aria-describedby="descriptionId"
          :aria-busy="controller.pending.value ? 'true' : undefined"
          tabindex="-1"
        >
          <slot
            name="card"
            :step="presentation.step"
            :controller="controller"
            :index="presentation.index"
            :total="controller.total.value"
            :title-id="titleId"
            :description-id="descriptionId"
            :pending="controller.pending.value"
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
            <span
              v-if="controller.pending.value"
              data-tour-part="pending"
              role="status"
            >
              {{ labels.pending }}
            </span>
            <h2
              v-if="presentation.step.title"
              :id="titleId"
              data-tour-part="title"
              tabindex="-1"
            >
              {{ presentation.step.title }}
            </h2>
            <div :id="descriptionId">
              <TourContent :step="presentation.step" />
            </div>

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
          v-if="presentation.target && positionReady"
          ref="arrow"
          data-tour-part="arrow"
          :style="arrowStyle"
          aria-hidden="true"
        />
      </div>
    </div>
  </Teleport>
</template>

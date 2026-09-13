<script setup lang="ts">
import { arrow as floatingArrow, autoUpdate, flip, offset, shift, size, useFloating } from '@floating-ui/vue'
import { createFocusTrap } from 'focus-trap'
import type { FocusTrap } from 'focus-trap'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { isVisibleTarget } from '../targets'
import type { TourCardSlotProps, TourController, TourLabels, TourSectionSlotProps } from '../types'
import { TourContent } from './TourContent'
import { createSpotlightMotion } from './spotlight-motion'
import { useTourRuntime } from './use-runtime'

const props = defineProps<{
  labels?: Partial<TourLabels>
}>()

defineSlots<{
  card: (props: TourCardSlotProps) => unknown
  actions: (props: TourSectionSlotProps) => unknown
  progress: (props: TourSectionSlotProps) => unknown
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
const arrow = shallowRef<SVGSVGElement | null>(null)
const targetRect = shallowRef<DOMRect | null>(null)
const spotlight = shallowRef<HTMLElement | null>(null)
const travelling = ref(false)
const slowPending = ref(false)
const loading = shallowRef<HTMLElement | null>(null)
let motion: ReturnType<typeof createSpotlightMotion> | undefined
let motionReady = Promise.resolve()
const positionReady = ref(false)
const viewport = shallowRef({ left: 0, top: 0, width: 0, height: 0 })
function updateViewport(): void {
  const visual = window.visualViewport
  viewport.value = { left: visual?.offsetLeft ?? 0, top: visual?.offsetTop ?? 0, width: visual?.width ?? window.innerWidth, height: visual?.height ?? window.innerHeight }
}
let focusTrap: FocusTrap | null = null

const scene = computed(() => runtime.scene.value)
const presentation = computed(() => scene.value.phase === 'hidden' ? null : scene.value.presentation)
const visualTarget = computed(() => scene.value.phase === 'hidden' ? null : scene.value.target)
const visualPhase = computed(() => scene.value.phase)
const travel = computed(() => scene.value.phase !== 'hidden' && Boolean(scene.value.travel))
const relocating = computed(() => visualPhase.value === 'moving')
const controller = computed<TourController | null>(() => {
  const current = presentation.value
  return current ? runtime.controller(current.definition.id) : null
})
const labels = computed<TourLabels>(() => ({ ...defaultLabels, ...props.labels }))
const placement = computed(() => presentation.value?.step.placement ?? 'bottom')
const interaction = computed(() => presentation.value?.step.interaction ?? 'modal')
const stepLabels = computed(() => {
  const current = presentation.value
  if (!current) return { title: undefined, ariaLabel: undefined }
  try {
    const translated = labels.value.step?.({ tourId: current.definition.id, step: current.step })
    return {
      title: translated?.title?.trim() ? translated.title : current.step.title,
      ariaLabel: translated?.ariaLabel?.trim() ? translated.ariaLabel : current.step.ariaLabel,
    }
  }
  catch (error) {
    reportError(error)
    return { title: current.step.title, ariaLabel: current.step.ariaLabel }
  }
})
const titleId = computed(() => presentation.value && stepLabels.value.title
  ? `tour-title-${presentation.value.transitionId}`
  : undefined)
const descriptionId = computed(() => presentation.value
  ? `tour-description-${presentation.value.transitionId}`
  : '')
const arrowPadding = ref(18)
const targetClearance = ref(15)
const defaultOffset = computed(() => targetClearance.value + (presentation.value?.step.gap ?? 12))

function updateArrowMetrics(): void {
  if (!card.value) return
  const style = getComputedStyle(card.value)
  const radius = Math.max(...[
    style.borderTopLeftRadius, style.borderTopRightRadius,
    style.borderBottomLeftRadius, style.borderBottomRightRadius,
  ].map(value => Number.parseFloat(value) || 0))
  const arrowReach = (arrow.value?.getBoundingClientRect().width ?? 14) / 2
  const spotlightPadding = spotlight.value ? Number.parseFloat(getComputedStyle(spotlight.value).paddingTop) || 0 : 8
  arrowPadding.value = radius + arrowReach
  // Leave breathing room beyond the padded opening and the arrow tip.
  targetClearance.value = spotlightPadding + arrowReach
}

const middleware = computed(() => [
  offset(presentation.value?.step.offset ?? defaultOffset.value),
  flip({ padding: 12 }),
  shift({ padding: 12, crossAxis: interaction.value === 'modal' }),
  size({
    padding: 12,
    apply({ availableHeight, availableWidth, elements }) {
      elements.floating.style.setProperty('--tour-available-height', `${Math.max(0, availableHeight)}px`)
      elements.floating.style.setProperty('--tour-available-width', `${Math.max(0, availableWidth)}px`)
    },
  }),
  floatingArrow({ element: arrow, padding: arrowPadding.value }),
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
    return autoUpdate(referenceElement, floatingElement, () => {
      updateArrowMetrics()
      updatePosition()
    })
  },
})

const arrowStyle = computed<CSSProperties>(() => {
  const position = middlewareData.value.arrow
  const side = resolvedPlacement.value.split('-')[0]!
  const staticSide = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }[side]
  const shifted = middlewareData.value.shift
  const gap = presentation.value?.step.offset ?? defaultOffset.value
  const overlapsTarget = side === 'bottom'
    ? (shifted?.y ?? 0) < -gap
    : side === 'top'
      ? (shifted?.y ?? 0) > gap
      : side === 'right'
        ? (shifted?.x ?? 0) < -gap
        : (shifted?.x ?? 0) > gap
  const rotation = { top: '180deg', right: '-90deg', bottom: '0deg', left: '90deg' }[side]
  return {
    left: position?.x === undefined ? undefined : `${position.x}px`,
    top: position?.y === undefined ? undefined : `${position.y}px`,
    visibility: position?.centerOffset || overlapsTarget ? 'hidden' : undefined,
    transform: rotation ? `rotate(${rotation})` : undefined,
    [staticSide ?? 'top']: 'calc(var(--tour-arrow-size, 0.875rem) / -2)',
  }
})

const cardStyle = computed<CSSProperties>(() => presentation.value?.target
  ? {
      ...floatingStyles.value,
      visibility: positionReady.value ? undefined : 'hidden',
    }
  : {
      'position': 'fixed',
      'left': `${viewport.value.left + viewport.value.width / 2}px`,
      'top': `${viewport.value.top + viewport.value.height / 2}px`,
      '--tour-available-height': `${Math.max(0, viewport.value.height - 32)}px`,
      '--tour-available-width': `${Math.max(0, viewport.value.width - 32)}px`,
      'transform': 'translate(-50%, -50%)',
    })

const slotContext = computed<TourCardSlotProps | undefined>(() => {
  if (!presentation.value || !controller.value) return
  return {
    tourId: presentation.value.definition.id,
    title: stepLabels.value.title,
    ariaLabel: stepLabels.value.ariaLabel ?? stepLabels.value.title ?? '',
    step: presentation.value.step,
    controller: controller.value,
    index: presentation.value.index,
    total: controller.value.total.value,
    titleId: titleId.value,
    descriptionId: descriptionId.value,
    pending: controller.value.pending.value,
  }
})

watch(spotlight, (element, _previous, onCleanup) => {
  motion = element ? createSpotlightMotion(element) : undefined
  if (motion) onCleanup(() => motion?.dispose())
}, { flush: 'sync' })

let paintedTarget: Element | null = null
watch([spotlight, targetRect], ([element, rect]) => {
  const target = visualTarget.value
  if (!element || !rect || !motion) return
  const animate = runtime.motion !== 'none' && travel.value && target !== paintedTarget
  paintedTarget = target
  if (animate) travelling.value = true
  const pending = motion.move(rect, animate)
  motionReady = pending
  void pending.then(() => {
    if (motionReady === pending) travelling.value = false
  })
}, { flush: 'post' })

watch(() => controller.value?.pending.value ?? visualPhase.value === 'covering', (pending, _previous, onCleanup) => {
  slowPending.value = false
  if (!pending) return
  const timer = setTimeout(() => {
    slowPending.value = true
  }, 400)
  onCleanup(() => clearTimeout(timer))
}, { immediate: true })

const blockers = computed<CSSProperties[]>(() => {
  if (travelling.value || visualPhase.value === 'covering' || visualPhase.value === 'moving') {
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
  if (event.defaultPrevented || event.key !== 'Escape' || visualPhase.value === 'hidden') return
  event.preventDefault()
  run(() => runtime.cancelActive('escape'))
}

function deactivateFocusTrap(): void {
  focusTrap?.deactivate({ returnFocus: false })
  focusTrap = null
}

function activateFocusTrap(): void {
  deactivateFocusTrap()
  const currentCard = card.value ?? loading.value ?? root.value
  if (!currentCard || interaction.value === 'page') return
  const focusableTarget = reference.value instanceof HTMLElement || reference.value instanceof SVGElement
    ? reference.value
    : null
  const containers = interaction.value === 'target' && !travelling.value
    && visualPhase.value !== 'moving' && visualPhase.value !== 'covering' && focusableTarget
    ? [currentCard, focusableTarget]
    : [currentCard]
  if (loading.value && loading.value !== currentCard) containers.push(loading.value)
  const tabbableOptions = {
    // Include a target that is itself interactive, such as a button or link.
    includeContainer: true,
    displayCheck: 'full' as const,
  }
  focusTrap = createFocusTrap(containers, {
    escapeDeactivates: false,
    fallbackFocus: currentCard,
    initialFocus: () => loading.value ?? root.value?.querySelector<HTMLElement>('[data-tour-part="title"]') ?? currentCard,
    isolateSubtrees: 'inert',
    delayInitialFocus: false,
    preventScroll: true,
    returnFocusOnDeactivate: false,
    tabbableOptions,
  })
  focusTrap.activate()
}

function reportError(error: unknown): void {
  if (typeof globalThis.reportError === 'function') globalThis.reportError(error)
  else console.error('[nuxt-tour] A tour action or label failed.', error)
}

function run(command: (() => Promise<void>) | undefined): void {
  void command?.().catch(reportError)
}

async function waitForAnimationFrames(count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    if (document.hidden) return
    await new Promise<void>((resolve) => {
      const finish = () => {
        cancelAnimationFrame(frame)
        document.removeEventListener('visibilitychange', onVisibility)
        resolve()
      }
      const onVisibility = () => {
        if (document.hidden) finish()
      }
      const frame = requestAnimationFrame(finish)
      document.addEventListener('visibilitychange', onVisibility)
    })
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
    updateTargetRect(target)
    await nextTick()
    if (visualTarget.value !== target) return
    if (root.value) onCleanup(autoUpdate(target, root.value, () => updateTargetRect(target)))
  },
  { flush: 'sync' },
)

async function waitForCoverAnimations(signal: AbortSignal): Promise<void> {
  if (runtime.motion === 'none') return
  await nextTick()
  const elements = [floating.value, root.value?.querySelector<HTMLElement>('[data-tour-part="spotlight"]')]
    .filter((element): element is HTMLElement => element !== null && element !== undefined)
    .filter(element => typeof element.getAnimations === 'function')
  if (elements.length === 0) return
  await waitForAnimationFrames(1)
  const animations = elements
    .flatMap(element => element.getAnimations())
    // Only opacity handoffs belong to this handshake. Ignore unrelated CSS
    // animations, including finite paused effects supplied by the application.
    .filter(animation => 'transitionProperty' in animation && animation.transitionProperty === 'opacity' && animation.playState === 'running')
  const finishHidden = () => {
    if (document.hidden) for (const animation of animations) animation.finish()
  }
  document.addEventListener('visibilitychange', finishHidden)
  try {
    finishHidden()
    await new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer)
        signal.removeEventListener('abort', finish)
        resolve()
      }
      // Theme overrides must not extend navigation indefinitely. The built-in
      // closing transitions finish within 80 ms; allow one extra frame.
      const timer = setTimeout(finish, 120)
      signal.addEventListener('abort', finish, { once: true })
      if (signal.aborted) finish()
      else void Promise.allSettled(animations.map(animation => animation.finished)).then(finish)
    })
  }
  finally { document.removeEventListener('visibilitychange', finishHidden) }
}

watch(
  scene,
  async (current, _previous, onCleanup) => {
    if (current.phase !== 'moving') return
    const transitionId = current.presentation.transitionId
    const wait = new AbortController()
    onCleanup(() => wait.abort())
    await waitForCoverAnimations(wait.signal)
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
      await waitForAnimationFrames(runtime.motion === 'none' ? 0 : current.target ? 1 : 2)
      if (presentation.value?.transitionId !== current.transitionId) return
      runtime.reveal(current.transitionId)
      await nextTick()
      if (presentation.value?.transitionId !== current.transitionId) return
      await motionReady
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

watch([root, loading], () => {
  if (visualPhase.value !== 'hidden') activateFocusTrap()
}, { flush: 'post' })
watch(visualPhase, (phase) => {
  if (phase === 'hidden') deactivateFocusTrap()
  else if (phase === 'moving') activateFocusTrap()
}, { flush: 'sync' })

let unregisterHost: (() => void) | undefined
onMounted(() => {
  updateViewport()
  window.addEventListener('resize', updateViewport)
  window.visualViewport?.addEventListener('resize', updateViewport)
  window.visualViewport?.addEventListener('scroll', updateViewport)
  mounted.value = true
  unregisterHost = runtime.registerHost()
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport)
  window.visualViewport?.removeEventListener('resize', updateViewport)
  window.visualViewport?.removeEventListener('scroll', updateViewport)
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
      :data-motion="runtime.motion"
      tabindex="-1"
      :role="!presentation ? 'dialog' : undefined"
      :aria-modal="!presentation ? 'true' : undefined"
      :aria-label="!presentation ? labels.pending : undefined"
      :data-tour-id="presentation?.definition.id"
      :data-tour-step-id="presentation?.step.id"
      :data-visual-phase="visualPhase"
      :data-relocating="relocating ? '' : undefined"
      :data-travel="travel ? '' : undefined"
    >
      <div
        data-tour-part="overlay"
        :data-centered="!visualTarget || !targetRect ? '' : undefined"
        aria-hidden="true"
      />

      <div
        v-if="visualTarget && targetRect"
        ref="spotlight"
        data-tour-part="spotlight"
        aria-hidden="true"
      />

      <div
        v-if="interaction === 'modal'"
        data-tour-part="blocker"
        style="inset: 0"
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
        v-if="slowPending"
        ref="loading"
        data-tour-part="loading"
        :aria-label="labels.pending"
        tabindex="-1"
      >
        <span role="status">{{ labels.pending }}</span>
        <button
          type="button"
          @click="run(() => runtime.cancelActive('close-button'))"
        >
          {{ labels.close }}
        </button>
      </div>

      <div
        v-if="presentation && controller && slotContext"
        ref="floating"
        data-tour-part="positioner"
        :data-placement="presentation.target ? resolvedPlacement : undefined"
        :data-positioned="!presentation.target || positionReady ? '' : undefined"
        :style="cardStyle"
      >
        <div data-tour-part="surface">
          <section
            ref="card"
            data-tour-part="card"
            role="dialog"
            :aria-modal="interaction === 'modal' ? 'true' : undefined"
            :aria-label="slotContext.ariaLabel"
            :aria-describedby="descriptionId"
            :aria-busy="controller.pending.value ? 'true' : undefined"
            tabindex="-1"
          >
            <slot
              name="card"
              v-bind="slotContext"
            >
              <button
                type="button"
                data-tour-part="close"
                :aria-label="labels.close"
                @click="closeTour"
              >
                <span aria-hidden="true">×</span>
              </button>

              <slot
                name="progress"
                v-bind="slotContext"
                :labels="labels"
              >
                <p data-tour-part="progress">
                  {{ labels.progress(presentation.index + 1, controller.total.value) }}
                </p>
              </slot>
              <span
                v-if="controller.pending.value"
                data-tour-part="pending"
                role="status"
              >
                {{ labels.pending }}
              </span>
              <h2
                v-if="stepLabels.title"
                :id="titleId"
                data-tour-part="title"
                tabindex="-1"
              >
                {{ stepLabels.title }}
              </h2>
              <div :id="descriptionId">
                <TourContent :step="presentation.step" />
              </div>

              <div data-tour-part="actions">
                <slot
                  name="actions"
                  v-bind="slotContext"
                  :labels="labels"
                >
                  <button
                    v-if="presentation.index > 0"
                    data-tour-action="previous"
                    type="button"
                    :disabled="controller.pending.value"
                    @click="run(controller.previous)"
                  >
                    {{ labels.previous }}
                  </button>
                  <button
                    type="button"
                    :disabled="controller.pending.value"
                    data-tour-action="skip"
                    @click="run(controller.skip)"
                  >
                    {{ labels.skip }}
                  </button>
                  <button
                    type="button"
                    :disabled="controller.pending.value"
                    data-tour-action="next"
                    @click="run(controller.next)"
                  >
                    {{ presentation.index === controller.total.value - 1 ? labels.finish : labels.next }}
                  </button>
                </slot>
              </div>
            </slot>
          </section>
          <svg
            v-if="presentation.target && positionReady"
            ref="arrow"
            data-tour-part="arrow"
            :style="arrowStyle"
            viewBox="0 0 14 14"
            focusable="false"
            aria-hidden="true"
          >
            <path d="M0 8Q3 8 5.7 3.2Q7 1 8.3 3.2Q11 8 14 8" />
          </svg>
        </div>
      </div>
    </div>
  </Teleport>
</template>

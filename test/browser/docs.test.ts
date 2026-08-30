import { fileURLToPath } from 'node:url'
import { expect, test } from '@nuxt/test-utils/playwright'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../docs', import.meta.url)),
    setupTimeout: 240_000,
  },
})

test('the documentation is interactive, responsive, and dark-mode aware', async ({ page, goto }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await goto('/', { waitUntil: 'hydration' })
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Show people around')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  expect(await page.locator('html').evaluate(element => getComputedStyle(element).scrollBehavior)).toBe('smooth')
  await page.evaluate(() => {
    const state = window as typeof window & {
      __tourInitialCardVisibleWhileScrolling?: boolean
      __tourInitialScrollSeen?: boolean
      __tourInitialShadeMissingWhileScrolling?: boolean
      __tourInitialSpotlightSeenWhileScrolling?: boolean
      __tourInitialTargetExposedWhileScrolling?: boolean
      __tourInitialRevealMaximumOffset?: number
      __tourInitialRevealStartedClosed?: boolean
      __tourInitialStartedAt?: number
      __tourInitialRevealAt?: number
    }
    state.__tourInitialCardVisibleWhileScrolling = false
    state.__tourInitialScrollSeen = false
    state.__tourInitialShadeMissingWhileScrolling = false
    state.__tourInitialSpotlightSeenWhileScrolling = false
    state.__tourInitialTargetExposedWhileScrolling = false
    state.__tourInitialRevealMaximumOffset = 0
    state.__tourInitialRevealStartedClosed = false
    const startButton = [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent?.includes('Try the live tour'))
    startButton?.addEventListener('click', () => {
      state.__tourInitialStartedAt = performance.now()
    }, { capture: true, once: true })
    new MutationObserver((records) => {
      for (const record of records) {
        const root = record.target instanceof HTMLElement ? record.target : null
        if (root?.getAttribute('data-visual-phase') !== 'revealing') continue
        state.__tourInitialRevealAt ??= performance.now()
        const target = document.querySelector<HTMLElement>('[data-tour-target="demo-shell"]')
        const targetRect = target?.getBoundingClientRect()
        if (targetRect) {
          state.__tourInitialRevealMaximumOffset = Math.max(
            state.__tourInitialRevealMaximumOffset ?? 0,
            Math.abs(targetRect.top + targetRect.height / 2 - window.innerHeight / 2),
          )
        }
        const spotlight = root.querySelector<HTMLElement>('[data-tour-part="spotlight"]')
        const positioner = root.querySelector<HTMLElement>('[data-tour-part="positioner"]')
        const spotlightCover = spotlight
          ? Number.parseFloat(getComputedStyle(spotlight, '::after').opacity)
          : 0
        const cardOpacity = positioner
          ? Number.parseFloat(getComputedStyle(positioner).opacity)
          : 1
        state.__tourInitialRevealStartedClosed = spotlightCover >= 0.95 && cardOpacity <= 0.05
      }
    }).observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-visual-phase'],
    })
    let previousScrollY = window.scrollY
    document.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY
      if (Math.abs(currentScrollY - previousScrollY) <= 0.5) return
      previousScrollY = currentScrollY
      state.__tourInitialScrollSeen = true
      const root = document.querySelector<HTMLElement>('[data-tour-part="root"]')
      const overlay = document.querySelector<HTMLElement>('[data-tour-part="overlay"]')
      const spotlight = document.querySelector<HTMLElement>('[data-tour-part="spotlight"]')
      const card = document.querySelector<HTMLElement>('[data-tour-part="positioner"]')
      const overlayCovers = overlay
        && Number.parseFloat(getComputedStyle(overlay).opacity) >= 0.95
        && getComputedStyle(overlay).backgroundColor !== 'rgba(0, 0, 0, 0)'
      const spotlightCovers = spotlight
        && getComputedStyle(spotlight).visibility !== 'hidden'
        && getComputedStyle(spotlight).boxShadow !== 'none'
      if (spotlightCovers) state.__tourInitialSpotlightSeenWhileScrolling = true
      if (!overlayCovers && spotlight && Number.parseFloat(getComputedStyle(spotlight, '::after').opacity) < 0.95) {
        state.__tourInitialTargetExposedWhileScrolling = true
        const target = document.querySelector<HTMLElement>('[data-tour-target="demo-shell"]')
        const rect = target?.getBoundingClientRect()
        const offset = rect ? Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2) : Number.POSITIVE_INFINITY
        state.__tourInitialRevealMaximumOffset = Math.max(state.__tourInitialRevealMaximumOffset ?? 0, offset)
      }
      if (!root || (!overlayCovers && !spotlightCovers)) {
        state.__tourInitialShadeMissingWhileScrolling = true
      }
      if (card && Number.parseFloat(getComputedStyle(card).opacity) > 0.05) {
        state.__tourInitialCardVisibleWhileScrolling = true
      }
    }, { capture: true })
  })
  await page.getByRole('button', { name: 'Try the live tour' }).click()

  const root = page.locator('[data-tour-part="root"]')
  await expect(root).toHaveAttribute('data-tour-step-id', 'workspace')
  const positioner = page.locator('[data-tour-part="positioner"]')
  await expect(positioner).toHaveAttribute('data-positioned', '')
  await expect(root).toHaveAttribute('data-visual-phase', 'active')
  expect(await page.evaluate(() => {
    const state = window as typeof window & {
      __tourInitialCardVisibleWhileScrolling?: boolean
      __tourInitialScrollSeen?: boolean
      __tourInitialShadeMissingWhileScrolling?: boolean
      __tourInitialSpotlightSeenWhileScrolling?: boolean
      __tourInitialTargetExposedWhileScrolling?: boolean
      __tourInitialRevealMaximumOffset?: number
      __tourInitialRevealStartedClosed?: boolean
      __tourInitialStartedAt?: number
      __tourInitialRevealAt?: number
    }
    return {
      cardVisible: state.__tourInitialCardVisibleWhileScrolling,
      scrollSeen: state.__tourInitialScrollSeen,
      shadeMissing: state.__tourInitialShadeMissingWhileScrolling,
      spotlightSeen: state.__tourInitialSpotlightSeenWhileScrolling,
      targetExposed: state.__tourInitialTargetExposedWhileScrolling,
      revealMaximumOffset: state.__tourInitialRevealMaximumOffset,
      revealStartedClosed: state.__tourInitialRevealStartedClosed,
      revealLatency: state.__tourInitialStartedAt !== undefined && state.__tourInitialRevealAt !== undefined
        ? state.__tourInitialRevealAt - state.__tourInitialStartedAt
        : undefined,
    }
  })).toMatchObject({
    scrollSeen: true,
    shadeMissing: false,
    spotlightSeen: true,
    revealMaximumOffset: expect.any(Number),
    revealStartedClosed: true,
    revealLatency: expect.any(Number),
  })
  expect(await page.evaluate(() => {
    const state = window as typeof window & {
      __tourInitialStartedAt?: number
      __tourInitialRevealAt?: number
    }
    if (state.__tourInitialStartedAt === undefined || state.__tourInitialRevealAt === undefined) return Infinity
    return state.__tourInitialRevealAt - state.__tourInitialStartedAt
  })).toBeLessThan(375)
  expect(await page.evaluate(() => (
    (window as typeof window & { __tourInitialRevealMaximumOffset?: number }).__tourInitialRevealMaximumOffset ?? Infinity
  ))).toBeLessThanOrEqual(220)
  const targetCenterOffset = await page.locator('[data-tour-target="demo-shell"]').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2)
  })
  expect(targetCenterOffset).toBeLessThan(80)
  const anchoredScrollPosition = await page.evaluate(() => window.scrollY)
  await page.evaluate(() => {
    const state = window as typeof window & {
      __tourCardHeightMaximum?: number
      __tourCardHeightMinimum?: number
      __tourPendingMaximumArea?: number
      __tourRestartMinimumOpacity?: number
    }
    const card = document.querySelector<HTMLElement>('[data-tour-part="card"]')
    const restart = [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent?.includes('Restart live tour'))
    const sample = () => {
      const cardHeight = card?.getBoundingClientRect().height ?? 0
      const positionerOpacity = card?.parentElement
        ? Number.parseFloat(getComputedStyle(card.parentElement).opacity)
        : 0
      const positionerVisibility = card?.parentElement
        ? getComputedStyle(card.parentElement).visibility
        : 'hidden'
      if (positionerOpacity > 0.05 && positionerVisibility !== 'hidden') {
        state.__tourCardHeightMinimum = Math.min(state.__tourCardHeightMinimum ?? cardHeight, cardHeight)
        state.__tourCardHeightMaximum = Math.max(state.__tourCardHeightMaximum ?? cardHeight, cardHeight)
      }
      const pendingRect = document.querySelector<HTMLElement>('[data-tour-part="pending"]')
        ?.getBoundingClientRect()
      state.__tourPendingMaximumArea = Math.max(
        state.__tourPendingMaximumArea ?? 0,
        pendingRect ? pendingRect.width * pendingRect.height : 0,
      )
      state.__tourRestartMinimumOpacity = Math.min(
        state.__tourRestartMinimumOpacity ?? 1,
        restart ? Number.parseFloat(getComputedStyle(restart).opacity) : 1,
      )
    }
    sample()
    if (card) new ResizeObserver(sample).observe(card)
    new MutationObserver(sample).observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['disabled', 'data-tour-step-id', 'data-visual-phase'],
    })
  })
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(root).toHaveAttribute('data-tour-step-id', 'interaction')
  await expect(root).toHaveAttribute('data-visual-phase', 'active')
  expect(Math.abs(await page.evaluate(() => window.scrollY) - anchoredScrollPosition)).toBeLessThan(2)
  const transitionStability = await page.evaluate(() => {
    const state = window as typeof window & {
      __tourCardHeightMaximum?: number
      __tourCardHeightMinimum?: number
      __tourPendingMaximumArea?: number
      __tourRestartMinimumOpacity?: number
    }
    return {
      cardHeightDelta: (state.__tourCardHeightMaximum ?? 0) - (state.__tourCardHeightMinimum ?? 0),
      pendingMaximumArea: state.__tourPendingMaximumArea,
      restartMinimumOpacity: state.__tourRestartMinimumOpacity,
    }
  })
  expect(transitionStability.cardHeightDelta).toBeLessThan(0.5)
  expect(transitionStability).toMatchObject({
    pendingMaximumArea: 1,
    restartMinimumOpacity: 1,
  })

  const activeFilter = page.getByRole('button', { name: 'Active' })
  // Use the product interaction directly. Playwright's actionability helper
  // may scroll a partially covered target before clicking it, which would test
  // Playwright's helper instead of the tour's `scroll: false` contract.
  await activeFilter.evaluate(button => (button as HTMLButtonElement).click())
  await expect(activeFilter).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Next' }).click()
  await expect(root).toHaveAttribute('data-tour-step-id', 'api')
  await expect(root).toHaveAttribute('data-visual-phase', 'active')
  expect(Math.abs(await page.evaluate(() => window.scrollY) - anchoredScrollPosition)).toBeLessThan(2)
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(root).toHaveAttribute('data-tour-step-id', 'action')
  await expect(root).toHaveAttribute('data-visual-phase', 'active')
  expect(Math.abs(await page.evaluate(() => window.scrollY) - anchoredScrollPosition)).toBeLessThan(2)
  await page.evaluate(() => {
    const root = document.documentElement
    const previousBehavior = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    window.scrollBy(0, window.innerHeight)
    root.style.scrollBehavior = previousBehavior
  })
  await expect(page.locator('[data-tour-part="overlay"]')).toHaveAttribute('data-centered', '')
  expect(await page.locator('[data-tour-part="overlay"]').evaluate(element => (
    getComputedStyle(element).backgroundColor
  ))).not.toBe('rgba(0, 0, 0, 0)')
  await page.evaluate((scrollY) => {
    const root = document.documentElement
    const previousBehavior = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    window.scrollTo(0, scrollY)
    root.style.scrollBehavior = previousBehavior
  }, anchoredScrollPosition)
  await expect(page.locator('[data-tour-part="spotlight"]')).toBeVisible()
  await page.evaluate(() => {
    const state = window as typeof window & {
      __tourCardVisibleWhileRelocating?: boolean
      __tourBackdropMissingWhileRelocating?: boolean
      __tourDestinationSpotlightSeenWhileRelocating?: boolean
      __tourDestinationExposedWhileRelocating?: boolean
      __tourRelocationStarted?: boolean
      __tourDestinationRevealMaximumOffset?: number
      __tourGeometrySwappedBeforeCovered?: boolean
    }
    state.__tourCardVisibleWhileRelocating = false
    state.__tourBackdropMissingWhileRelocating = false
    state.__tourDestinationSpotlightSeenWhileRelocating = false
    state.__tourDestinationExposedWhileRelocating = false
    state.__tourRelocationStarted = false
    state.__tourDestinationRevealMaximumOffset = 0
    state.__tourGeometrySwappedBeforeCovered = false
    const root = document.querySelector<HTMLElement>('[data-tour-part="root"]')
    const initialSpotlight = document.querySelector<HTMLElement>('[data-tour-part="spotlight"]')
      ?.getBoundingClientRect()
    if (root) {
      new MutationObserver(() => {
        if (root.hasAttribute('data-relocating')) state.__tourRelocationStarted = true
      }).observe(root, { attributes: true, attributeFilter: ['data-relocating'] })
    }
    let previousScrollY = window.scrollY
    document.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY
      const pageMoved = Math.abs(currentScrollY - previousScrollY) > 0.5
      previousScrollY = currentScrollY
      if (!state.__tourRelocationStarted || !pageMoved) return
      const positioner = document.querySelector<HTMLElement>('[data-tour-part="positioner"]')
      const overlay = document.querySelector<HTMLElement>('[data-tour-part="overlay"]')
      const spotlight = document.querySelector<HTMLElement>('[data-tour-part="spotlight"]')
      if (positioner && Number.parseFloat(getComputedStyle(positioner).opacity) > 0.05) {
        state.__tourCardVisibleWhileRelocating = true
      }
      const overlayCovers = overlay
        && getComputedStyle(overlay).backgroundColor !== 'rgba(0, 0, 0, 0)'
      const spotlightCovers = spotlight
        && getComputedStyle(spotlight).visibility !== 'hidden'
        && getComputedStyle(spotlight).boxShadow !== 'none'
      const spotlightRect = spotlight?.getBoundingClientRect()
      const geometrySwapped = initialSpotlight && spotlightRect
        && (Math.abs(spotlightRect.width - initialSpotlight.width) > 10
          || Math.abs(spotlightRect.height - initialSpotlight.height) > 10)
      const coverOpacity = spotlight
        ? Number.parseFloat(getComputedStyle(spotlight, '::after').opacity)
        : 0
      if (root?.getAttribute('data-visual-phase') === 'moving' && geometrySwapped && coverOpacity < 0.95) {
        state.__tourGeometrySwappedBeforeCovered = true
      }
      if (spotlightCovers) state.__tourDestinationSpotlightSeenWhileRelocating = true
      if (geometrySwapped && !overlayCovers && spotlight && coverOpacity < 0.95) {
        state.__tourDestinationExposedWhileRelocating = true
        const target = document.querySelector<HTMLElement>('[data-tour-target="demo-recipes"]')
        const rect = target?.getBoundingClientRect()
        const offset = rect ? Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2) : Number.POSITIVE_INFINITY
        state.__tourDestinationRevealMaximumOffset = Math.max(state.__tourDestinationRevealMaximumOffset ?? 0, offset)
      }
      if (!overlayCovers && !spotlightCovers) {
        state.__tourBackdropMissingWhileRelocating = true
      }
    }, { capture: true })
  })
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(root).toHaveAttribute('data-tour-step-id', 'recipes')
  await expect(root).toHaveAttribute('data-visual-phase', 'active')
  expect(await page.evaluate(() => {
    const state = window as typeof window & {
      __tourCardVisibleWhileRelocating?: boolean
      __tourBackdropMissingWhileRelocating?: boolean
      __tourDestinationSpotlightSeenWhileRelocating?: boolean
      __tourDestinationExposedWhileRelocating?: boolean
      __tourRelocationStarted?: boolean
      __tourDestinationRevealMaximumOffset?: number
      __tourGeometrySwappedBeforeCovered?: boolean
    }
    return {
      started: state.__tourRelocationStarted,
      cardVisible: state.__tourCardVisibleWhileRelocating,
      backdropMissing: state.__tourBackdropMissingWhileRelocating,
      spotlightSeen: state.__tourDestinationSpotlightSeenWhileRelocating,
      targetExposed: state.__tourDestinationExposedWhileRelocating,
      revealMaximumOffset: state.__tourDestinationRevealMaximumOffset,
      geometrySwappedBeforeCovered: state.__tourGeometrySwappedBeforeCovered,
    }
  })).toMatchObject({
    started: true,
    backdropMissing: false,
    spotlightSeen: true,
    targetExposed: true,
    revealMaximumOffset: expect.any(Number),
    geometrySwappedBeforeCovered: false,
  })
  expect(await page.evaluate(() => (
    (window as typeof window & { __tourDestinationRevealMaximumOffset?: number }).__tourDestinationRevealMaximumOffset ?? Infinity
  ))).toBeLessThanOrEqual(220)
  const recipesCenterOffset = await page.locator('[data-tour-target="demo-recipes"]').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2)
  })
  expect(recipesCenterOffset).toBeLessThan(80)
  await page.getByRole('button', { name: 'Previous' }).click()
  await expect(root).toHaveAttribute('data-tour-step-id', 'action')
  await expect(root).toHaveAttribute('data-visual-phase', 'active')
  expect(Math.abs(await page.evaluate(() => window.scrollY) - anchoredScrollPosition)).toBeLessThan(2)
  const shellCenterOffsetAfterPrevious = await page.locator('[data-tour-target="demo-shell"]').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2)
  })
  expect(shellCenterOffsetAfterPrevious).toBeLessThan(80)
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(root).toHaveAttribute('data-tour-step-id', 'recipes')
  await page.getByRole('button', { name: 'Finish' }).click()

  await page.setViewportSize({ width: 320, height: 700 })
  await page.getByRole('button', { name: 'Start live tour' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(root).toHaveAttribute('data-tour-step-id', 'interaction')
  await expect(page.locator('[data-tour-part="card"]')).toBeInViewport()
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(horizontalOverflow).toBe(false)
  await page.getByRole('button', { name: 'Close tour' }).click()
  await page.evaluate(() => {
    document.documentElement.classList.remove('light')
    document.documentElement.classList.add('dark')
  })
  await page.getByRole('button', { name: 'Start live tour' }).click()

  const card = page.locator('[data-tour-part="card"]')
  await expect(card).toBeVisible()
  expect(await card.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(24, 24, 27)')
  await expect(page.locator('html')).toHaveClass(/dark/u)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.locator('html').evaluate(element => getComputedStyle(element).scrollBehavior)).toBe('auto')
  expect(errors).toEqual([])
})

test('the recipe lab runs rich content, live controls, refs, and centered steps', async ({ page, goto }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })

  await goto('/docs/recipes', { waitUntil: 'hydration' })
  await expect(page.getByRole('heading', { level: 1, name: 'Interactive recipes' }).first()).toBeVisible()
  await expect(page.getByText('Actual Nuxt Tour runtime')).toBeVisible()

  const runRecipe = page.getByRole('button', { name: 'Run recipe' })
  await page.evaluate(() => {
    const root = document.documentElement
    const previousBehavior = root.style.scrollBehavior
    root.style.scrollBehavior = 'auto'
    window.scrollTo(0, 0)
    root.style.scrollBehavior = previousBehavior
    const state = window as typeof window & {
      __tourShadeMissingWhileScrolling?: boolean
      __tourVisibleWhileScrolling?: boolean
    }
    state.__tourVisibleWhileScrolling = false
    state.__tourShadeMissingWhileScrolling = false
    document.addEventListener('scroll', () => {
      const root = document.querySelector('[data-tour-part="root"]')
      if (!root) return
      state.__tourVisibleWhileScrolling = true
      const overlay = document.querySelector<HTMLElement>('[data-tour-part="overlay"]')
      const spotlight = document.querySelector<HTMLElement>('[data-tour-part="spotlight"]')
      const overlayCovers = overlay
        && Number.parseFloat(getComputedStyle(overlay).opacity) >= 0.95
        && getComputedStyle(overlay).backgroundColor !== 'rgba(0, 0, 0, 0)'
      const spotlightCovers = spotlight
        && getComputedStyle(spotlight).visibility !== 'hidden'
        && getComputedStyle(spotlight).boxShadow !== 'none'
      if (!overlayCovers && !spotlightCovers) {
        state.__tourShadeMissingWhileScrolling = true
      }
    }, { capture: true })
  })
  await runRecipe.evaluate(button => (button as HTMLButtonElement).click())
  const root = page.locator('[data-tour-part="root"]')
  await expect(root).toHaveAttribute('data-tour-id', 'recipe-media')
  expect(await page.evaluate(() => {
    const state = window as typeof window & {
      __tourShadeMissingWhileScrolling?: boolean
      __tourVisibleWhileScrolling?: boolean
    }
    return {
      shadeMissing: state.__tourShadeMissingWhileScrolling,
      visible: state.__tourVisibleWhileScrolling,
    }
  })).toEqual({ shadeMissing: false, visible: true })
  await expect(page.locator('[data-tour-part="card"] img')).toHaveAttribute('src', '/recipes/habitat-overview.svg')
  await page.getByRole('button', { name: 'Finish' }).click()

  await page.getByRole('button', { name: /Live controls/u }).click()
  await page.getByRole('button', { name: 'Run recipe' }).click()
  await expect(root).toHaveAttribute('data-tour-id', 'recipe-interaction')
  await page.getByRole('button', { name: 'At risk' }).click()
  await expect(page.getByText('3 projects need attention')).toBeVisible()
  await page.getByRole('button', { name: 'Close tour' }).click()

  await page.getByRole('button', { name: /Vue refs/u }).click()
  await page.getByRole('button', { name: 'Run recipe' }).click()
  await expect(root).toHaveAttribute('data-tour-id', 'recipe-programmatic')
  await expect(page.locator('[data-tour-part="spotlight"]')).toBeVisible()
  await page.getByRole('button', { name: 'Close tour' }).click()

  await page.setViewportSize({ width: 320, height: 700 })
  await page.getByRole('button', { name: /Announcements/u }).click()
  await page.getByRole('button', { name: 'Run recipe' }).click()
  await expect(root).toHaveAttribute('data-tour-id', 'recipe-centered')
  await expect(page.locator('[data-tour-part="overlay"]')).toHaveAttribute('data-centered', '')
  await expect(page.locator('[data-tour-part="card"]')).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)

  expect(errors).toEqual([])
})

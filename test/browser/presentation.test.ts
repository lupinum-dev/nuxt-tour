import { expect, test } from '@nuxt/test-utils/playwright'

test('moves one opening continuously and gates target access until aligned', async ({ page, goto }) => {
  await goto('/motion', { waitUntil: 'hydration' })
  await page.getByTestId('start-motion').focus()
  await page.getByTestId('start-motion').press('Enter')
  const root = page.locator('[data-tour-part="root"]')
  await expect(root).toHaveAttribute('data-visual-phase', 'active')
  await expect.poll(() => page.locator('[data-tour-part="spotlight"]').evaluate(element => Number.parseFloat(getComputedStyle(element, '::after').opacity))).toBe(0)
  await page.evaluate(() => {
    const opening = document.querySelector('[data-tour-part="spotlight"]')!
    const initial = opening.getBoundingClientRect()
    const samples: { x: number, width: number, cover: number, same: boolean, blocked: boolean }[] = []
    const state = window as typeof window & { motionSamples?: typeof samples }
    state.motionSamples = samples
    const started = performance.now()
    const sample = () => {
      const element = document.querySelector('[data-tour-part="spotlight"]')!
      const rect = element.getBoundingClientRect()
      const target = document.querySelector('[data-tour-target="motion-second"]')!
      const destination = target.getBoundingClientRect()
      samples.push({ x: rect.x - initial.x, width: rect.width, cover: Number.parseFloat(getComputedStyle(element, '::after').opacity), same: element === opening, blocked: !target.contains(document.elementFromPoint(destination.x + 10, destination.y + 10)) })
      if (performance.now() - started < 400) requestAnimationFrame(sample)
    }
    document.querySelector<HTMLButtonElement>('[data-tour-part="actions"] button:last-child')!.click()
    requestAnimationFrame(sample)
  })
  await expect(root).toHaveAttribute('data-tour-step-id', 'second')
  await expect(root).toHaveAttribute('data-visual-phase', 'active')
  const samples = await page.evaluate(() => (window as typeof window & {
    motionSamples: { x: number, width: number, cover: number, same: boolean, blocked: boolean }[]
  }).motionSamples)
  const intermediate = samples.filter(sample => sample.width > 98 && sample.width < 134)
  expect(intermediate.length).toBeGreaterThan(1)
  expect(intermediate.filter(sample => sample.cover >= 0.05 || !sample.same || !sample.blocked)).toEqual([])
  const opening = await page.locator('[data-tour-part="spotlight"]').boundingBox()
  const target = await page.locator('[data-tour-target="motion-second"]').boundingBox()
  expect(Math.abs(opening!.x - (target!.x - 8))).toBeLessThan(1)
  await page.locator('[data-tour-target="motion-second"]').click()
  await expect(page.locator('output')).toHaveText('1')
  await page.keyboard.press('Escape')
  await expect(root).toHaveCount(0)
  await expect(page.getByTestId('start-motion')).toBeFocused()
})

test('keeps slow preparation cancellable before the first card exists', async ({ page, goto }) => {
  await goto('/motion', { waitUntil: 'hydration' })
  await page.getByTestId('start-slow').focus()
  await page.getByTestId('start-slow').press('Enter')
  const loading = page.locator('[data-tour-part="loading"]')
  await expect(loading).toBeVisible()
  await expect(loading).toContainText('Loading next step')
  await loading.getByRole('button', { name: 'Close tour' }).click()
  await expect(page.locator('[data-tour-part="root"]')).toHaveCount(0)
  await expect(page.getByTestId('start-slow')).toBeFocused()
  await page.getByTestId('start-slow').focus()
  await page.getByTestId('start-slow').press('Enter')
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-tour-part="root"]')).toHaveCount(0)
})

test('reduced motion reaches the destination without spatial travel', async ({ page, goto }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await goto('/motion', { waitUntil: 'hydration' })
  await page.getByTestId('start-motion').focus()
  await page.getByTestId('start-motion').press('Enter')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  const root = page.locator('[data-tour-part="root"]')
  await expect(root).toHaveAttribute('data-tour-step-id', 'second')
  await expect(root).toHaveAttribute('data-visual-phase', 'active')
  const opening = await page.locator('[data-tour-part="spotlight"]').boundingBox()
  const target = await page.locator('[data-tour-target="motion-second"]').boundingBox()
  expect(Math.abs(opening!.width - target!.width - 16)).toBeLessThan(1)
})

test('keeps a centered card inside a narrow RTL viewport as content grows', async ({ page, goto }) => {
  await page.setViewportSize({ width: 320, height: 500 })
  await goto('/', { waitUntil: 'hydration' })
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl'
  })
  await page.getByTestId('start').focus()
  await page.getByTestId('start').press('Enter')
  const card = page.locator('[data-tour-part="card"]')
  await expect(card).toBeVisible()
  await page.locator('[data-tour-part="content"]').evaluate((element) => {
    const text = document.createElement('p')
    text.textContent = 'Eine ausführliche Anleitung mit zusätzlichen Informationen. '.repeat(50)
    element.append(text)
  })
  // A smaller visual area also exercises the layout used when browser chrome
  // or an on-screen keyboard leaves less room. This is not a physical phone test.
  await page.setViewportSize({ width: 320, height: 350 })
  await expect.poll(async () => {
    const rect = await card.boundingBox()
    return Boolean(rect && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 320 && rect.y + rect.height <= 350)
  }).toBe(true)
  expect(await card.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.locator('[data-tour-part="root"]')).toHaveAttribute('data-tour-step-id', 'query')
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-tour-part="root"]')).toHaveCount(0)
})

// These probe the previously observed failures, not just the settled result.
test('isolates the page before slow preparation can show a card', async ({ page, goto }) => {
  await goto('/motion', { waitUntil: 'hydration' })
  const early = await page.evaluate(async () => {
    document.querySelector<HTMLButtonElement>('[data-testid="start-slow"]')!.click()
    await new Promise(requestAnimationFrame)
    const button = document.querySelector('[data-testid="unrelated"]')!
    const rect = button.getBoundingClientRect()
    const blocker = document.querySelector('[data-tour-part="blocker"]')!.getBoundingClientRect()
    return { blocked: !button.contains(document.elementFromPoint(rect.x + 5, rect.y + 5)), width: blocker.width, height: blocker.height, viewport: [innerWidth, innerHeight] }
  })
  expect(early.blocked).toBe(true)
  expect([early.width, early.height]).toEqual(early.viewport)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-tour-part="root"]')).toHaveCount(0)
})

test('keeps the arrow attached and ignores unrelated paused animations', async ({ page, goto }) => {
  await goto('/motion', { waitUntil: 'hydration' })
  await page.getByTestId('start-motion').click()
  const root = page.locator('[data-tour-part="root"]')
  await expect(root).toHaveAttribute('data-visual-phase', 'active')
  const samples = await page.evaluate(async () => {
    const animation = document.querySelector('[data-tour-part="spotlight"]')!.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 1000 })
    animation.pause()
    const gaps: number[] = []
    const started = performance.now()
    document.querySelector<HTMLButtonElement>('[data-tour-action="next"]')!.click()
    await new Promise<void>((resolve) => {
      const sample = () => {
        const positioner = document.querySelector<HTMLElement>('[data-tour-part="positioner"]')!
        const card = positioner.querySelector('[data-tour-part="card"]')!.getBoundingClientRect()
        const arrow = positioner.querySelector('[data-tour-part="arrow"]')?.getBoundingClientRect()
        const side = positioner.dataset.placement?.split('-')[0]
        if (arrow && Number(getComputedStyle(positioner).opacity) > 0.1 && (side === 'top' || side === 'bottom')) {
          gaps.push(side === 'top' ? arrow.top - card.bottom : card.top - arrow.bottom)
        }
        if (performance.now() - started < 500) requestAnimationFrame(sample)
        else resolve()
      }
      requestAnimationFrame(sample)
    })
    animation.cancel()
    return gaps
  })
  await expect(root).toHaveAttribute('data-tour-step-id', 'second')
  await expect(root).toHaveAttribute('data-visual-phase', 'active')
  expect(samples.length).toBeGreaterThan(3)
  expect(samples.every(gap => Math.abs(gap + 7) < 1)).toBe(true)
})

test('Escape stops the native scroll as well as closing the tour', async ({ page, goto }) => {
  await goto('/scrolling', { waitUntil: 'hydration' })
  await page.getByTestId('start-scroll').click()
  await expect(page.locator('[data-tour-part="root"]')).toHaveAttribute('data-visual-phase', 'active')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(20)
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-tour-part="root"]')).toHaveCount(0)
  const movement = await page.evaluate(async () => {
    const positions: number[] = []
    const started = performance.now()
    await new Promise<void>((resolve) => {
      const sample = () => {
        positions.push(scrollY)
        if (performance.now() - started < 350) requestAnimationFrame(sample)
        else resolve()
      }
      requestAnimationFrame(sample)
    })
    return Math.max(...positions) - Math.min(...positions)
  })
  expect(movement).toBeLessThan(2)
})

test('updates clear spacing between steps that share the same target', async ({ page, goto }) => {
  await goto('/motion', { waitUntil: 'hydration' })
  await page.getByTestId('start-motion').click()
  const root = page.locator('[data-tour-part="root"]')
  await expect(root).toHaveAttribute('data-visual-phase', 'active')
  for (const step of ['second', 'third']) {
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(root).toHaveAttribute('data-tour-step-id', step)
    await expect(root).toHaveAttribute('data-visual-phase', 'active')
  }
  const gap = () => page.evaluate(() => {
    const target = document.querySelector('[data-tour-target="motion-first"]')!.getBoundingClientRect()
    const positioner = document.querySelector<HTMLElement>('[data-tour-part="positioner"]')!
    const card = positioner.getBoundingClientRect()
    return positioner.dataset.placement?.startsWith('top') ? target.top - card.bottom : card.top - target.bottom
  })
  expect(await gap()).toBeCloseTo(27, 0)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(root).toHaveAttribute('data-tour-step-id', 'fourth')
  await expect(root).toHaveAttribute('data-visual-phase', 'active')
  expect(await gap()).toBeCloseTo(51, 0)
})

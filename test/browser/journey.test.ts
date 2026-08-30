import { expect, test } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'

interface ShadeProbe {
  gaps: number
  samples: number
  stopped: boolean
}

async function startShadeProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const probe: ShadeProbe = { gaps: 0, samples: 0, stopped: false }
    ;(window as typeof window & { __tourShadeProbe?: ShadeProbe }).__tourShadeProbe = probe

    const sample = () => {
      if (probe.stopped) return
      const root = document.querySelector<HTMLElement>('[data-tour-part="root"]')
      const overlay = document.querySelector<HTMLElement>('[data-tour-part="overlay"]')
      const spotlight = document.querySelector<HTMLElement>('[data-tour-part="spotlight"]')
      const overlayColor = overlay ? getComputedStyle(overlay).backgroundColor : 'rgba(0, 0, 0, 0)'
      const overlayIsShaded = !overlayColor.endsWith(', 0)') && overlayColor !== 'transparent'
      const spotlightIsShaded = spotlight ? getComputedStyle(spotlight).boxShadow !== 'none' : false
      probe.samples += 1
      if (!root || (!overlayIsShaded && !spotlightIsShaded)) probe.gaps += 1
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
}

async function stopShadeProbe(page: Page): Promise<ShadeProbe> {
  return page.evaluate(() => {
    const probe = (window as typeof window & { __tourShadeProbe?: ShadeProbe }).__tourShadeProbe
    if (!probe) throw new Error('Shade probe was not started.')
    probe.stopped = true
    return probe
  })
}

test('keeps one continuous overlay across query, Suspense, and page transitions', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await page.getByTestId('start').click()

  const root = page.locator('[data-tour-part="root"]')
  const overlay = page.locator('[data-tour-part="overlay"]')
  await expect(root).toHaveAttribute('data-tour-step-id', 'welcome')
  const rootHandle = await root.elementHandle()
  const overlayHandle = await overlay.elementHandle()
  await startShadeProbe(page)

  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL(/\?panel=open$/)
  await expect(root).toHaveAttribute('data-tour-step-id', 'query')
  await expect(page.getByTestId('query-target')).toBeVisible()
  await page.getByTestId('query-target').click()
  await expect(page.getByTestId('target-replacements')).toHaveText('1')
  await expect(page.getByTestId('query-target')).toBeVisible()
  await expect(root).toHaveAttribute('data-tour-step-id', 'query')

  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL(/\/projects\/42$/)
  await expect(root).toHaveAttribute('data-tour-step-id', 'project')
  await expect(page.getByTestId('project-target')).toBeVisible()

  expect(await rootHandle?.evaluate(element => element.isConnected)).toBe(true)
  expect(await overlayHandle?.evaluate(element => element.isConnected)).toBe(true)
  const shadeProbe = await stopShadeProbe(page)
  expect(shadeProbe.samples).toBeGreaterThan(0)
  expect(shadeProbe.gaps).toBe(0)
})

test('traps modal focus, supports Escape, and restores the synchronous trigger', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const start = page.getByTestId('start')
  await start.focus()
  await start.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Welcome' })
  await expect(dialog).toBeVisible()
  const nuxtRoot = page.locator('body > #__nuxt')
  await expect(nuxtRoot).toHaveAttribute('inert')
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeFocused()
  await page.getByTestId('open-popup').click()
  await expect(page.getByTestId('nested-popup')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('nested-popup')).toHaveCount(0)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(dialog).toBeHidden()
  await expect(start).toBeFocused()
  await expect(nuxtRoot).not.toHaveAttribute('inert', '')
})

test('cancels when the host disappears or external navigation wins', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await page.getByTestId('start').click()
  await expect(page.locator('[data-tour-part="root"]')).toBeVisible()

  await page.evaluate(() => {
    const removeHost = (window as typeof window & { __removeTourHost?: () => void }).__removeTourHost
    if (!removeHost) throw new Error('Host removal control is unavailable.')
    removeHost()
  })
  await expect(page.locator('[data-tour-part="root"]')).toHaveCount(0)

  await goto('/', { waitUntil: 'hydration' })
  await page.getByTestId('start').click()
  await page.evaluate(() => {
    const navigate = (window as typeof window & { __navigateExternal?: () => void }).__navigateExternal
    if (!navigate) throw new Error('External navigation control is unavailable.')
    navigate()
  })
  await expect(page).toHaveURL(/\/external$/)
  await expect(page.locator('[data-tour-part="root"]')).toHaveCount(0)
})

test('honors reduced motion and class-based dark mode', async ({ page, goto }) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await goto('/', { waitUntil: 'hydration' })
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.getByTestId('start').click()

  const card = page.locator('[data-tour-part="card"]')
  await expect(card).toBeVisible()
  const styles = await card.evaluate((element) => {
    const style = getComputedStyle(element)
    return { animationName: style.animationName, backgroundColor: style.backgroundColor }
  })
  expect(styles.animationName).toBe('none')
  expect(styles.backgroundColor).toBe('rgb(24, 24, 27)')
})

test('cancels the tour when browser Back leaves its destination', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await page.getByTestId('start').click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page).toHaveURL(/\/projects\/42$/)

  await page.goBack()
  await expect(page.locator('[data-tour-part="root"]')).toHaveCount(0)
})

test('deduplicates rapid navigation commands and keeps target-mode focus scoped', async ({ browserName, page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await page.getByTestId('start').click()
  await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled()

  await page.evaluate(() => {
    const next = document.querySelector<HTMLButtonElement>('[data-tour-part="actions"] button:last-child')
    next?.click()
    next?.click()
  })

  const root = page.locator('[data-tour-part="root"]')
  await expect(root).toHaveAttribute('data-tour-step-id', 'query')
  await expect(page).toHaveURL(/\?panel=open$/)
  const card = page.locator('[data-tour-part="card"]')
  await expect(card).not.toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('heading', { name: 'Query route' })).toBeFocused()

  if (browserName === 'webkit') {
    // WebKit follows Safari's system setting that can exclude controls from Tab order.
    // Programmatic focus still proves that the target belongs to the permitted scope.
    await page.getByTestId('query-target').focus()
    await expect(page.getByTestId('query-target')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('start')).not.toBeFocused()
  }
  else {
    const visited: string[] = []
    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press('Tab')
      visited.push(await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null
        return active?.dataset.testid ?? active?.dataset.tourPart ?? active?.tagName ?? ''
      }))
    }
    expect(visited).toContain('query-target')
    expect(visited).not.toContain('start')
  }
})

test('leaves the application operable in page interaction mode', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await page.getByTestId('start').click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()

  const root = page.locator('[data-tour-part="root"]')
  await expect(root).toHaveAttribute('data-tour-step-id', 'project')
  await expect(page.locator('body > #__nuxt')).not.toHaveAttribute('inert', '')
  await page.getByTestId('project-target').click()
  await expect(page.getByTestId('project-clicks')).toHaveText('1')
  await page.keyboard.press('Escape')
  await expect(root).toHaveCount(0)
})

test('keeps essential boundaries visible in forced-colors mode', async ({ browserName, page, goto }) => {
  test.skip(browserName !== 'chromium', 'Playwright only emulates forced colors in Chromium.')
  await page.emulateMedia({ forcedColors: 'active' })
  await goto('/', { waitUntil: 'hydration' })
  await page.getByTestId('start').click()

  const card = page.locator('[data-tour-part="card"]')
  await expect(card).toBeVisible()
  expect(await card.evaluate(element => getComputedStyle(element).borderWidth)).toBe('2px')
})

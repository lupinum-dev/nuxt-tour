import { fileURLToPath } from 'node:url'
import { expect, test } from '@nuxt/test-utils/playwright'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../fixtures/browser', import.meta.url)),
    nuxtConfig: { nuxtTour: { motion: 'none' } },
  },
})

test('disables all tour motion and smooth scrolling through the Nuxt option', async ({ page, goto }) => {
  await goto('/scrolling', { waitUntil: 'hydration' })
  await page.getByTestId('start-scroll').click()
  const root = page.locator('[data-tour-part="root"]')
  await expect(root).toHaveAttribute('data-motion', 'none')
  await expect(root).toHaveAttribute('data-visual-phase', 'active')
  const scrolling = await page.evaluate(async () => {
    const calls: ScrollIntoViewOptions[] = []
    const target = document.querySelector('[data-tour-target="scroll-end"]')!
    const native = target.scrollIntoView.bind(target)
    target.scrollIntoView = (options) => {
      if (typeof options === 'object') calls.push(options)
      native(options)
    }
    document.querySelector<HTMLButtonElement>('[data-tour-action="next"]')!.click()
    await new Promise(requestAnimationFrame)
    return calls
  })
  await expect(root).toHaveAttribute('data-tour-step-id', 'end')
  await expect(root).toHaveAttribute('data-visual-phase', 'active')
  expect(scrolling).toContainEqual(expect.objectContaining({ behavior: 'instant' }))
  const motion = await page.locator('[data-tour-part="surface"]').evaluate(element => ({
    transform: getComputedStyle(element).transform,
    transition: getComputedStyle(element).transitionDuration,
    animations: element.getAnimations().length,
  }))
  expect(motion).toEqual({ transform: 'none', transition: '0s', animations: 0 })
  await page.keyboard.press('Escape')
  await expect(root).toHaveCount(0)
})

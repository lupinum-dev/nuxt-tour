import { fileURLToPath } from 'node:url'
import { setup, useTestContext } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('Nuxt SPA and custom source directory', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/spa', import.meta.url)),
  })

  it('discovers tours and installs only structural CSS', async () => {
    const nuxt = useTestContext().nuxt!
    const registry = nuxt.options.build.templates
      .find(template => template.filename === 'nuxt-tour/registry.mjs')
    const contents = await registry?.getContents?.({ nuxt } as never)

    expect(contents).toContain('/client/tours/spa.ts')
    expect(nuxt.options.ssr).toBe(false)
    expect(nuxt.options.css.some(entry => String(entry).endsWith('/runtime/structure.css'))).toBe(true)
    expect(nuxt.options.css.some(entry => String(entry).endsWith('/runtime/style.css'))).toBe(false)
  })
})

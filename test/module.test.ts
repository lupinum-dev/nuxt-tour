import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { $fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('Nuxt module', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  })

  it('installs in a Nuxt application', async () => {
    expect(await $fetch('/')).toContain('Nuxt Tour fixture')
  })

  it('registers runtime and type templates for discovered tours', () => {
    const templates = useTestContext().nuxt?.options.build.templates ?? []
    const registryTemplate = templates.find(template => template.filename === 'nuxt-tour/registry.mjs')
    const typesTemplate = templates.find(template => template.filename === 'types/nuxt-tour.d.ts')
    expect(registryTemplate).toBeTruthy()
    expect(typesTemplate).toBeTruthy()
  })

  it('uses collision-resistant Nuxt names and keeps internals private', () => {
    const nuxt = useTestContext().nuxt!
    const imports = readFileSync(resolve(nuxt.options.buildDir, 'imports.d.ts'), 'utf8')
    const components = readFileSync(resolve(nuxt.options.buildDir, 'components.d.ts'), 'utf8')

    expect(imports).toContain('useNuxtTour')
    expect(imports).not.toMatch(/\buseTour\b/u)
    expect(components).toContain('TourHost')
    expect(components).not.toContain('TourContent')
  })
})

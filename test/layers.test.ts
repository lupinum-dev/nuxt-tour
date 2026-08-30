import { fileURLToPath } from 'node:url'
import { $fetch, setup, useTestContext } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

describe('Nuxt layer discovery', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/layers/project', import.meta.url)),
  })

  it('inherits base tours and applies the project-first override', async () => {
    expect(await $fetch('/')).toContain('Nuxt Tour layers fixture')

    const template = useTestContext().nuxt?.options.build.templates
      .find(entry => entry.filename === 'nuxt-tour/registry.mjs')
    const contents = await template?.getContents?.({ nuxt: useTestContext().nuxt! } as never)

    expect(contents).toContain('/base/app/tours/base-only.ts')
    expect(contents).toContain('/project/app/tours/shared.ts')
    expect(contents).not.toContain('/base/app/tours/shared.ts')
  })
})

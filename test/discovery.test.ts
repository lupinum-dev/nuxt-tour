import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  registryTypesTemplate,
  runtimeRegistryTemplate,
  tourIdFromPath,
  tourSources,
} from '../src/discovery'

const toursDirectory = resolve('/app/app/tours')

describe('Nuxt tour discovery', () => {
  it('derives stable IDs from files and nested index files', () => {
    expect(tourIdFromPath(toursDirectory, resolve(toursDirectory, 'onboarding.ts')))
      .toBe('onboarding')
    expect(tourIdFromPath(toursDirectory, resolve(toursDirectory, 'admin/index.ts')))
      .toBe('admin')
    expect(tourIdFromPath(toursDirectory, resolve(toursDirectory, 'admin/billing.mts')))
      .toBe('admin/billing')
  })

  it('rejects paths outside the tours directory and duplicate IDs', () => {
    expect(() => tourIdFromPath(toursDirectory, '/app/outside.ts')).toThrow('Invalid tour file path')
    expect(() => tourSources(toursDirectory, [
      resolve(toursDirectory, 'account.ts'),
      resolve(toursDirectory, 'account/index.ts'),
    ])).toThrow('Duplicate generated tour ID: account')
  })

  it('generates runtime validation and literal registry types', () => {
    const sources = tourSources(toursDirectory, [resolve(toursDirectory, 'onboarding.ts')])
    const runtime = runtimeRegistryTemplate(sources)
    const types = registryTypesTemplate(sources)

    expect(runtime).toContain('import tour0 from "/app/app/tours/onboarding.ts"')
    expect(runtime).toContain('["onboarding", tour0]')
    expect(runtime).toContain('tour.id !== expectedId')
    expect(types).toContain('declare module \'@lupinum/nuxt-tour/vue\'')
    expect(types).toContain('"onboarding": typeof tour0')
  })
})

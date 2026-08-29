import { defineNuxtModule } from '@nuxt/kit'

/** Nuxt Tour has no module options until the first runtime slice needs one. */
export type ModuleOptions = Record<string, never>

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@lupinum/nuxt-tour',
    configKey: 'nuxtTour',
    compatibility: {
      nuxt: '^4.0.0',
    },
  },
  defaults: {},
  setup() {
    // Runtime registration starts after the public contract is accepted.
  },
})

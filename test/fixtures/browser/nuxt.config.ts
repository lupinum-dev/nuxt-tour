import NuxtTour from '../../../src/module'

export default defineNuxtConfig({
  modules: [NuxtTour],
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
  },
  css: ['~/assets/test.css'],
  compatibilityDate: '2026-08-29',
})

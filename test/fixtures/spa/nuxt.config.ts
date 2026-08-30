import NuxtTour from '../../../src/module'

export default defineNuxtConfig({
  modules: [NuxtTour],
  ssr: false,
  srcDir: 'client',
  nuxtTour: {
    css: 'structure',
  },
})

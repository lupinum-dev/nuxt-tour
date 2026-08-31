import nuxtTour from '../src/module'

export default defineNuxtConfig({
  extends: ['@lupinum/ginko-docs'],
  modules: [nuxtTour],
  css: ['~/assets/css/tour.css', '~/assets/css/motion.css'],
  site: { url: 'https://nuxt-tour.lupinum.com', name: 'Nuxt Tour' },
  content: {
    agent: { delivery: 'static' },
    componentPolicy: {
      components: {
        'tour-demo': {
          kind: 'block',
          props: {},
          slots: [],
          media: null,
        },
        'tour-recipe-gallery': {
          kind: 'block',
          props: {},
          slots: [],
          media: null,
        },
      },
    },
  },
  compatibilityDate: '2026-08-29',
  ginkoDocs: {
    syntaxHighlighting: {
      themes: {
        light: 'material-theme-lighter',
        dark: 'material-theme-palenight',
      },
    },
  },
})

import nuxtTour from '../src/module'

export default defineNuxtConfig({
  extends: ['@lupinum/ginko-docs'],
  modules: [nuxtTour],
  site: { url: 'https://nuxt-tour.lupinum.com', name: 'Nuxt Tour' },
  content: {
    componentPolicy: {
      components: {
        'tour-demo': {
          kind: 'block',
          props: {},
          slots: [],
          media: null,
        },
      },
    },
  },
})

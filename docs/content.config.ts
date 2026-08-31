import { defineGinkoDocsConfig } from '@lupinum/ginko-docs/content'

export default defineGinkoDocsConfig({
  site: {
    name: 'Nuxt Tour',
    description: 'Build accessible, route-aware product tours with a Vue-native API and Nuxt-first developer experience.',
    whenToUse: 'Use these docs when building accessible, route-aware product tours for Nuxt or Vue applications.',
  },
  locales: ['en'],
  blog: false,
})

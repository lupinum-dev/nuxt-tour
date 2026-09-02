export default defineAppConfig({
  ginkoDocs: {
    theme: {
      preset: 'nuxt',
      codeBlocks: 'adaptive',
    },
    site: {
      url: 'https://nuxt-tour.lupinum.com',
      name: { en: 'Nuxt Tour' },
      description: { en: 'Build accessible, route-aware product tours with a Vue-native API and Nuxt-first developer experience.' },
      icon: '/favicon.svg',
      logo: { light: '/logo-light.svg', dark: '/logo-dark.svg' },
      docsSidebarSwitcher: 'tabs',
      legalLinks: [
        { label: { en: 'Legal notice' }, to: 'https://lupinum.com/impressum' },
        { label: { en: 'Privacy' }, to: 'https://lupinum.com/datenschutz' },
      ],
    },
    nav: { links: 'auto', socialIcons: true },
    social: { github: 'https://github.com/lupinum-dev/nuxt-tour', discord: 'https://discord.gg/RPH6SeA36N' },
    repository: { url: 'https://github.com/lupinum-dev/nuxt-tour', branch: 'main', contentDirectory: 'docs/content' },
    analytics: { plausible: { scriptId: '' } },
    feedback: { enabled: true },
  },
})

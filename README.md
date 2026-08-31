<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/public/icon-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="docs/public/icon-light.svg">
    <img src="docs/public/icon-light.svg" width="128" alt="Nuxt Tour icon">
  </picture>
</p>
<h1 align="center">Nuxt Tour</h1>
<p align="center">Build accessible, route-aware product tours with a Vue-native API and Nuxt-first developer experience.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@lupinum/nuxt-tour"><img alt="npm" src="https://img.shields.io/npm/v/@lupinum/nuxt-tour"></a>
  <a href="https://github.com/lupinum-dev/nuxt-tour/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/lupinum-dev/nuxt-tour/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
</p>

## Why Nuxt Tour?

Nuxt Tour makes product tours feel like part of Nuxt and Vue. An application
defines a typed tour, marks semantic targets, renders one host, and controls the
journey from one composable. The library owns route changes, late targets,
positioning, cleanup, focus, and failure diagnostics.

Nuxt Tour is not an analytics product, visual editor, checklist system, or
thin wrapper around another tour library.

## Quick start

Install the package and add the module:

```bash
pnpm add @lupinum/nuxt-tour
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@lupinum/nuxt-tour'],
})
```

```ts
// app/tours/onboarding.ts
export default defineTour({
  id: 'onboarding',
  steps: [
    {
      id: 'welcome',
      title: 'Welcome',
      content: 'Let’s take a quick look around.',
    },
    {
      id: 'create-project',
      target: 'create-project',
      title: 'Create a project',
      content: 'Everything starts here.',
      placement: 'bottom-start',
    },
  ],
})
```

```vue
<script setup lang="ts">
const onboarding = useNuxtTour('onboarding')
</script>

<template>
  <button v-tour-target="'create-project'">
    Create project
  </button>

  <button @click="onboarding.start()">
    Show me around
  </button>

  <TourHost />
</template>
```

Nuxt discovers definitions from each layer's `app/tours`, auto-imports the
composables, and generates literal tour, step, and semantic target ID types. Add
one `<TourHost />` near the root of the application.

For plain Vue, import the runtime from `@lupinum/nuxt-tour/vue` and install
`createTourPlugin({ tours: [...] })`. Import `@lupinum/nuxt-tour/style.css` for
the default theme or `structure.css` for layout rules only. The default theme
follows the system color scheme and recognizes `.light`, `.dark`, and matching
`data-theme` values. Override its `--tour-*` custom properties from application
CSS when the card should match your product more closely.

Read the [documentation](docs/content/docs/1.getting-started/1.index.md) for
targets, route-aware steps, interaction modes, events, and errors.

## Requirements

- Node.js 22.19 or later, Node.js 24.11 or later, or Node.js 26.
- Nuxt 4 for the Nuxt module.
- Vue 3.5 or later for the Vue runtime.
- pnpm 11 for repository development.

## Development

```bash
pnpm install
pnpm verify
```

Use `pnpm dev` for the Nuxt playground. Read [CONTRIBUTING.md](CONTRIBUTING.md)
before you open a pull request. Maintainers use [MAINTAINING.md](MAINTAINING.md).

## Support and security

Ask questions in the [Lupinum OSS Discord](https://discord.gg/RPH6SeA36N).
Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/lupinum-dev/nuxt-tour/security/advisories/new).

## License

[MIT](LICENSE) © Lupinum OG.

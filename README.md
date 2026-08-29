<p align="center"><img src="docs/public/icon.svg" width="128" alt="Nuxt Tour icon"></p>
<h1 align="center">Nuxt Tour</h1>
<p align="center">Build accessible, route-aware product tours with a Vue-native API and Nuxt-first developer experience.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@lupinum/nuxt-tour"><img alt="npm" src="https://img.shields.io/npm/v/@lupinum/nuxt-tour"></a>
  <a href="https://github.com/lupinum-dev/nuxt-tour/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/lupinum-dev/nuxt-tour/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
</p>

> [!WARNING]
> Nuxt Tour is in its design phase. It is not published and does not provide a
> working tour runtime yet. The repository freezes the smallest durable
> contract before implementation starts.

## Why Nuxt Tour?

Nuxt Tour will make product tours feel like part of Nuxt and Vue. An application
will define a typed tour, mark semantic targets, render one host, and control the
journey from one composable. The library will own route changes, late targets,
positioning, cleanup, focus, and failure diagnostics.

Nuxt Tour will not be an analytics product, visual editor, checklist system, or
thin wrapper around another tour library.

## Proposed quick start

The first implementation must make this complete journey work without runtime
imports in a Nuxt application:

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
const onboarding = useTour('onboarding')
</script>

<template>
  <button data-tour-target="create-project">
    Create project
  </button>

  <button @click="onboarding.start()">
    Show me around
  </button>

  <TourHost />
</template>
```

Read the [design specification](docs/content/docs/2.design/1.product-and-scope.md)
before implementing a public surface.

## Requirements

- Node.js 22.14 or later, Node.js 24, or Node.js 26.
- Nuxt 4 for the Nuxt module.
- Vue 3.5 or later for the planned Vue runtime.
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

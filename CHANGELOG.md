# Changelog

## v0.1.3

[compare changes](https://github.com/lupinum-dev/nuxt-tour/compare/v0.1.2...v0.1.3)

### 🚀 Enhancements

- **maintenance:** Verify real installed tour journeys ([#21](https://github.com/lupinum-dev/nuxt-tour/pull/21))

### 🩹 Fixes

- **deps:** Remove vulnerable qs from the docs lockfile ([#19](https://github.com/lupinum-dev/nuxt-tour/pull/19))
- **vue:** Preserve readonly routes at the router boundary ([#20](https://github.com/lupinum-dev/nuxt-tour/pull/20))
- **release:** Restrict retained publication to safe local files ([#22](https://github.com/lupinum-dev/nuxt-tour/pull/22))

### 💅 Refactors

- **release:** Publish the retained tarball directly ([#25](https://github.com/lupinum-dev/nuxt-tour/pull/25))

### ✅ Tests

- **vue:** Wait for observable tour completion ([#24](https://github.com/lupinum-dev/nuxt-tour/pull/24))

### ❤️ Contributors

- Matthias Amon <matthias@lupinum.com>

## v0.1.2

- Align the default tour card, controls, arrow, and spotlight surfaces with the official Nuxt color system.
- Refine the card-to-target seam while preserving positioning, accessibility, and reduced-motion behavior.
- Update the interactive documentation to the certified Ginko Docs Nuxt theme and current product assets.

## v0.1.1

- Eliminate spotlight flicker by painting the covered transition state before revealing each target.
- Add continuous-frame browser regression tests for initial and relocating tour steps.
- Align the interactive documentation with the shared Lupinum Nuxt library theme and current docs runtime.

## v0.1.0

- Add the accessible, route-aware tour runtime for Nuxt 4 and Vue 3.
- Add typed `app/tours` discovery, semantic targets, controller events, and structured errors.
- Add the default tour host, interaction modes, continuous step transitions, Floating UI positioning, and light/dark themeable CSS.
- Add the Nuxt playground, user documentation, clean packed-consumer gate, and protected release workflow.

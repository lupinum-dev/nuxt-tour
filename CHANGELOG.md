# Changelog

## v0.2.0

[compare changes](https://github.com/lupinum-dev/nuxt-tour/compare/v0.1.3...v0.2.0)

### Features

- Move and resize one spotlight between nearby visible targets, with adaptive timing and continuous redirection.
- Add the application-level `motion: 'auto' | 'none'` option for Nuxt and Vue. Automatic motion respects reduced-motion preferences.
- Add `gap` for clear spacing beyond the spotlight and arrow, plus a themeable arrow size.
- Add typed `actions` and `progress` slots, tour identity in slot context, and reactive translated headings through `labels.step`.
- Add cancellable loading feedback during slow preparation, improve narrow-screen card layout, and update the developer-focused documentation demos.

### Fixes

- Stop native scrolling when a tour is cancelled, including after early card reveal.
- Block modal background input from the first covered frame and restore focus correctly after cancellation.
- Keep the arrow attached during card animation and prevent unrelated paused animations from stalling navigation.
- Accept native `scroll.behavior: 'instant'` and remove button scaling under reduced motion.
- Correct preparation cleanup and custom-card error-handling examples.

### Compatibility

- Existing definitions, controllers, and `offset` values keep their meaning. Use either `gap` or `offset` on a step.
- The default clear gap is 12 CSS pixels. Custom CSS should target `data-tour-part` attributes without assuming the internal parent-child structure.
- No new runtime dependency. The complete default UI remains within the 30 KiB gzip budget, including CSS and dependencies, with Vue external.

### Maintenance

- Add a reproducible bundle budget check and browser regressions for motion, cancellation, and initial interaction isolation.
- Enable documentation analytics and CodeRabbit review ([#28](https://github.com/lupinum-dev/nuxt-tour/pull/28)).

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

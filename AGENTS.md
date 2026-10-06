# Nuxt Tour

Accessible, route-aware product tours with a Vue-native API and a Nuxt-first
developer experience. A Nuxt module with a plain Vue entry, published to npm as
`@lupinum/nuxt-tour`.

## Commands

```bash
pnpm install
pnpm dev            # run the module in playground/
pnpm docs:dev       # run the documentation site
pnpm test           # unit and component tests (Vitest)
pnpm test:types     # type contracts of the Nuxt fixtures
pnpm test:bundle    # bundle size budget of the Vue runtime
pnpm test:browser   # Playwright journeys in Chromium, Firefox, WebKit and mobile viewports
pnpm test:packed    # packs the output of `pnpm build` into fresh Nuxt and Vue apps; run `pnpm build` first
pnpm format         # apply lint fixes and sync the README agent setup from the docs
pnpm verify         # the CI checks locally; browser journeys in Chromium only (CI adds Firefox, WebKit and mobile)
pnpm changeset      # describe a user-facing change for the next release
```

`pnpm build` builds the package, the docs site and `dist/agent/`, a copy of the
rendered docs that ships as `@lupinum/nuxt-tour/agent-docs` so agents in consuming
projects read documentation that matches the installed version.
The "Agent setup" section of the README tells those agents how to add a pointer
to it. Keep the `./agent-docs` export and that section. The section's source is
the marked block in `docs/content/docs/1.getting-started/6.ai-agents.md`;
`pnpm format` copies it into the README and `pnpm lint` fails when they differ.

Live examples on the docs site are real files in `docs/app/`. A serializer in
`docs/server/plugins/demo-markdown.ts` writes them into the agent Markdown, and
`scripts/check-demo-markdown.mjs` (part of `pnpm build`) fails when a page shows
`Component omitted` or an outdated source.

## Hard rules

- Never publish to npm, push to `main`, create tags or release by hand. Releases
  happen when a maintainer merges the "Version packages" PR and approves the
  protected `npm` environment.
- Never add `NPM_TOKEN` or any other long-lived publish credential.
- Add a changeset (`pnpm changeset`) to every pull request that changes what
  package users install: code, types, runtime behavior or dependencies.
  Documentation, tests and CI changes need none. CI requires one when `src/`
  changes; use `pnpm changeset --empty` if users see nothing. A change to `dependencies` or `peerDependencies` of a
  published package needs a changeset that bumps that package (at least patch).
- Changeset style: one summary line in present tense that starts with Fix, Add,
  Remove or Change and says what changed for users. A short body may follow
  after a blank line. A major change adds a line that starts with `Migration:`
  and says what users must do.
- Do not bypass the 24-hour dependency quarantine (`minimumReleaseAge`). Do not
  add dependencies to `allowBuilds` without a reason.
- Pin GitHub Actions to full commit SHAs. Give each job only the permissions it needs.
- Keep tooling lean. Add a script, check or workflow only when it guards
  behavior users rely on or closes a real attack path. Process is not security.
- Record lasting choices in [internals/decisions.md](internals/decisions.md) and
  temporary compatibility code in [internals/migrations.md](internals/migrations.md).

## Architecture

- `src/module.ts` is the Nuxt module entry point. `src/runtime/` owns the
  application-scoped Vue runtime; `./vue` and `./registry` are its public entries,
  `./style.css` and `./structure.css` the themes. Keep orchestration separate
  from rendering.
- `test/` verifies module installation, public behavior and failure boundaries;
  `test/browser/` runs real journeys with Playwright.
- `playground/` is the smallest interactive Nuxt consumer.
- `docs/` is the public documentation site and a source-workspace consumer.
  `docs/content/docs/3.design/` records the public contract and its design decisions.

## Invariants

- Keep one source of truth for public behavior.
- `defineTour()` describes, `<TourHost />` renders, `useNuxtTour()` or the Vue
  `useTour()` controls, and semantic target IDs locate. Do not overlap these
  responsibilities.
- Keep controller transitions asynchronous and application-scoped. Never use a
  process-global runtime singleton.
- A missing requested target never becomes a centered step. An omitted target
  is the only centered-step contract.
- Route navigation completes before `prepare()`. Target resolution happens
  after `prepare()`. Every cleanup returned by `prepare()` runs exactly once.
- Use stable tour and step IDs. Do not expose numeric indexes as navigation
  identity.
- Keep CSS selectors as an explicit escape hatch. The normal target contract is
  a semantic ID registered by an attribute or `useTourTarget()`.
- Keep the card renderer replaceable. Do not add raw HTML content or an array of
  configured buttons.
- Treat an interactive tour card as a dialog, not an ARIA tooltip.
- Do not add persistence, auto-start, analytics providers, hints, checklists,
  branching graphs, multi-target spotlights, or a public headless core before a
  separately accepted requirement proves the need.
- Add a dependency only when the implementation uses it.
- Every option, composable and component prop has a doc comment with its
  meaning and default. Errors say how to fix them.

## Writing

Update `docs/` in the same pull request as the behavior it describes. Public
text uses Lupinum Controlled English, based on ASD-STE100; do not claim formal
certification.

- Use sentence-case headings, active voice and short sentences, with one main
  instruction in each sentence.
- Explain concrete outcomes and define necessary technical terms.
- Use labeled code fences. Keep examples complete and current.
- Use plain German in German documentation.

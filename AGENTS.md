# Working on Nuxt Tour

## Architecture

- `src/module.ts` is the Nuxt module entry point.
- `src/runtime/` will own the application-scoped Vue runtime. Keep orchestration
  separate from rendering.
- `test/` verifies module installation, public behavior, and failure boundaries.
- `playground/` is the smallest interactive Nuxt consumer.
- `docs/content/docs/2.design/` is the source of truth for the proposed public
  contract until implementation and public documentation replace it.
- `docs/content/docs/3.implementation/` owns the staged implementation plan.
- `docs/` becomes a packed-package consumer before the first release.
- `scripts/` owns inert package certification. It does not publish.

## Commands

Run `pnpm verify` before handoff. Run `pnpm release:verify` before a release. Use `pnpm docs:build` for documentation and `pnpm audit:all` for the complete workspace audit.

## Invariants

- Keep one source of truth for public behavior.
- `defineTour()` describes, `<TourHost />` renders, `useTour()` controls, and
  semantic target IDs locate. Do not overlap these responsibilities.
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
- Add a dependency only when the implementation uses it. Floating UI is the
  intended positioning engine, but it does not belong in the manifest before
  the positioning slice exists.
- Do not publish from a workstation after the first npm bootstrap.
- Do not create tags manually during a normal release.
- Do not add `NPM_TOKEN`.
- Do not rename `.github/workflows/publish.yml` without migrating the npm trusted publisher.
- Do not bypass the 24-hour dependency quarantine. An urgent exception must name one exact version, reason, and removal time.
- Do not use special `codex/*` or `claude/*` branches.
- Keep public text in Lupinum Controlled English, based on ASD-STE100. Do not claim formal certification.

# Decisions

A short, dated log of choices a future maintainer or agent might otherwise undo.
Add one line per decision: `Dn (YYYY-MM-DD): decision — why.` Replace a line
when a decision changes; git keeps the history.

- D1 (2026-10-06): Adopt the Lupinum OSS `nuxt-module` standard: Changesets, `release.yml` with npm trusted publishing, `preview.yml`, `audit-deps.mjs` and the shared layout replace `publish.yml`, changelogen, the dependency policy checker and the release certification scripts — every Lupinum repository shares one release, security and CI setup, so fixes to the standard apply everywhere. `CHANGELOG.md` keeps its changelogen sections below the new ones.
- D2 (2026-10-06): CI runs the browser journeys in Chromium, Firefox, WebKit and two mobile viewports, and installs the packed package into Nuxt 4.0.0, the newest Nuxt, Vue 3.5.0 and the newest Vue (on Windows) — tours depend on engine-specific layout, focus and motion, and the oldest supported peer versions are a promise to users. The final `ci` job needs all of them. `pnpm verify` runs the journeys in Chromium only, as before, so it stays usable on a laptop.
- D3 (2026-10-06): The docs site has its own `vercel-ignore.mjs` instead of the starter's inline `ignoreCommand` — the site imports the module from `src/` and its build reads `tsconfig.json`, so a change there must redeploy it too.
- D4 (2026-10-06): `check-demo-markdown.mjs` runs in `pnpm build`, not in `docs:build` — Vercel builds with its own Nitro preset and writes no `docs/.output/public`, so the check failed every production deployment from #30 to #33 and the site kept serving the 0.2.0 docs.

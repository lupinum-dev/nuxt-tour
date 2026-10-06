# Decisions

A short, dated log of choices a future maintainer or agent might otherwise undo.
Add one line per decision: `Dn (YYYY-MM-DD): decision — why.` Replace a line
when a decision changes; git keeps the history.

- D1 (2026-10-06): Adopt the Lupinum OSS `nuxt-module` standard — one release, security and CI setup for every Lupinum repository, so fixes to the standard apply everywhere. Changesets and `release.yml` replace `publish.yml` and changelogen. `CHANGELOG.md` keeps its old sections below the new ones.
- D2 (2026-10-06): CI runs the browser journeys in five Playwright projects and the packed consumer at the oldest and newest Nuxt and Vue, one on Windows — tours depend on engine-specific layout, focus and motion, and the oldest peer versions are a promise to users. The final `ci` job needs all of them. `pnpm verify` runs Chromium only, so it stays usable on a laptop.
- D3 (2026-10-06): Keep `docs/scripts/vercel-ignore.mjs` instead of the starter's inline `ignoreCommand` — the docs import the module from `src/`, so a change there must redeploy the site.
- D4 (2026-10-06): Run `check-demo-markdown.mjs` in `pnpm build`, not in `docs:build` — on Vercel, Nitro writes no `docs/.output/public`. The check failed every production deploy from #30 to #33, so the site kept the 0.2.0 docs.

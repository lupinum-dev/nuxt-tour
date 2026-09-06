# Maintaining Nuxt Tour

## Public contract

The package is public. Treat every documented API as a compatibility contract.
Change the design specification before or with a public API implementation.
State the user journey and acceptance criterion for each new option, export,
event, or state value. Prefer additive changes. For a breaking change, document
the migration and release it under the correct semantic version.

Do not present a planned API as implemented behavior. Verify examples against
the packed package before release.

## Setup and evidence

Run `pnpm install --frozen-lockfile`, then `pnpm dev`. Use the playground URL
printed by Nuxt. The playground has no login, backend, or external write service.
Use disposable tours and stop only processes you started.

| Command | Evidence |
| --- | --- |
| `pnpm verify` | Audit, policy, types, source tests, builds, and Chromium journeys. |
| `pnpm test test/controller.test.ts` | Focused controller behavior. |
| `pnpm test:types` | Discovered tour and step selection, including layer overrides. |
| `pnpm preview:verify` | Mounted Nuxt and Vue journeys from an installed tarball. |
| `pnpm release:verify` | Full browser matrix and packed consumer certification. |

Explore start, step navigation, finish, Escape, focus return, and a narrow screen.
Keep source docs and packed-consumer evidence separate. Linux, Windows, framework
floors, and hosted behavior still need their CI or deployment evidence. Read the
final diff and obtain independent review before a meaningful change is merged.

## Quick fix

Create a focused branch. Add a regression test. Run `pnpm verify`. Open a pull request with the result, verification, release note, and risk.

## Large change

Open an issue first. Record important architecture decisions. Split work at the
contract, runtime, rendering, Nuxt integration, and browser-verification
boundaries when each part can be reviewed independently. Keep migrations
explicit and remove temporary compatibility code after the cutover.

## Dependency update

`pnpm check:dependencies` checks actual install settings and exception expiry.
Any exact exclusion needs an inline JSON comment with `reason`, `owner`, and
UTC `expires`, within 24 hours. Remove the entry and comment after expiry.
The checker is a repository-owned copy of
`lupinum-oss/starters/_shared/check-dependency-policy.mjs`. Copy updates from that
canonical file; do not maintain a separate implementation here.
Generated consumer configuration is derived from the root workspace policy and
checked with the same implementation before installation. CI checks expiry daily.

Use Renovate for routine updates. Review release notes and lockfile changes. Do not bypass the 24-hour quarantine. Run `pnpm audit:all` and `pnpm verify`.

## Documentation change

Follow [docs/WRITING.md](docs/WRITING.md). Run `pnpm docs:build`. Verify links, mobile navigation, search, analytics, and feedback on the deployed preview.

Vercel uses `docs/` as the Root Directory. Enable source files outside the Root
Directory because the documentation build needs this workspace package. Keep
`vercel.json` in `docs/`.

## First npm release (completed for `v0.1.0`)

The package must exist before npm can bind a trusted publisher. Download the exact tarball from the successful main CI release-candidate artifact and verify its SHA-256. Publish that same file once with 2FA, `--access public`, the correct dist-tag, and `--ignore-scripts`. Then bind `publish.yml` and environment `npm` as the trusted publisher. Dispatch `publish.yml` for the same version. It derives bootstrap state only when the registry bytes match and this is the sole published version. It records the exception in the GitHub release. Never rebuild the artifact or provide a bootstrap switch.

## Normal release

Update `CHANGELOG.md` with `pnpm release:prepare` in a focused pull request. Merge after `pnpm release:verify` and CI pass. Dispatch `publish.yml` from current `main` with the reviewed package version. On a first attempt, the workflow requires current `main`. A rerun can use the original dispatch commit only while it remains an ancestor of `main`. The workflow derives every other value from the exact successful `main` CI artifact. It requests npm approval only when publication is required and repairs the tag or GitHub release separately.

## Rollback

Do not delete a published version. Deprecate a broken version, restore the last good code in a new pull request, and publish a patch. Move the dist-tag only when users need an immediate safe version.

## Credential incident

Stop releases. Revoke the affected credential or trusted publisher. Review audit logs and published bytes. Do not commit replacement secrets. Restore trusted publishing only after the repository and account are safe.

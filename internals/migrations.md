# Active compatibility work

## Nuxt 4.0 static assets

Introduced on 2026-09-06 for the Nuxt 4.0.0 compatibility consumer, tracked in
Lupinum OSS issue #57. Its Nitro 2.12.0 dependency requires plugin-replace ^6.0.2,
but 6.0.3 prevents Nitro's import.meta replacement and makes built asset requests
fail with ENOENT. The workspace constrains only that dependency edge to 6.0.2.
Remove the override and this entry when Nuxt 4.0.0 support ends, or when a tested
replacement within Nitro 2.12's range serves its built assets correctly.

## Audit advisories without published fixes

Introduced on 2026-10-03 for the CI audit step. The workspace ignores
GHSA-86w9-cpqp-85rv (node-forge) and GHSA-vfj7-8cjw-p6xm (braces) because their
fixed versions are not published. Neither use reaches the consumer runtime:
node-forge is used only for listhen dev-server self-signed certificates, and
braces processes build-time glob patterns from our own config. The CI audit step
depends on these two ignores while the fixes are unavailable.
Remove both ignores and this entry when node-forge >=1.4.1 and braces >=3.0.4
are published, past the 24-hour quarantine, and in the lockfile.

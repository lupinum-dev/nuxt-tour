# Active compatibility work

## Nuxt 4.0 static assets

Introduced on 2026-09-06 for the Nuxt 4.0.0 compatibility consumer, tracked in
Lupinum OSS issue #57. Its Nitro 2.12.0 dependency requires plugin-replace ^6.0.2,
but 6.0.3 prevents Nitro's import.meta replacement and makes built asset requests
fail with ENOENT. The workspace constrains only that dependency edge to 6.0.2.
Remove the override and this entry when Nuxt 4.0.0 support ends, or when a tested
replacement within Nitro 2.12's range serves its built assets correctly.

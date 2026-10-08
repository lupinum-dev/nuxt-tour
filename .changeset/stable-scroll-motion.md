---
'@lupinum/nuxt-tour': patch
---

Fix spotlight and step transitions so they stay stable while the page scrolls or its layout changes.

The spotlight now travels with scroll and layout changes, and an early reveal only starts when the next target is also close horizontally.

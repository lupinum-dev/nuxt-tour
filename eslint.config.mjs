// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  features: {
    tooling: true,
    stylistic: true,
  },
  dirs: {
    src: ['./playground'],
  },
})
  .append({
    ignores: [
      // Keep the shared Lupinum OSS checker byte-identical to its canonical copy.
      'scripts/check-dependency-policy.mjs',
      'dist/**',
      'release-artifacts/**',
      '.preview-artifacts/**',
      'docs/.nuxt/**',
      'docs/.output/**',
      'playground/.nuxt/**',
      'playground/.output/**',
    ],
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: { Buffer: 'readonly', console: 'readonly', fetch: 'readonly', process: 'readonly' },
    },
  })

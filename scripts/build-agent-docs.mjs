import { resolve } from 'node:path'
import { buildPackageAgentDocs, verifyPackageAgentDocs } from './package-agent-docs.mjs'

const packageRoot = resolve(import.meta.dirname, '..')
const sourceRoot = resolve(packageRoot, 'docs/.output/public/raw')

const manifest = await buildPackageAgentDocs({
  packageRoot,
  sourceRoot,
  startRoutes: ['/docs/getting-started', '/docs/design/public-api'],
})
await verifyPackageAgentDocs(packageRoot, { sourceRoot })
console.log(`Installed documentation: ${manifest.name}@${manifest.version}, ${manifest.pages.length} verified pages.`)

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

async function workflowFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await workflowFiles(path)))
    else if (/\.ya?ml$/u.test(entry.name)) files.push(path)
  }
  return files
}
function actionReferences(source, path) {
  const references = new Set()
  const usesPattern = /\buses\s*:\s*(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s,\]}#]+))/gu

  for (const match of source.matchAll(usesPattern)) {
    const value = match[1] ?? match[2] ?? match[3] ?? ''
    if (!value || value.startsWith('./')) continue
    const action = value.match(/^([^/]+\/[^/@]+)(?:\/[^@]+)?@([0-9a-f]{40})$/u)
    if (!action) {
      throw new Error(`${path}: external action must use a full commit SHA: ${value}`)
    }
    references.add(`${action[1]}@${action[2]}`)
  }
  return references
}

const probeSha = '0'.repeat(40)
const probe = actionReferences(
  `jobs: { reusable: { uses: owner/workflows/.github/workflows/ci.yml@${probeSha} }, steps: { runs-on: ubuntu-latest, steps: [ { uses: owner/action@${probeSha} } ] } }`,
  '<parser probe>',
)
if (probe.size !== 2) {
  throw new Error('Action verification must inspect flow-style steps and reusable workflows.')
}

const references = new Set()
for (const path of await workflowFiles('.github/workflows')) {
  const source = await readFile(path, 'utf8')
  for (const reference of actionReferences(source, path)) references.add(reference)
}
if (references.size === 0) throw new Error('No pinned action references were found.')

for (const reference of [...references].sort()) {
  const [repository, sha] = reference.split('@')
  const response = await fetch(`https://github.com/${repository}/commit/${sha}`, {
    method: 'HEAD',
    signal: globalThis.AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    throw new Error(`${reference} is not a valid upstream commit: HTTP ${response.status}.`)
  }
  console.log(`Verified ${reference}.`)
}

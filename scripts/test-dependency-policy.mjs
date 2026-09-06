import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { checkDependencyPolicy } from './check-dependency-policy.mjs'

const root = new URL('../', import.meta.url)
const source = await readFile(new URL('pnpm-workspace.yaml', root), 'utf8')
assert.deepEqual(checkDependencyPolicy(source), [])
const now = Date.parse('2026-09-06T12:00:00Z')
const entry = expires => `\nminimumReleaseAgeExclude:\n  - '@lupinum/example@1.2.3' # ${JSON.stringify({ reason: 'Reviewed incident', owner: 'mat4m0', expires })}\n`
assert.deepEqual(checkDependencyPolicy(source + entry('2026-09-06T13:00:00Z'), now), [])
for (const [input, expected] of [
  [source + entry('2026-09-06T12:00:00Z'), /expired/],
  [source + entry('2026-02-30T12:00:00Z'), /valid UTC/],
  [source + entry('2027-09-06T12:00:00Z'), /within 24 hours/],
  [source + '\nminimumReleaseAgeExclude: ["@lupinum/*"]\n', /exact/],
  [source + '\nminimumReleaseAgeExclude: ["foo@1.2.3"]\n', /inline JSON/],
  [source.replace('minimumReleaseAge: 1440', '# minimumReleaseAge: 1440'), /must be 1440/],
]) assert.match(checkDependencyPolicy(input, now).join('\n'), expected)

const temporary = await mkdtemp(join(tmpdir(), 'tour-policy-fixture-'))
try {
  await writeFile(join(temporary, 'package.json'), await readFile(new URL('package.json', root)))
  await writeFile(join(temporary, 'pnpm-workspace.yaml'), source + entry('2020-01-01T00:00:00Z'))
  await mkdir(join(temporary, 'release-artifacts'))
  await writeFile(join(temporary, 'release-artifacts/release.json'), JSON.stringify({
    packages: [{ name: '@lupinum/nuxt-tour', version: '0.1.2', filename: 'lupinum-nuxt-tour-0.1.2.tgz' }],
  }))
  for (const framework of ['nuxt', 'vue']) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('scripts/verify-packed-consumer.mjs', root)), '--framework', framework], { cwd: temporary, encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /quarantine exception expired/)
    assert.doesNotMatch(result.stderr, /installation failed|ENOENT.*tgz/)
  }
}
finally {
  await rm(temporary, { recursive: true, force: true })
}
console.log('Root and generated consumer dependency policies passed positive and negative checks.')

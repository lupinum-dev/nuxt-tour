import { createHash } from 'node:crypto'
import { appendFile, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'

const preview = process.argv.includes('--preview')
const directory = preview ? '.preview-artifacts' : 'release-artifacts'
const npm = process.platform === 'win32' ? process.execPath : 'npm'
const npmArguments = process.platform === 'win32'
  ? [join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')]
  : []
await rm(directory, { recursive: true, force: true })
await mkdir(directory, { recursive: true })
const result = spawnSync(npm, [...npmArguments, 'pack', '--ignore-scripts', '--pack-destination', directory], {
  encoding: 'utf8',
  env: { ...process.env, npm_config_cache: process.env.npm_config_cache ?? resolve('.npm-cache') },
})
if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'npm pack failed.')
const filename = result.stdout.trim().split('\n').at(-1)
const bytes = await readFile(`${directory}/${filename}`)
const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
const sha256 = createHash('sha256').update(bytes).digest('hex')
const shasum = createHash('sha1').update(bytes).digest('hex')
const distTag = packageJson.version.includes('-') ? 'next' : 'latest'
const source = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' })
const sourceSha = source.stdout.trim()
if (source.status !== 0 || !/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error(source.stderr || 'Cannot resolve the source commit.')
const expectedSourceSha = (process.env.RELEASE_SOURCE_SHA ?? process.env.GITHUB_SHA)?.trim().toLowerCase()
if (expectedSourceSha && !/^[0-9a-f]{40}$/.test(expectedSourceSha)) throw new Error('The expected source is not a full commit SHA.')
if (expectedSourceSha && sourceSha !== expectedSourceSha) {
  throw new Error(`The release source ${sourceSha} differs from the expected source ${expectedSourceSha}.`)
}
const changelog = await readFile('CHANGELOG.md', 'utf8')
const escapedVersion = packageJson.version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const matches = [...changelog.matchAll(new RegExp(`^##\\s+v?${escapedVersion}(?:\\s|$)[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'gm'))]
if (matches.length !== 1 || !matches[0][1].trim()) throw new Error(`CHANGELOG.md must contain exactly one non-empty ${packageJson.version} release.`)
await copyFile('CHANGELOG.md', `${directory}/CHANGELOG.md`)
await writeFile(`${directory}/release-notes.md`, `${matches[0][1].trim()}\n`)
const changelogBytes = await readFile(`${directory}/CHANGELOG.md`)
const notesBytes = await readFile(`${directory}/release-notes.md`)
await writeFile(`${directory}/SHA256SUMS`, [
  `${sha256}  ${filename}`,
  `${createHash('sha256').update(changelogBytes).digest('hex')}  CHANGELOG.md`,
  `${createHash('sha256').update(notesBytes).digest('hex')}  release-notes.md`,
].join('\n') + '\n')
await writeFile(`${directory}/release.json`, `${JSON.stringify({ name: packageJson.name, version: packageJson.version, filename, sha256, shasum, distTag, sourceSha, packages: [{ name: packageJson.name, version: packageJson.version, filename, sha256, shasum }] }, null, 2)}\n`)
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `directory=${directory}\nmanifest=${directory}/release.json\n`)
console.log(JSON.stringify({ directory, filename, name: packageJson.name, sha256 }))

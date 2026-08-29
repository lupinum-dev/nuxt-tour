import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const release = JSON.parse(await readFile('release-artifacts/release.json', 'utf8'))
const pkg = release.packages[0]
const consumer = await mkdtemp(join(tmpdir(), 'lupinum-packed-consumer-'))

try {
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  const install = spawnSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', resolve('release-artifacts', pkg.filename)], {
    cwd: consumer,
    encoding: 'utf8',
  })
  if (install.status !== 0) throw new Error(install.stderr || 'Packed consumer installation failed.')
  const verify = spawnSync(process.execPath, ['--input-type=module', '--eval', `const mod = await import(${JSON.stringify(pkg.name)}); if (typeof mod.default !== 'function') throw new Error('Nuxt module default export is missing.')`], {
    cwd: consumer,
    encoding: 'utf8',
  })
  if (verify.status !== 0) throw new Error(verify.stderr || 'Packed consumer import failed.')
}
finally {
  await rm(consumer, { recursive: true, force: true })
}

console.log(`Verified packed consumer for ${pkg.name}@${pkg.version}.`)

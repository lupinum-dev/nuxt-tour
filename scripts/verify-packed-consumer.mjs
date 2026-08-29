import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const release = JSON.parse(await readFile('release-artifacts/release.json', 'utf8'))
const pkg = release.packages[0]
const consumer = await mkdtemp(join(tmpdir(), 'lupinum-packed-consumer-'))
const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
const tarball = resolve('release-artifacts', pkg.filename)

try {
  await mkdir(join(consumer, 'app', 'tours'), { recursive: true })
  await writeFile(join(consumer, 'package.json'), `${JSON.stringify({
    private: true,
    type: 'module',
    dependencies: {
      [pkg.name]: `file:${tarball}`,
      nuxt: packageJson.devDependencies.nuxt,
    },
    devDependencies: {
      'typescript': packageJson.devDependencies.typescript,
      'vue-tsc': packageJson.devDependencies['vue-tsc'],
    },
  }, null, 2)}\n`)
  await writeFile(join(consumer, 'nuxt.config.ts'), `export default defineNuxtConfig({
  modules: [${JSON.stringify(pkg.name)}],
  compatibilityDate: '2026-08-29',
})\n`)
  await writeFile(join(consumer, 'tsconfig.json'), '{ "extends": "./.nuxt/tsconfig.json" }\n')
  await writeFile(join(consumer, 'app', 'tours', 'onboarding.ts'), `export default defineTour({
  id: 'onboarding',
  steps: [{
    id: 'welcome',
    target: 'welcome',
    title: 'Welcome',
    content: 'Packed consumer tour',
  }],
})\n`)
  await writeFile(join(consumer, 'app', 'app.vue'), `<script setup lang="ts">
const tour = useTour('onboarding')
</script>

<template>
  <button data-tour-target="welcome" @click="tour.start()">Start tour</button>
  <TourHost />
</template>
`)

  const install = spawnSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: consumer,
    encoding: 'utf8',
  })
  if (install.status !== 0) throw new Error(install.stderr || 'Packed consumer installation failed.')
  const verify = spawnSync(process.execPath, ['--input-type=module', '--eval', `const mod = await import(${JSON.stringify(pkg.name)}); if (typeof mod.default !== 'function') throw new Error('Nuxt module default export is missing.')`], {
    cwd: consumer,
    encoding: 'utf8',
  })
  if (verify.status !== 0) throw new Error(verify.stderr || 'Packed consumer import failed.')

  for (const args of [['nuxt', 'typecheck'], ['nuxt', 'build']]) {
    const result = spawnSync('npx', ['--no-install', ...args], {
      cwd: consumer,
      encoding: 'utf8',
    })
    if (result.status !== 0) {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
      throw new Error(output || `Packed consumer ${args.join(' ')} failed.`)
    }
  }
}
finally {
  await rm(consumer, { recursive: true, force: true })
}

console.log(`Verified packed consumer for ${pkg.name}@${pkg.version}.`)

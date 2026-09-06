import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { pathToFileURL } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { parseDocument } from 'yaml'
import { checkDependencyPolicyFile } from './check-dependency-policy.mjs'

const artifactsDirectory = process.argv.includes('--preview') ? '.preview-artifacts' : 'release-artifacts'
const framework = readArgument('--framework') ?? 'nuxt'
if (framework !== 'nuxt' && framework !== 'vue') {
  throw new Error(`Unsupported framework ${JSON.stringify(framework)}. Expected "nuxt" or "vue".`)
}
const release = JSON.parse(await readFile(`${artifactsDirectory}/release.json`, 'utf8'))
const pkg = release.packages[0]
if (typeof pkg.filename !== 'string' || pkg.filename.trim() !== pkg.filename || !/^[A-Za-z0-9][\w.-]*\.tgz$/.test(pkg.filename)) {
  throw new Error('Invalid retained tarball basename.')
}
const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
const tarball = resolve(artifactsDirectory, pkg.filename)
const frameworkVersion = readArgument('--framework-version') ?? packageJson.devDependencies[framework]
if (!frameworkVersion) throw new Error(`No version was provided for ${framework}.`)
const consumer = await mkdtemp(join(tmpdir(), 'lupinum-packed-consumer-'))

try {
  await mkdir(join(consumer, 'src'), { recursive: true })
  await writeFile(join(consumer, 'package.json'), `${JSON.stringify({
    private: true,
    type: 'module',
    packageManager: packageJson.packageManager,
    dependencies: {
      [pkg.name]: pathToFileURL(tarball).href,
      [framework]: frameworkVersion,
    },
    devDependencies: {
      'typescript': packageJson.devDependencies.typescript,
      'vue-tsc': packageJson.devDependencies['vue-tsc'],
      ...(framework === 'vue' ? { 'vite': packageJson.devDependencies.vite, '@vitejs/plugin-vue': packageJson.devDependencies['@vitejs/plugin-vue'] } : {}),
    },
  }, null, 2)}\n`)

  // Preserve the root policy, including reviewed metadata on exact exceptions.
  // Only the workspace package inventory changes in this disposable installation.
  const workspace = parseDocument(await readFile('pnpm-workspace.yaml', 'utf8'))
  workspace.set('packages', [])
  const policyPath = join(consumer, 'pnpm-workspace.yaml')
  await writeFile(policyPath, workspace.toString())
  const failures = await checkDependencyPolicyFile(policyPath)
  if (failures.length) throw new Error(failures.join('\n'))

  if (framework === 'nuxt') await writeNuxtConsumer()
  else await writeVueConsumer()

  runPnpm(['install', '--ignore-scripts'], 'Packed consumer installation failed.')
  const installed = JSON.parse(await readFile(join(consumer, 'node_modules', framework, 'package.json'), 'utf8'))
  if (/^\d+\.\d+\.\d+$/.test(frameworkVersion) && installed.version !== frameworkVersion) {
    throw new Error(`Expected ${framework}@${frameworkVersion}, installed ${installed.version}.`)
  }
  const installedPackage = await realpath(join(consumer, 'node_modules', ...pkg.name.split('/')))
  if (!installedPackage.startsWith(`${await realpath(consumer)}${sep}`)) throw new Error('Packed package resolved outside its isolated consumer.')
  run(process.execPath, ['--input-type=module', '--eval', `
    const root = await import(${JSON.stringify(pkg.name)})
    if (typeof root.default !== 'function') throw new Error('Nuxt module default export is missing.')
    for (const entry of ['vue', 'style.css', 'structure.css']) {
      const path = import.meta.resolve(${JSON.stringify(pkg.name)} + '/' + entry)
      if (!path.startsWith(new URL('./node_modules/', import.meta.url).href)) throw new Error('Export resolved outside consumer: ' + path)
      await import('node:fs/promises').then(fs => fs.access(new URL(path)))
    }
  `], 'Packed consumer exports failed.')
  await access(join(installedPackage, 'package.json'))

  const commands = framework === 'nuxt'
    ? [['nuxt', 'typecheck'], ['nuxt', 'build']]
    : [['vue-tsc', '--noEmit'], ['vite', 'build']]
  for (const command of commands) runPnpm(['exec', ...command], `Packed consumer ${command.join(' ')} failed.`)
  await verifyJourney()
  console.log(`Verified mounted ${framework}@${installed.version} consumer of ${pkg.name}@${pkg.version}.`)
}
finally {
  await rm(consumer, { recursive: true, force: true })
}

function readArgument(name) {
  const index = process.argv.indexOf(name)
  if (index !== -1 && (!process.argv[index + 1] || process.argv[index + 1].startsWith('--'))) throw new Error(`Missing value for ${name}.`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function runPnpm(args, fallbackMessage) {
  // Reuse pnpm's JS entry to preserve the Windows compatibility lane.
  const cli = process.env.npm_execpath
  if (cli?.includes('pnpm')) run(process.execPath, [cli, ...args], fallbackMessage)
  else run('pnpm', args, fallbackMessage)
}

function run(command, args, fallbackMessage) {
  const result = spawnSync(command, args, { cwd: consumer, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  if (result.status !== 0) throw new Error([result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n').trim() || fallbackMessage)
}

async function verifyJourney() {
  // Older Nitro treats port 0 as its default, so choose a free port explicitly.
  const probe = createServer().listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const address = probe.address()
  probe.close()
  await once(probe, 'close')
  if (!address || typeof address === 'string') throw new Error('Cannot select a packed consumer port.')
  const port = String(address.port)
  const serverArgs = framework === 'nuxt'
    ? ['.output/server/index.mjs']
    : [join(consumer, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', port, '--outDir', join(consumer, 'dist')]
  const server = spawn(process.execPath, serverArgs, {
    cwd: consumer,
    env: { ...process.env, NITRO_HOST: '127.0.0.1', NITRO_PORT: port },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let browser
  try {
    const url = await new Promise((resolveReady, reject) => {
      let output = ''
      const timeout = setTimeout(() => reject(new Error(`Packed server did not start:\n${output}`)), 30_000)
      const read = (chunk) => {
        output += chunk.toString()
        const address = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]
        if (address) {
          clearTimeout(timeout)
          resolveReady(address)
        }
      }
      server.stdout.on('data', read)
      server.stderr.on('data', read)
      server.once('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
      server.once('exit', (code) => {
        clearTimeout(timeout)
        reject(new Error(`Packed server exited ${code}: ${output}`))
      })
    })
    browser = await chromium.launch()
    const page = await browser.newPage({ reducedMotion: 'reduce' })
    const errors = []
    page.on('console', (message) => {
      if (message.type() === 'error') console.error(message.text())
    })
    page.on('pageerror', (error) => {
      errors.push(error.message)
      console.error(error)
    })
    const response = await page.goto(url, { waitUntil: 'networkidle' })
    expect(response?.status()).toBe(200)
    const start = page.getByRole('button', { name: 'Start tour', exact: true })
    await expect(start).toBeVisible()
    await start.click()
    const dialog = page.getByRole('dialog', { name: 'Welcome', exact: true })
    await expect(dialog).toBeVisible()
    await expect(page.getByTestId('step')).toHaveText('welcome')
    await expect(page.locator('[data-tour-target="welcome"]')).toBeVisible()
    await dialog.getByRole('button', { name: 'Finish', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('status')).toHaveText('completed')
    await expect(start).toBeFocused()
    expect(errors).toEqual([])
  }
  finally {
    await browser?.close()
    if (server.exitCode === null && server.signalCode === null) {
      server.kill('SIGTERM')
      await once(server, 'exit')
    }
  }
}

async function writeNuxtConsumer() {
  await mkdir(join(consumer, 'app', 'tours'), { recursive: true })
  await writeFile(join(consumer, 'nuxt.config.ts'), `export default defineNuxtConfig({
  modules: [${JSON.stringify(pkg.name)}],
  compatibilityDate: '2026-08-29',
})\n`)
  await writeFile(join(consumer, 'tsconfig.json'), '{ "extends": "./.nuxt/tsconfig.json" }\n')
  await writeFile(join(consumer, 'app', 'tours', 'onboarding.ts'), `export default defineTour({
  id: 'onboarding',
  steps: [{ id: 'welcome', target: 'welcome', title: 'Welcome', content: 'Packed consumer tour' }],
})\n`)
  await writeFile(join(consumer, 'app', 'type-contract.ts'), `const tour = useNuxtTour('onboarding')
void tour.goTo('welcome')
// @ts-expect-error Unknown discovered tour IDs must remain rejected.
useNuxtTour('unknown')
// @ts-expect-error Step selection must stay specific to this tour.
void tour.goTo('unknown')
export {}\n`)
  await writeFile(join(consumer, 'app', 'app.vue'), `<script setup lang="ts">
const tour = useNuxtTour('onboarding')
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const result = ref('idle')
tour.on('tour:end', event => { result.value = event.reason })
</script>
<template>
  <main>
    <button v-tour-target="'welcome'" :disabled="!mounted" @click="tour.start()">Start tour</button>
    <p role="status">{{ result }}</p>
    <p data-testid="step">{{ tour.currentStepId.value }}</p>
    <TourHost />
  </main>
</template>\n`)
}

async function writeVueConsumer() {
  await writeFile(join(consumer, 'tsconfig.json'), `${JSON.stringify({
    compilerOptions: { lib: ['ES2022', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'Bundler', noEmit: true, strict: true, target: 'ES2022' },
    include: ['src'],
  }, null, 2)}\n`)
  await writeFile(join(consumer, 'index.html'), '<div id="app"></div><script type="module" src="/src/main.ts"></script>\n')
  await writeFile(join(consumer, 'vite.config.ts'), `import vue from '@vitejs/plugin-vue'\nexport default { plugins: [vue()] }\n`)
  await writeFile(join(consumer, 'src', 'main.ts'), `import { createApp, defineComponent, h, ref } from 'vue'
import { TourHost, createTourPlugin, defineTour, useTour, useTourTarget } from ${JSON.stringify(`${pkg.name}/vue`)}
import ${JSON.stringify(`${pkg.name}/style.css`)}
const onboarding = defineTour({
  id: 'onboarding',
  steps: [{ id: 'welcome', target: 'welcome', title: 'Welcome', content: 'Packed Vue consumer tour' }],
})
const App = defineComponent({
  setup() {
    const tour = useTour(onboarding)
    const result = ref('idle')
    tour.on('tour:end', event => { result.value = event.reason })
    const target = ref<HTMLButtonElement | null>(null)
    useTourTarget('welcome', target)
    return () => h('main', [
      h('button', { ref: target, 'data-tour-target': 'welcome', onClick: () => tour.start() }, 'Start tour'),
      h('p', { role: 'status' }, result.value),
      h('p', { 'data-testid': 'step' }, tour.currentStepId.value ?? ''),
      h(TourHost),
    ])
  },
})
createApp(App).use(createTourPlugin({ tours: [onboarding] })).mount('#app')\n`)
  await writeFile(join(consumer, 'src', 'type-contract.ts'), `import { defineTour, useTour } from ${JSON.stringify(`${pkg.name}/vue`)}
const tour = useTour(defineTour({ id: 'typed', steps: [{ id: 'known', title: 'Known', content: 'Type contract' }] }))
void tour.goTo('known')
// @ts-expect-error The Vue entry must retain literal step selection.
void tour.goTo('unknown')\n`)
}

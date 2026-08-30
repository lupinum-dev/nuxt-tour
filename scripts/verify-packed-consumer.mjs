import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const artifactsDirectory = process.argv.includes('--preview') ? '.preview-artifacts' : 'release-artifacts'
const framework = readArgument('--framework') ?? 'nuxt'
const release = JSON.parse(await readFile(`${artifactsDirectory}/release.json`, 'utf8'))
const pkg = release.packages[0]
const consumer = await mkdtemp(join(tmpdir(), 'lupinum-packed-consumer-'))
const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
const tarball = resolve(artifactsDirectory, pkg.filename)
const frameworkVersion = readArgument('--framework-version') ?? packageJson.devDependencies[framework]

if (framework !== 'nuxt' && framework !== 'vue') {
  throw new Error(`Unsupported framework ${JSON.stringify(framework)}. Expected "nuxt" or "vue".`)
}

if (!frameworkVersion) {
  throw new Error(`No version was provided for ${framework}.`)
}

try {
  await mkdir(join(consumer, 'src'), { recursive: true })
  await writeFile(join(consumer, 'package.json'), `${JSON.stringify({
    private: true,
    type: 'module',
    dependencies: {
      [pkg.name]: pathToFileURL(tarball).href,
      [framework]: frameworkVersion,
    },
    devDependencies: {
      'typescript': packageJson.devDependencies.typescript,
      'vue-tsc': packageJson.devDependencies['vue-tsc'],
    },
  }, null, 2)}\n`)

  if (framework === 'nuxt') {
    await writeNuxtConsumer()
  }
  else {
    await writeVueConsumer()
  }

  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], 'Packed consumer installation failed.')
  run(process.execPath, ['--input-type=module', '--eval', `
    const root = await import(${JSON.stringify(pkg.name)})
    if (typeof root.default !== 'function') throw new Error('Nuxt module default export is missing.')
    import.meta.resolve(${JSON.stringify(`${pkg.name}/vue`)})
  `], 'Packed consumer import failed.')

  await access(join(consumer, 'node_modules', ...pkg.name.split('/'), 'dist', 'runtime', 'style.css'))
  await access(join(consumer, 'node_modules', ...pkg.name.split('/'), 'dist', 'runtime', 'structure.css'))

  const commands = framework === 'nuxt'
    ? [['nuxt', 'typecheck'], ['nuxt', 'build']]
    : [['vue-tsc', '--noEmit']]

  for (const command of commands) {
    run('npx', ['--no-install', ...command], `Packed ${framework} consumer ${command.join(' ')} failed.`)
  }
}
finally {
  await rm(consumer, { recursive: true, force: true })
}

console.log(`Verified ${framework}@${frameworkVersion} with ${pkg.name}@${pkg.version}.`)

function readArgument(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function run(command, arguments_, fallbackMessage) {
  const npmCommand = command === 'npm' || command === 'npx'
  const executable = process.platform === 'win32' && npmCommand ? process.execPath : command
  const executableArguments = process.platform === 'win32' && npmCommand
    ? [join(dirname(process.execPath), 'node_modules', 'npm', 'bin', `${command}-cli.js`), ...arguments_]
    : arguments_
  const result = spawnSync(executable, executableArguments, {
    cwd: consumer,
    encoding: 'utf8',
    env: { ...process.env, npm_config_cache: process.env.npm_config_cache ?? resolve('.npm-cache') },
  })
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join('\n').trim()
    throw new Error(output || fallbackMessage)
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
  steps: [{
    id: 'welcome',
    target: 'welcome',
    title: 'Welcome',
    content: 'Packed consumer tour',
  }],
})\n`)
  await writeFile(join(consumer, 'app', 'app.vue'), `<script setup lang="ts">
import { defineTour as defineVueTour, useTour } from ${JSON.stringify(`${pkg.name}/vue`)}

const tour = useNuxtTour('onboarding')
const inlineTour = useTour(defineVueTour({
  id: 'inline',
  steps: [{ id: 'intro', title: 'Inline', content: 'Vue entrypoint tour' }],
}))
</script>

<template>
  <button v-tour-target="'welcome'" @click="tour.start()">Start tour</button>
  <button @click="inlineTour.start()">Start inline tour</button>
</template>
`)
}

async function writeVueConsumer() {
  await writeFile(join(consumer, 'tsconfig.json'), `${JSON.stringify({
    compilerOptions: {
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      moduleResolution: 'Bundler',
      noEmit: true,
      strict: true,
      target: 'ES2022',
    },
    include: ['src'],
  }, null, 2)}\n`)
  await writeFile(join(consumer, 'src', 'main.ts'), `import { createApp, defineComponent, h, ref } from 'vue'
import { TourHost, createTourPlugin, defineTour, useTour, useTourTarget } from ${JSON.stringify(`${pkg.name}/vue`)}

const onboarding = defineTour({
  id: 'onboarding',
  steps: [{
    id: 'welcome',
    target: 'welcome',
    title: 'Welcome',
    content: 'Packed Vue consumer tour',
  }],
})

const App = defineComponent({
  setup() {
    const tour = useTour(onboarding)
    const target = ref<HTMLButtonElement | null>(null)
    useTourTarget('welcome', target)
    return () => h('button', { ref: target, onClick: () => tour.start() }, 'Start tour')
  },
})

createApp(App)
  .use(createTourPlugin({ tours: [onboarding] }))
  .component('TourHost', TourHost)
`)
}

import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

// Use the workspace's installed build tools. No benchmark-only installation.
const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('vite'))('esbuild')
const { parse, compileScript } = createRequire(require.resolve('vue'))('@vue/compiler-sfc')
const workspace = resolve(import.meta.dirname, '..')
const temporary = await mkdtemp(join(tmpdir(), 'nuxt-tour-bundle-'))

async function measure(source, label) {
  const entry = `export { createTourPlugin, TourHost, defineTour, useTour, useTourTarget } from ${JSON.stringify(join(source, 'src/runtime/vue/index.ts'))}; import ${JSON.stringify(join(source, 'src/runtime/style.css'))};`
  const result = await build({
    stdin: { contents: entry, resolveDir: workspace, loader: 'ts' },
    bundle: true,
    write: false,
    outdir: join(temporary, 'output'),
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    external: ['vue', 'vue/*'],
    nodePaths: [join(workspace, 'node_modules')],
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{
      name: 'vue-sfc',
      setup(builder) {
        builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
          const { descriptor } = parse(await readFile(path, 'utf8'), { filename: path })
          const compiled = compileScript(descriptor, { id: 'bundle-measurement', inlineTemplate: true, isProd: true })
          return { contents: compiled.content, loader: 'ts', resolveDir: dirname(path) }
        })
      },
    }],
  })
  const files = result.outputFiles.map(file => ({
    type: file.path.endsWith('.css') ? 'css' : 'js',
    minifiedBytes: file.contents.length,
    gzipBytes: gzipSync(file.contents).length,
  }))
  return { label, files, totalGzipBytes: files.reduce((total, file) => total + file.gzipBytes, 0) }
}

try {
  const results = []
  if (process.argv.includes('--compare-head')) {
    const baseline = join(temporary, 'baseline')
    const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', 'src'], { cwd: workspace, encoding: 'utf8' }).trim().split('\n')
    for (const path of paths) {
      const destination = join(baseline, path)
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, execFileSync('git', ['show', `HEAD:${path}`], { cwd: workspace }))
    }
    results.push(await measure(baseline, 'HEAD'))
  }
  results.push(await measure(workspace, 'working tree'))
  if (process.argv.includes('--check') && results.at(-1).totalGzipBytes > 30 * 1024) {
    throw new Error('Default Vue UI exceeds the 30 KiB gzip budget, including CSS and runtime dependencies.')
  }
  console.log(JSON.stringify({ framework: 'Vue external; runtime dependencies included; gzip per file', results }, null, 2))
}
finally {
  await rm(temporary, { recursive: true, force: true })
}

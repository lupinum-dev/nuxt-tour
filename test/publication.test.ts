import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

const workflow = parse(await readFile('.github/workflows/publish.yml', 'utf8'))
const record = { name: '@lupinum/nuxt-tour', version: '0.1.2', sourceSha: 'a'.repeat(40), distTag: 'latest' }
const invalidNames = ['../outside.tgz', '/tmp/outside.tgz', 'https://example.com/archive.tgz', '--access=public', 'package', 'nested/archive.tgz', 'nested\\archive.tgz', 'archive.tgz\nother', 'archive.tgz\n', 'archive.tgz\r', '-archive.tgz', '', null, 42]

describe('retained publication boundary', () => {
  it.each(['verify-candidate', 'publish', 'github-release'])('rejects unsafe artifact names before archive use in %s', async (job) => {
    const steps = workflow.jobs[job].steps as { run?: string }[]
    const shell = steps.find(step => step.run?.includes('tarball='))!.run!
    // Execute the actual workflow prefix, stopping at the first archive consumer.
    const boundary = shell.indexOf(job === 'github-release' ? 'prerelease=()' : (job === 'publish' ? 'package_name=' : 'test "$(tar'))
    expect(boundary).toBeGreaterThan(0)
    const prefix = shell.slice(0, boundary).replace('cd release-artifacts\n', '').replace('sha256sum --check --strict SHA256SUMS\n', '')
    const directory = await mkdtemp(join(tmpdir(), 'tour-retained-name-'))
    try {
      for (const filename of ['lupinum-nuxt-tour-0.1.2.tgz', ...invalidNames]) {
        await writeFile(join(directory, 'release.json'), JSON.stringify({ ...record, filename }))
        const result = spawnSync('bash', ['-e', '-c', `${prefix}\nprintf 'archive-boundary-reached'`], {
          cwd: directory,
          encoding: 'utf8',
          env: { ...process.env, RELEASE_VERSION: record.version, GITHUB_SHA: record.sourceSha },
        })
        expect(result.status, String(filename)).toBe(filename === 'lupinum-nuxt-tour-0.1.2.tgz' ? 0 : 1)
        if (result.status === 0) expect(result.stdout).toContain('archive-boundary-reached')
        else expect(result.stderr).toContain('Invalid retained tarball basename')
      }
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  }, 30_000)

  it('checks the actual filename again before invoking npm publish', () => {
    const shell = (workflow.jobs.publish.steps as { run?: string }[]).find(step => step.run?.includes('\'publish\','))!.run!
    const script = shell.split('node --input-type=module <<\'NODE\'\n')[1]!.split('\nNODE')[0]!
    // Run the real publication body with inert npm/fs substitutes. An unsafe name
    // must not reach even npm view; a valid candidate must publish a local tarball.
    for (const filename of ['lupinum-nuxt-tour-0.1.2.tgz', ...invalidNames]) {
      const calls: string[][] = []
      const body = script.replace(/^import .*\n/gm, '').replace('process.exit(0)', 'return')
      const execute = new Function('spawnSync', 'readFileSync', 'appendFileSync', 'process', body)
      const run = () => execute((command: string, args: string[]) => {
        expect(command).toBe('npm')
        calls.push(args)
        const field = args[2]
        const published = calls.some(call => call[0] === 'publish')
        return { status: 0, stdout: JSON.stringify(args[0] === 'publish' ? null : (!published ? null : field === 'dist.shasum' ? 'hash' : field === 'dist.attestations' ? {} : record.version)) }
      }, () => JSON.stringify({ ...record, filename, shasum: 'hash' }), () => {}, { env: { REGISTRY_POLL_ATTEMPTS: '1', REGISTRY_POLL_DELAY_MS: '0' } })
      if (filename === 'lupinum-nuxt-tour-0.1.2.tgz') {
        expect(run).not.toThrow()
        expect(calls.find(call => call[0] === 'publish')?.[1]).toBe(`./${filename}`)
      }
      else {
        expect(run).toThrow('Invalid retained tarball basename')
        expect(calls).toEqual([])
      }
    }
  })
})

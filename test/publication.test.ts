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

  it('publishes one checksum-verified retained tarball directly', () => {
    const shell = (workflow.jobs.publish.steps as { run?: string }[]).find(step => step.run?.includes('npm publish'))!.run!
    const checksum = shell.indexOf('sha256sum --check --strict SHA256SUMS')
    const oneTarball = shell.indexOf('find . -maxdepth 1 -type f -name \'*.tgz\'')
    const publish = shell.indexOf('npm publish release-artifacts/*.tgz')

    expect(checksum).toBeGreaterThan(-1)
    expect(oneTarball).toBeGreaterThan(checksum)
    expect(publish).toBeGreaterThan(oneTarball)
    expect(shell).toContain('--provenance')
    expect(shell).toContain('--ignore-scripts')
  })
})

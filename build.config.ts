export default {
  hooks: {
    'mkdist:entry:options'(_context: unknown, _entry: unknown, options: { esbuild?: { tsconfigRaw?: unknown } }) {
      // Runtime SFC imports can be used only by the template, outside the TS block.
      options.esbuild ??= {}
      options.esbuild.tsconfigRaw = { compilerOptions: { verbatimModuleSyntax: true } }
    },
  },
  entries: [
    {
      builder: 'copy',
      input: 'agent-docs',
      outDir: 'dist/agent',
    },
  ],
}

import { registerAgentMarkdownSerializers } from '@lupinum/ginko-content/agent-registry'
import { defineNitroPlugin } from 'nitropack/runtime'
import sources from '#demo-sources'

const { tourDemoSource, docsdemoSource, tourRecipeGallerySource, recipemediaSource, recipeinteractionSource, recipeprogrammaticSource, recipecenteredSource, tourRecipeMediaPreviewSource, tourRecipeInteractionPreviewSource, tourRecipeProgrammaticPreviewSource, tourRecipeCenteredPreviewSource, recipeRichMediaSource, projectoverviewSource } = sources

function sourceFile(path: string, source: string): string {
  const language = path.endsWith('.vue') ? 'vue' : path.endsWith('.ts') ? 'ts' : 'xml'
  return `### ${path}\n\n\`\`\`\`${language}\n${source.trimEnd()}\n\`\`\`\``
}

export default defineNitroPlugin(() => {
  registerAgentMarkdownSerializers({
    'tour-demo': () => [
      '## Live example source',
      'These are the source files used by this documentation demo. Use the installation guide for module registration. Preserve the listed paths relative to the Nuxt application; public assets stay under public/. The gallery mounts TourHost and its recipe previews. The main demo uses the recipes section as its final target. Install shiki when copying the gallery code display. Icon is supplied by the documentation site; replace it with your icon component or install @nuxt/icon.',
      sourceFile('app/components/content/TourDemo.vue', tourDemoSource),
      sourceFile('app/tours/docs-demo.ts', docsdemoSource),
    ].join('\n\n'),
    'tour-recipe-gallery': () => [
      '## Live example source',
      'These are the source files used by this documentation demo. Use the installation guide for module registration. Preserve the listed paths relative to the Nuxt application; public assets stay under public/. The gallery mounts TourHost and its recipe previews. The main demo uses the recipes section as its final target. Install shiki when copying the gallery code display. Icon is supplied by the documentation site; replace it with your icon component or install @nuxt/icon.',
      sourceFile('app/components/content/TourRecipeGallery.vue', tourRecipeGallerySource),
      sourceFile('app/tours/recipe-media.ts', recipemediaSource),
      sourceFile('app/tours/recipe-interaction.ts', recipeinteractionSource),
      sourceFile('app/tours/recipe-programmatic.ts', recipeprogrammaticSource),
      sourceFile('app/tours/recipe-centered.ts', recipecenteredSource),
      sourceFile('app/components/content/recipes/TourRecipeMediaPreview.vue', tourRecipeMediaPreviewSource),
      sourceFile('app/components/content/recipes/TourRecipeInteractionPreview.vue', tourRecipeInteractionPreviewSource),
      sourceFile('app/components/content/recipes/TourRecipeProgrammaticPreview.vue', tourRecipeProgrammaticPreviewSource),
      sourceFile('app/components/content/recipes/TourRecipeCenteredPreview.vue', tourRecipeCenteredPreviewSource),
      sourceFile('app/components/tours/RecipeRichMedia.vue', recipeRichMediaSource),
      sourceFile('public/recipes/project-overview.svg', projectoverviewSource),
    ].join('\n\n'),
  })
})

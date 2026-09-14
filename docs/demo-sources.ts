import { readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'

export const demoFiles = {
  tourDemoSource: 'app/components/content/TourDemo.vue',
  docsdemoSource: 'app/tours/docs-demo.ts',
  tourRecipeGallerySource: 'app/components/content/TourRecipeGallery.vue',
  recipemediaSource: 'app/tours/recipe-media.ts',
  recipeinteractionSource: 'app/tours/recipe-interaction.ts',
  recipeprogrammaticSource: 'app/tours/recipe-programmatic.ts',
  recipecenteredSource: 'app/tours/recipe-centered.ts',
  tourRecipeMediaPreviewSource: 'app/components/content/recipes/TourRecipeMediaPreview.vue',
  tourRecipeInteractionPreviewSource: 'app/components/content/recipes/TourRecipeInteractionPreview.vue',
  tourRecipeProgrammaticPreviewSource: 'app/components/content/recipes/TourRecipeProgrammaticPreview.vue',
  tourRecipeCenteredPreviewSource: 'app/components/content/recipes/TourRecipeCenteredPreview.vue',
  recipeRichMediaSource: 'app/components/tours/RecipeRichMedia.vue',
  projectoverviewSource: 'public/recipes/project-overview.svg',
} as const

export function demoSourceModule(): string {
  const sources = Object.fromEntries(Object.entries(demoFiles).map(([name, file]) => [
    name, readFileSync(new URL(file, import.meta.url), 'utf8'),
  ]))
  // Encode literal source so Nitro cannot rewrite import.meta or process.env inside examples.
  const encoded = Buffer.from(JSON.stringify(sources)).toString('base64')
  return `import { Buffer } from 'node:buffer'; export default JSON.parse(Buffer.from('${encoded}', 'base64').toString('utf8'))`
}

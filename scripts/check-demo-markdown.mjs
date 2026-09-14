import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const examples = {
  'docs/getting-started.md': [
    'app/components/content/TourDemo.vue',
    'app/tours/docs-demo.ts',
  ],
  'docs/recipes.md': [
    'app/components/content/TourRecipeGallery.vue',
    'app/tours/recipe-media.ts',
    'app/tours/recipe-interaction.ts',
    'app/tours/recipe-programmatic.ts',
    'app/tours/recipe-centered.ts',
    'app/components/content/recipes/TourRecipeMediaPreview.vue',
    'app/components/content/recipes/TourRecipeInteractionPreview.vue',
    'app/components/content/recipes/TourRecipeProgrammaticPreview.vue',
    'app/components/content/recipes/TourRecipeCenteredPreview.vue',
    'app/components/tours/RecipeRichMedia.vue',
    'public/recipes/project-overview.svg',
  ],
}

for (const [route, files] of Object.entries(examples)) {
  const markdown = readFileSync(new URL(`../docs/.output/public/raw/${route}`, import.meta.url), 'utf8')
  assert(!markdown.includes('Component omitted:'), `${route}: missing demo serializer`)
  for (const file of files) {
    const source = readFileSync(new URL(`../docs/${file}`, import.meta.url), 'utf8').trimEnd()
    assert(markdown.includes(source), `${route}: missing or stale source ${file}`)
  }
}
console.log('Rendered demo Markdown contains the current executable source files.')

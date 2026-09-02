<script setup lang="ts">
import { markRaw, useId } from 'vue'
import TourRecipeCenteredPreview from './recipes/TourRecipeCenteredPreview.vue'
import TourRecipeInteractionPreview from './recipes/TourRecipeInteractionPreview.vue'
import TourRecipeMediaPreview from './recipes/TourRecipeMediaPreview.vue'
import TourRecipeProgrammaticPreview from './recipes/TourRecipeProgrammaticPreview.vue'

const copied = ref(false)
const errorMessage = ref('')
const closingScriptTag = '</' + 'script>'
const runtimeConfig = useRuntimeConfig()
const regionId = useId()

const recipes = {
  media: {
    controller: useNuxtTour('recipe-media'),
    preview: markRaw(TourRecipeMediaPreview),
    label: 'Rich media',
    icon: 'lucide:image',
    description: 'Render an image, video, or live Vue component inside the default card.',
    language: 'ts',
    code: `import ProjectOverview from '~/components/tours/ProjectOverview.vue'

export default defineTour({
  id: 'onboarding',
  steps: [{
    id: 'overview',
    target: 'project-overview',
    title: 'Your project overview',
    content: ProjectOverview,
  }],
})`,
  },
  interaction: {
    controller: useNuxtTour('recipe-interaction'),
    preview: markRaw(TourRecipeInteractionPreview),
    label: 'Live controls',
    icon: 'lucide:mouse-pointer-click',
    description: 'Keep the highlighted control usable while the rest of the page stays protected.',
    language: 'ts',
    code: `{
  id: 'filters',
  target: 'project-filters',
  title: 'Narrow the list',
  content: 'Try the filters now.',
  interaction: 'target',
}`,
  },
  programmatic: {
    controller: useNuxtTour('recipe-programmatic'),
    preview: markRaw(TourRecipeProgrammaticPreview),
    label: 'Vue refs',
    icon: 'lucide:component',
    description: 'Register a semantic target from a component ref when a directive does not fit.',
    language: 'vue',
    code: `<script setup lang="ts">
const createButton = useTemplateRef('createButton')
useTourTarget('create-project', createButton)
${closingScriptTag}

<template>
  <AppButton ref="createButton">Create project</AppButton>
</template>`,
  },
  centered: {
    controller: useNuxtTour('recipe-centered'),
    preview: markRaw(TourRecipeCenteredPreview),
    label: 'Announcements',
    icon: 'lucide:party-popper',
    description: 'Omit the target for a deliberate welcome, checkpoint, or completion step.',
    language: 'ts',
    code: `{
  id: 'complete',
  ariaLabel: 'Setup complete',
  content: CompletionMessage,
}`,
  },
} as const

type RecipeId = keyof typeof recipes

const activeId = ref<RecipeId>('media')
const activeRecipe = computed(() => recipes[activeId.value])
const pending = computed(() => Object.values(recipes).some(recipe => recipe.controller.pending.value))

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }

function plainLines(code: string): string {
  return code
    .split('\n')
    .map(line => `<span class="line">${line.replace(/[&<>]/g, character => HTML_ESCAPES[character] ?? character)}</span>`)
    .join('')
}

// Recipe code is a local static string, so it does not pass through Nuxt Content's
// build-time highlighter. Highlight every recipe once with the configured themes.
const { data: highlightedRecipes } = await useAsyncData(`tour-recipes-${regionId}`, async () => {
  const { codeToHast, hastToHtml } = await import('shiki')
  const configuredThemes = runtimeConfig.public.ginkoDocs?.syntaxHighlighting?.themes
  const themes = {
    light: configuredThemes?.light ?? 'light-plus',
    dark: configuredThemes?.dark ?? 'dark-plus',
  }

  return Object.fromEntries(await Promise.all(
    Object.entries(recipes).map(async ([id, recipe]) => {
      try {
        const root = await codeToHast(recipe.code, { lang: recipe.language, themes })
        const pre = root.children.find(node => node.type === 'element')
        const code = pre?.children.find(node => node.type === 'element')
        const highlightedCode = code
          ? hastToHtml({
              type: 'root' as const,
              children: code.children.filter(node => node.type !== 'text' || node.value !== '\n'),
            })
          : plainLines(recipe.code)

        return [id, highlightedCode]
      }
      catch {
        return [id, plainLines(recipe.code)]
      }
    }),
  ))
})

const activeHighlightedCode = computed(() =>
  highlightedRecipes.value?.[activeId.value] ?? plainLines(activeRecipe.value.code),
)

async function selectRecipe(id: RecipeId): Promise<void> {
  const current = activeRecipe.value.controller
  if (current.isActive.value) await current.cancel('recipe-changed')
  activeId.value = id
  copied.value = false
  errorMessage.value = ''
}

async function startRecipe(): Promise<void> {
  errorMessage.value = ''
  try {
    await activeRecipe.value.controller.start({ replace: true })
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The recipe could not start.'
  }
}

async function copyRecipe(): Promise<void> {
  await navigator.clipboard.writeText(activeRecipe.value.code)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1800)
}
</script>

<template>
  <section
    class="recipe-lab"
    aria-labelledby="recipe-lab-title"
  >
    <header class="recipe-heading">
      <div>
        <h2 id="recipe-lab-title">
          Learn by running the real thing
        </h2>
        <p>Select a pattern, start its tour, and inspect the code that powers it.</p>
      </div>
      <span class="recipe-runtime">
        <span aria-hidden="true" />
        Actual Nuxt Tour runtime
      </span>
    </header>

    <div class="recipe-shell">
      <nav aria-label="Interactive tour recipes">
        <button
          v-for="(recipe, id) in recipes"
          :key="id"
          type="button"
          :aria-current="activeId === id ? 'true' : undefined"
          :disabled="pending"
          @click="selectRecipe(id)"
        >
          <Icon
            :name="recipe.icon"
            aria-hidden="true"
          />
          <span>
            <strong>{{ recipe.label }}</strong>
            <small>{{ recipe.description }}</small>
          </span>
          <Icon
            name="lucide:chevron-right"
            class="recipe-chevron"
            aria-hidden="true"
          />
        </button>
      </nav>

      <div class="recipe-workspace">
        <div class="recipe-stage-toolbar">
          <div>
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </div>
          <p>recipe-preview.vue</p>
          <button
            type="button"
            :disabled="pending"
            @click="startRecipe"
          >
            <Icon
              name="lucide:play"
              aria-hidden="true"
            />
            Run recipe
          </button>
        </div>

        <div class="recipe-stage">
          <component :is="activeRecipe.preview" />
        </div>

        <details class="recipe-code">
          <summary>
            <span>View the recipe code</span>
            <Icon
              name="lucide:chevron-down"
              aria-hidden="true"
            />
          </summary>
          <div
            class="shiki"
            data-fd-codeblock
          >
            <button
              type="button"
              @click="copyRecipe"
            >
              <Icon
                :name="copied ? 'lucide:check' : 'lucide:copy'"
                aria-hidden="true"
              />
              {{ copied ? 'Copied' : 'Copy' }}
            </button>
            <!-- Shiki output is generated exclusively from the static recipes above. -->
            <!-- eslint-disable vue/no-v-html -->
            <pre><code v-html="activeHighlightedCode" /></pre>
            <!-- eslint-enable vue/no-v-html -->
          </div>
        </details>
      </div>
    </div>

    <p
      v-if="errorMessage"
      class="recipe-error"
      role="alert"
    >
      {{ errorMessage }}
    </p>
    <p
      class="sr-only"
      aria-live="polite"
    >
      {{ copied ? 'Recipe code copied.' : '' }}
    </p>
    <TourHost />
  </section>
</template>

<style scoped>
.recipe-lab {
  --recipe-accent: var(--brand);
  margin-block: 2.5rem;
  color: var(--foreground);
}

.recipe-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 2rem;
  margin-block-end: 1.5rem;
}

.recipe-heading h2 {
  margin: 0;
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  line-height: 1.08;
  letter-spacing: -0.03em;
  text-wrap: balance;
}

.recipe-heading p {
  max-width: 42rem;
  margin: 0.65rem 0 0;
  color: var(--muted-foreground);
  line-height: 1.65;
}

.recipe-runtime {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 0.5rem;
  color: var(--muted-foreground);
  font-size: 0.78rem;
  font-weight: 650;
}

.recipe-runtime > span {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: var(--nuxt-green-400);
  box-shadow: 0 0.25rem 0.75rem rgb(0 220 130 / 28%);
}

.recipe-shell {
  display: grid;
  grid-template-columns: minmax(14rem, 0.7fr) minmax(0, 1.55fr);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--background);
}

.recipe-shell > nav {
  display: grid;
  align-content: start;
  padding: 0.75rem;
  border-inline-end: 1px solid var(--border);
  background: color-mix(in srgb, var(--muted) 55%, var(--background));
}

.recipe-shell > nav button {
  display: grid;
  min-height: 5.25rem;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.75rem;
  padding: 0.9rem;
  border: 0;
  border-radius: 0.75rem;
  background: transparent;
  color: var(--foreground);
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.recipe-shell > nav button[aria-current='true'] {
  background: var(--background);
  box-shadow: 0 0.5rem 1.5rem rgb(15 23 42 / 8%);
}

.recipe-shell > nav button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.recipe-shell > nav button > svg:first-child {
  width: 1.1rem;
  height: 1.1rem;
  margin-top: 0.15rem;
  color: var(--recipe-accent);
}

.recipe-shell > nav strong,
.recipe-shell > nav small {
  display: block;
}

.recipe-shell > nav strong {
  font-size: 0.9rem;
}

.recipe-shell > nav small {
  margin-top: 0.25rem;
  color: var(--muted-foreground);
  font-size: 0.75rem;
  line-height: 1.45;
}

.recipe-chevron {
  width: 0.9rem;
  height: 0.9rem;
  margin-top: 0.2rem;
  color: var(--muted-foreground);
}

.recipe-workspace {
  min-width: 0;
}

.recipe-stage-toolbar {
  display: grid;
  min-height: 3.25rem;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  padding-inline: 1rem;
  border-block-end: 1px solid var(--border);
}

.recipe-stage-toolbar > div {
  display: flex;
  gap: 0.35rem;
}

.recipe-stage-toolbar > div span {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: var(--border);
}

.recipe-stage-toolbar p {
  margin: 0;
  color: var(--muted-foreground);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.68rem;
}

.recipe-stage-toolbar > button,
:deep(.programmatic-preview button) {
  display: inline-flex;
  min-height: 2.25rem;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  justify-self: end;
  padding: 0.45rem 0.75rem;
  border: 0;
  border-radius: 0.625rem;
  background: var(--recipe-accent);
  color: var(--brand-foreground);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.recipe-stage-toolbar > button svg {
  width: 0.85rem;
  height: 0.85rem;
}

.recipe-stage-toolbar > button:disabled {
  cursor: wait;
  opacity: 0.55;
}

.recipe-stage {
  display: grid;
  min-height: 23rem;
  padding: clamp(1.25rem, 5vw, 3.5rem);
  background: color-mix(in srgb, var(--muted) 35%, var(--background));
  place-items: center;
}

:deep(.media-preview) {
  width: min(100%, 25rem);
  overflow: hidden;
  border-radius: 0.875rem;
  background: var(--background);
  box-shadow: 0 1rem 2.5rem rgb(15 23 42 / 15%);
}

:deep(.media-preview img) {
  display: block;
  width: 100%;
  height: auto;
}

:deep(.media-preview > div) {
  display: grid;
  gap: 0.2rem;
  padding: 1rem;
}

:deep(.media-preview span),
:deep(.interaction-preview p),
:deep(.programmatic-preview p),
:deep(.centered-preview p) {
  color: var(--muted-foreground);
  font-size: 0.82rem;
}

:deep(.interaction-preview),
:deep(.programmatic-preview),
:deep(.centered-preview) {
  width: min(100%, 24rem);
  text-align: center;
}

:deep(.interaction-preview > p),
:deep(.programmatic-preview p),
:deep(.centered-preview p) {
  margin: 0;
}

:deep(.filter-control) {
  display: inline-flex;
  gap: 0.25rem;
  margin-block: 1.5rem;
  padding: 0.25rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--background);
}

:deep(.filter-control button) {
  min-height: 2.5rem;
  padding-inline: 0.9rem;
  border: 0;
  border-radius: 0.55rem;
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 650;
  cursor: pointer;
}

:deep(.filter-control button[aria-pressed='true']) {
  background: var(--recipe-accent);
  color: var(--brand-foreground);
}

:deep(.programmatic-preview > svg) {
  width: 2rem;
  height: 2rem;
  margin-block-end: 1rem;
  color: var(--recipe-accent);
}

:deep(.programmatic-preview button) {
  margin: 1.5rem auto 0;
  justify-self: auto;
}

:deep(.centered-preview > span) {
  display: inline-grid;
  width: 3rem;
  height: 3rem;
  margin-block-end: 1rem;
  border-radius: 999px;
  background: var(--recipe-accent);
  color: var(--brand-foreground);
  place-items: center;
}

:deep(.centered-preview > span svg) {
  width: 1.35rem;
  height: 1.35rem;
}

:deep(.centered-preview strong) {
  display: block;
  margin-block-end: 0.35rem;
  font-size: 1.15rem;
}

.recipe-code {
  border-block-start: 1px solid var(--border);
}

.recipe-code summary {
  display: flex;
  min-height: 3.25rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-inline: 1rem;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  list-style: none;
}

.recipe-code summary::-webkit-details-marker {
  display: none;
}

.recipe-code summary svg {
  width: 1rem;
  height: 1rem;
  transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.recipe-code[open] summary svg {
  transform: rotate(180deg);
}

.recipe-code > div {
  position: relative;
  border-block-start: 1px solid var(--border);
  background: var(--code);
  color: var(--code-foreground);
}

.recipe-code > div > button {
  position: absolute;
  inset-block-start: 0.75rem;
  inset-inline-end: 0.75rem;
  display: inline-flex;
  min-height: 2rem;
  align-items: center;
  gap: 0.35rem;
  padding-inline: 0.6rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--secondary);
  color: var(--secondary-foreground);
  font: inherit;
  font-size: 0.7rem;
  font-weight: 700;
  cursor: pointer;
}

.recipe-code > div > button svg {
  width: 0.8rem;
  height: 0.8rem;
}

.recipe-code pre {
  overflow-x: auto;
  margin: 0;
  padding: 1.25rem;
  padding-inline-end: 5rem;
  font-size: 0.72rem;
  line-height: 1.65;
  scrollbar-color: var(--muted-foreground) var(--code);
}

.recipe-error {
  margin: 0.75rem 0 0;
  color: var(--destructive);
  font-size: 0.85rem;
}

.recipe-lab :is(button, summary):focus-visible,
.recipe-lab :deep(button:focus-visible) {
  outline: 3px solid var(--ring);
  outline-offset: 3px;
}

@media (hover: hover) and (pointer: fine) {
  .recipe-shell > nav button:hover:not([aria-current='true']):not(:disabled),
  .recipe-code summary:hover {
    background: color-mix(in srgb, var(--muted) 75%, var(--background));
  }

  .recipe-stage-toolbar > button:hover:not(:disabled),
  :deep(.programmatic-preview button:hover) {
    background: var(--recipe-accent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--foreground) 16%, transparent);
  }
}

@media (max-width: 48rem) {
  .recipe-heading {
    display: block;
  }

  .recipe-runtime {
    margin-block-start: 1rem;
  }

  .recipe-shell {
    grid-template-columns: 1fr;
  }

  .recipe-shell > nav {
    grid-template-columns: repeat(4, minmax(8.5rem, 1fr));
    overflow-x: auto;
    border-inline-end: 0;
    border-block-end: 1px solid var(--border);
    scrollbar-color: var(--border) transparent;
  }

  .recipe-shell > nav button {
    min-height: 4.25rem;
  }

  .recipe-shell > nav small,
  .recipe-chevron {
    display: none;
  }
}

@media (max-width: 32rem) {
  .recipe-shell > nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow-x: visible;
  }

  .recipe-shell > nav button {
    min-width: 0;
    grid-template-columns: auto minmax(0, 1fr);
  }

  .recipe-stage-toolbar {
    grid-template-columns: auto 1fr;
  }

  .recipe-stage-toolbar p {
    display: none;
  }

  .recipe-stage {
    min-height: 19rem;
    padding: 1.25rem;
  }

  .recipe-code pre {
    padding-inline-end: 1.25rem;
  }

  .recipe-code > div > button {
    position: static;
    margin: 0.75rem 0.75rem 0;
  }
}

@media (prefers-color-scheme: dark) {
  .recipe-shell > nav button[aria-current='true'],
  :deep(.media-preview) {
    box-shadow: 0 1rem 2.5rem rgb(0 0 0 / 32%);
  }
}
</style>

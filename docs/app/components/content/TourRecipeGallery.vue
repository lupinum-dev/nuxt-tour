<script setup lang="ts">
type RecipeId = 'media' | 'interaction' | 'programmatic' | 'centered'

const mediaTour = useNuxtTour('recipe-media')
const interactionTour = useNuxtTour('recipe-interaction')
const programmaticTour = useNuxtTour('recipe-programmatic')
const centeredTour = useNuxtTour('recipe-centered')
const activeId = ref<RecipeId>('media')
const activeFilter = ref<'all' | 'at-risk'>('all')
const programmaticTarget = useTemplateRef<HTMLButtonElement>('programmaticTarget')
const copied = ref(false)
const errorMessage = ref('')
const closingScriptTag = '</' + 'script>'

useTourTarget('recipe-programmatic-target', programmaticTarget)

const recipes = {
  media: {
    label: 'Rich media',
    icon: 'lucide:image',
    description: 'Render an image, video, or live Vue component inside the default card.',
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
    label: 'Live controls',
    icon: 'lucide:mouse-pointer-click',
    description: 'Keep the highlighted control usable while the rest of the page stays protected.',
    code: `{
  id: 'filters',
  target: 'project-filters',
  title: 'Narrow the list',
  content: 'Try the filters now.',
  interaction: 'target',
}`,
  },
  programmatic: {
    label: 'Vue refs',
    icon: 'lucide:component',
    description: 'Register a semantic target from a component ref when a directive does not fit.',
    code: `<script setup lang="ts">
const createButton = useTemplateRef('createButton')
useTourTarget('create-project', createButton)
${closingScriptTag}

<template>
  <AppButton ref="createButton">Create project</AppButton>
</template>`,
  },
  centered: {
    label: 'Announcements',
    icon: 'lucide:party-popper',
    description: 'Omit the target for a deliberate welcome, checkpoint, or completion step.',
    code: `{
  id: 'complete',
  ariaLabel: 'Setup complete',
  content: CompletionMessage,
}`,
  },
} as const

const activeRecipe = computed(() => recipes[activeId.value])
const pending = computed(() => (
  mediaTour.pending.value
  || interactionTour.pending.value
  || programmaticTour.pending.value
  || centeredTour.pending.value
))

function controllerFor(id: RecipeId) {
  if (id === 'media') return mediaTour
  if (id === 'interaction') return interactionTour
  if (id === 'programmatic') return programmaticTour
  return centeredTour
}

async function selectRecipe(id: RecipeId): Promise<void> {
  const current = controllerFor(activeId.value)
  if (current.isActive.value) await current.cancel('recipe-changed')
  activeId.value = id
  copied.value = false
  errorMessage.value = ''
}

async function startRecipe(): Promise<void> {
  errorMessage.value = ''
  try {
    await controllerFor(activeId.value).start({ replace: true })
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
          <article
            v-if="activeId === 'media'"
            v-tour-target="'recipe-media-target'"
            class="media-preview"
          >
            <img
              src="/recipes/habitat-overview.svg"
              width="640"
              height="360"
              alt="Habitat restoration dashboard preview"
            >
            <div>
              <strong>Wetland restoration</strong>
              <span>68% complete · 3 active areas</span>
            </div>
          </article>

          <div
            v-else-if="activeId === 'interaction'"
            class="interaction-preview"
          >
            <p>Project health</p>
            <div
              v-tour-target="'recipe-interaction-target'"
              class="filter-control"
              aria-label="Filter project health"
            >
              <button
                type="button"
                :aria-pressed="activeFilter === 'all'"
                @click="activeFilter = 'all'"
              >
                All
              </button>
              <button
                type="button"
                :aria-pressed="activeFilter === 'at-risk'"
                @click="activeFilter = 'at-risk'"
              >
                At risk
              </button>
            </div>
            <strong>{{ activeFilter === 'all' ? '12 projects' : '3 projects need attention' }}</strong>
          </div>

          <div
            v-else-if="activeId === 'programmatic'"
            class="programmatic-preview"
          >
            <Icon
              name="lucide:braces"
              aria-hidden="true"
            />
            <p>The button below is registered from its Vue ref.</p>
            <button
              ref="programmaticTarget"
              type="button"
            >
              Create project
            </button>
          </div>

          <div
            v-else
            class="centered-preview"
          >
            <span>
              <Icon
                name="lucide:check"
                aria-hidden="true"
              />
            </span>
            <strong>Setup complete</strong>
            <p>This recipe intentionally has no target.</p>
          </div>
        </div>

        <details class="recipe-code">
          <summary>
            <span>View the recipe code</span>
            <Icon
              name="lucide:chevron-down"
              aria-hidden="true"
            />
          </summary>
          <div>
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
            <pre><code>{{ activeRecipe.code }}</code></pre>
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
  --recipe-accent: #0f766e;
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
  background: #10b981;
  box-shadow: 0 0.25rem 0.75rem rgb(16 185 129 / 35%);
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
.programmatic-preview button {
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
  color: white;
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

.media-preview {
  width: min(100%, 25rem);
  overflow: hidden;
  border-radius: 0.875rem;
  background: var(--background);
  box-shadow: 0 1rem 2.5rem rgb(15 23 42 / 15%);
}

.media-preview img {
  display: block;
  width: 100%;
  height: auto;
}

.media-preview > div {
  display: grid;
  gap: 0.2rem;
  padding: 1rem;
}

.media-preview span,
.interaction-preview p,
.programmatic-preview p,
.centered-preview p {
  color: var(--muted-foreground);
  font-size: 0.82rem;
}

.interaction-preview,
.programmatic-preview,
.centered-preview {
  width: min(100%, 24rem);
  text-align: center;
}

.interaction-preview > p,
.programmatic-preview p,
.centered-preview p {
  margin: 0;
}

.filter-control {
  display: inline-flex;
  gap: 0.25rem;
  margin-block: 1.5rem;
  padding: 0.25rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--background);
}

.filter-control button {
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

.filter-control button[aria-pressed='true'] {
  background: var(--recipe-accent);
  color: white;
}

.programmatic-preview > svg {
  width: 2rem;
  height: 2rem;
  margin-block-end: 1rem;
  color: var(--recipe-accent);
}

.programmatic-preview button {
  margin: 1.5rem auto 0;
  justify-self: auto;
}

.centered-preview > span {
  display: inline-grid;
  width: 3rem;
  height: 3rem;
  margin-block-end: 1rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--recipe-accent) 16%, transparent);
  color: var(--recipe-accent);
  place-items: center;
}

.centered-preview > span svg {
  width: 1.35rem;
  height: 1.35rem;
}

.centered-preview strong {
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
  background: #0f172a;
  color: #e2e8f0;
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
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 0.5rem;
  background: #1e293b;
  color: #f8fafc;
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
  scrollbar-color: #475569 #0f172a;
}

.recipe-error {
  margin: 0.75rem 0 0;
  color: var(--destructive);
  font-size: 0.85rem;
}

.recipe-lab :is(button, summary):focus-visible {
  outline: 3px solid var(--ring);
  outline-offset: 3px;
}

@media (hover: hover) and (pointer: fine) {
  .recipe-shell > nav button:hover:not([aria-current='true']):not(:disabled),
  .recipe-code summary:hover {
    background: color-mix(in srgb, var(--muted) 75%, var(--background));
  }

  .recipe-stage-toolbar > button:hover:not(:disabled),
  .programmatic-preview button:hover {
    background: #115e59;
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
  .recipe-lab {
    --recipe-accent: #5eead4;
  }

  .recipe-shell > nav button[aria-current='true'],
  .media-preview {
    box-shadow: 0 1rem 2.5rem rgb(0 0 0 / 32%);
  }
}

:global(.dark) .recipe-lab,
:global([data-theme='dark']) .recipe-lab {
  --recipe-accent: #5eead4;
}

:global(.light) .recipe-lab,
:global([data-theme='light']) .recipe-lab {
  --recipe-accent: #0f766e;
}
</style>

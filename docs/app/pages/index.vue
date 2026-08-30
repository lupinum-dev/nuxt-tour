<script setup lang="ts">
defineOptions({ name: 'TourLandingPage' })

const tour = useNuxtTour('docs-demo')
const copied = ref(false)
const errorMessage = ref('')
const installCommand = 'pnpm add @lupinum/nuxt-tour'
const codeExample = defineTour({
  id: 'onboarding',
  steps: [{
    id: 'create-project',
    route: '/projects',
    target: 'new-project',
    title: 'Create your first project',
    content: 'Start here to create a project and invite your team.',
  }],
})

useSeoMeta({
  title: 'Nuxt Tour — Guided tours that feel native to Nuxt',
  description: 'Build accessible, route-aware product tours with a Vue-native API and Nuxt-first developer experience.',
  ogTitle: 'Nuxt Tour',
  ogDescription: 'Guided tours that feel native to Nuxt. Try the real runtime in the interactive demo.',
})

async function startDemo(): Promise<void> {
  errorMessage.value = ''
  try {
    await tour.start({ replace: true })
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The demo could not start.'
  }
}

async function copyInstall(): Promise<void> {
  await navigator.clipboard.writeText(installCommand)
  copied.value = true
  window.setTimeout(() => {
    copied.value = false
  }, 1800)
}
</script>

<template>
  <main class="landing">
    <section class="hero">
      <div class="hero-copy">
        <h1>Show people around. Keep Nuxt feeling like Nuxt.</h1>
        <p>
          Accessible, route-aware product tours with typed definitions, semantic targets, and defaults you can trust.
        </p>
        <div class="hero-actions">
          <button
            type="button"
            class="hero-primary"
            @click="startDemo"
          >
            <Icon
              name="lucide:play"
              aria-hidden="true"
            />
            Try the live tour
          </button>
          <NuxtLink
            to="/docs"
            class="hero-secondary"
          >
            Read the guide
            <Icon
              name="lucide:arrow-right"
              aria-hidden="true"
            />
          </NuxtLink>
        </div>
        <button
          type="button"
          class="install-command"
          @click="copyInstall"
        >
          <span aria-hidden="true">$</span>
          <code>{{ installCommand }}</code>
          <Icon
            :name="copied ? 'lucide:check' : 'lucide:copy'"
            aria-hidden="true"
          />
          <span class="sr-only">{{ copied ? 'Copied' : 'Copy install command' }}</span>
        </button>
        <p
          v-if="errorMessage"
          class="hero-error"
          role="alert"
        >
          {{ errorMessage }}
        </p>
      </div>

      <div
        class="hero-proof"
        aria-label="Nuxt Tour qualities"
      >
        <div>
          <Icon
            name="lucide:route"
            aria-hidden="true"
          />
          <strong>Route-aware</strong>
          <span>Waits for Nuxt navigation and late targets.</span>
        </div>
        <div>
          <Icon
            name="lucide:braces"
            aria-hidden="true"
          />
          <strong>Fully typed</strong>
          <span>Tour and step IDs inferred from app/tours.</span>
        </div>
        <div>
          <Icon
            name="lucide:accessibility"
            aria-hidden="true"
          />
          <strong>Accessible</strong>
          <span>Focus, keyboard, contrast, and motion handled.</span>
        </div>
      </div>
    </section>

    <section class="demo-section">
      <TourDemo />
    </section>

    <section
      v-tour-target="'demo-recipes'"
      class="recipe-section"
    >
      <div>
        <h2>From first tour to product-ready patterns.</h2>
        <p>
          Run focused recipes for rich media, live controls, Vue refs, route changes, conditional steps, and custom cards.
        </p>
        <NuxtLink to="/docs/recipes">
          Open the interactive recipe lab
          <Icon
            name="lucide:arrow-right"
            aria-hidden="true"
          />
        </NuxtLink>
      </div>
      <ul aria-label="Available recipe topics">
        <li>
          <Icon
            name="lucide:image"
            aria-hidden="true"
          />
          Images and Vue components
        </li>
        <li>
          <Icon
            name="lucide:route"
            aria-hidden="true"
          />
          Routes and dynamic targets
        </li>
        <li>
          <Icon
            name="lucide:mouse-pointer-click"
            aria-hidden="true"
          />
          Interaction and focus
        </li>
        <li>
          <Icon
            name="lucide:palette"
            aria-hidden="true"
          />
          Themes and custom cards
        </li>
      </ul>
    </section>

    <section class="api-section">
      <div>
        <h2>Small API. Serious runtime.</h2>
        <p>
          Define the journey once. Nuxt discovers it, generates the types, registers the host, and handles navigation.
        </p>
        <NuxtLink to="/docs/design/public-api">
          Explore the complete API
          <Icon
            name="lucide:arrow-right"
            aria-hidden="true"
          />
        </NuxtLink>
      </div>
      <pre aria-label="Nuxt Tour code example"><code><span class="code-muted">// app/tours/onboarding.ts</span>
<span class="code-keyword">export default</span> defineTour({
  id: <span class="code-string">'{{ codeExample.id }}'</span>,
  steps: [{
    id: <span class="code-string">'{{ codeExample.steps[0].id }}'</span>,
    route: <span class="code-string">'{{ codeExample.steps[0].route }}'</span>,
    target: <span class="code-string">'{{ codeExample.steps[0].target }}'</span>,
    title: <span class="code-string">'{{ codeExample.steps[0].title }}'</span>,
    content: <span class="code-string">'{{ codeExample.steps[0].content }}'</span>,
  }],
})</code></pre>
    </section>
  </main>
</template>

<style scoped>
.landing {
  overflow: hidden;
  color: var(--foreground);
}

.hero,
.demo-section,
.recipe-section,
.api-section {
  width: min(100% - 2.5rem, 72rem);
  margin-inline: auto;
}

.hero {
  display: grid;
  min-height: 36rem;
  grid-template-columns: minmax(0, 1.3fr) minmax(17rem, 0.7fr);
  align-items: center;
  gap: clamp(3rem, 8vw, 7rem);
  padding-block: clamp(4.5rem, 8vw, 6.5rem);
}

.hero h1 {
  max-width: 12ch;
  margin: 0;
  font-size: clamp(3.25rem, 7vw, 6rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
  text-wrap: balance;
}

.hero-copy > p {
  max-width: 40rem;
  margin: 1.75rem 0 0;
  color: var(--muted-foreground);
  font-size: clamp(1.05rem, 2vw, 1.25rem);
  line-height: 1.7;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 2rem;
}

.hero-primary,
.hero-secondary {
  display: inline-flex;
  min-height: 2.875rem;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  padding: 0.7rem 1.05rem;
  border-radius: 0.75rem;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 140ms ease, transform 140ms cubic-bezier(0.19, 1, 0.22, 1);
  touch-action: manipulation;
}

.hero-primary {
  border: 0;
  background: var(--primary);
  color: var(--primary-foreground);
}

.hero-secondary {
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--foreground);
}

.hero-primary svg,
.hero-secondary svg {
  width: 1rem;
  height: 1rem;
}

.hero-primary:active,
.hero-secondary:active {
  transform: scale(0.97);
}

.install-command {
  display: inline-flex;
  max-width: 100%;
  min-height: 2.5rem;
  align-items: center;
  gap: 0.65rem;
  margin-top: 1rem;
  padding: 0.45rem 0.7rem;
  border: 0;
  border-radius: 0.625rem;
  background: var(--muted);
  color: var(--muted-foreground);
  font: inherit;
  cursor: pointer;
}

.install-command code {
  overflow: hidden;
  color: var(--foreground);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.install-command svg {
  width: 0.875rem;
  height: 0.875rem;
}

.hero-error {
  color: var(--destructive) !important;
  font-size: 0.875rem !important;
}

.hero-proof {
  display: grid;
  gap: 0;
  border-block: 1px solid var(--border);
}

.hero-proof > div {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.2rem 0.9rem;
  padding: 1.4rem 0;
  border-bottom: 1px solid var(--border);
}

.hero-proof > div:last-child {
  border-bottom: 0;
}

.hero-proof svg {
  width: 1.1rem;
  height: 1.1rem;
  grid-row: span 2;
  margin-top: 0.15rem;
  color: var(--primary);
}

.hero-proof strong {
  font-size: 0.875rem;
}

.hero-proof span {
  color: var(--muted-foreground);
  font-size: 0.78rem;
  line-height: 1.5;
}

.demo-section {
  padding-block: 1rem clamp(6rem, 11vw, 9rem);
}

.recipe-section {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 0.9fr);
  align-items: center;
  gap: clamp(3rem, 8vw, 7rem);
  padding-block: clamp(5rem, 9vw, 8rem);
  border-top: 1px solid var(--border);
}

.recipe-section h2 {
  max-width: 15ch;
  margin: 0;
  font-size: clamp(2.25rem, 5vw, 4rem);
  line-height: 1;
  letter-spacing: -0.04em;
  text-wrap: balance;
}

.recipe-section p {
  max-width: 40rem;
  margin: 1.25rem 0 0;
  color: var(--muted-foreground);
  line-height: 1.7;
}

.recipe-section a {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 1.5rem;
  color: var(--foreground);
  font-size: 0.875rem;
  font-weight: 700;
  text-underline-offset: 0.25rem;
}

.recipe-section a svg {
  width: 1rem;
}

.recipe-section ul {
  margin: 0;
  padding: 0;
  border-block: 1px solid var(--border);
  list-style: none;
}

.recipe-section li {
  display: flex;
  min-height: 3.75rem;
  align-items: center;
  gap: 0.8rem;
  border-block-end: 1px solid var(--border);
  font-size: 0.875rem;
  font-weight: 650;
}

.recipe-section li:last-child {
  border-block-end: 0;
}

.recipe-section li svg {
  width: 1rem;
  height: 1rem;
  color: var(--primary);
}

.api-section {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(25rem, 1.2fr);
  align-items: center;
  gap: clamp(3rem, 8vw, 7rem);
  padding-block: clamp(5rem, 9vw, 8rem);
  border-top: 1px solid var(--border);
}

.api-section h2 {
  max-width: 10ch;
  margin: 0;
  font-size: clamp(2.25rem, 5vw, 4rem);
  line-height: 1;
  letter-spacing: -0.04em;
}

.api-section p {
  max-width: 36rem;
  margin: 1.25rem 0 0;
  color: var(--muted-foreground);
  line-height: 1.7;
}

.api-section a {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 1.5rem;
  color: var(--foreground);
  font-size: 0.875rem;
  font-weight: 700;
  text-underline-offset: 0.25rem;
}

.api-section a svg {
  width: 1rem;
}

.api-section pre {
  overflow-x: auto;
  margin: 0;
  padding: clamp(1.25rem, 3vw, 2rem);
  border-radius: 1rem;
  background: #17171a;
  color: #ececf0;
  font-size: clamp(0.75rem, 1.7vw, 0.875rem);
  line-height: 1.8;
  scrollbar-color: #4a4a52 transparent;
}

.code-muted { color: #85858f; }
.code-keyword { color: #a8b6ff; }
.code-string { color: #bfe4b7; }

.landing :is(button, a):focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: 3px;
}

@media (hover: hover) and (pointer: fine) {
  .hero-primary:hover,
  .hero-secondary:hover {
    opacity: 0.82;
  }

  .install-command:hover {
    color: var(--foreground);
  }
}

@media (max-width: 800px) {
  .hero {
    min-height: auto;
    grid-template-columns: 1fr;
    gap: 3.5rem;
    padding-block: 4.5rem 4rem;
  }

  .hero h1 {
    max-width: 13ch;
    font-size: clamp(3rem, 14vw, 5rem);
  }

  .api-section {
    grid-template-columns: 1fr;
  }

  .recipe-section {
    grid-template-columns: 1fr;
  }

  .api-section pre {
    max-width: calc(100vw - 2.5rem);
  }

  .hero-proof {
    display: none;
  }
}

@media (max-width: 480px) {
  .hero,
  .demo-section,
  .recipe-section,
  .api-section {
    width: min(100% - 2rem, 72rem);
  }

  .hero-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .hero-primary,
  .hero-secondary {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-primary,
  .hero-secondary {
    transition: opacity 140ms ease;
  }
}
</style>

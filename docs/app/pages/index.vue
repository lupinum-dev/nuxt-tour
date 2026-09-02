<script setup lang="ts">
import SiteHeroCode from '#ginko-docs/components/site/SiteHeroCode.vue'

defineOptions({ name: 'TourLandingPage' })

const tour = useNuxtTour('docs-demo')
const copied = ref(false)
const errorMessage = ref('')
const installCommand = 'pnpm add @lupinum/nuxt-tour'
const scriptCloseTag = `</${'script'}>`
const heroCodeTabs = [
  {
    label: 'Tour',
    icon: 'lucide:map',
    filename: 'app/tours/onboarding.ts',
    language: 'ts',
    code: `export default defineTour({
  id: 'onboarding',
  steps: [{
    id: 'create-project',
    route: '/projects',
    target: 'new-project',
    title: 'Create your first project',
    content: 'Start here, then invite your team.',
  }],
})`,
  },
  {
    label: 'Target',
    icon: 'lucide:scan',
    filename: 'app/pages/projects.vue',
    language: 'vue',
    code: `<template>
  <button v-tour-target="'new-project'">
    New project
  </button>
</template>`,
  },
  {
    label: 'Start',
    icon: 'lucide:play',
    filename: 'app/components/WelcomeButton.vue',
    language: 'vue',
    code: `<script setup lang="ts">
const onboarding = useNuxtTour('onboarding')
${scriptCloseTag}

<template>
  <button @click="onboarding.start()">
    Show me around
  </button>
</template>`,
  },
]

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
  <main class="overflow-hidden">
    <section class="relative border-b border-border">
      <div class="relative mx-auto flex max-w-6xl flex-col gap-14 px-5 py-24 sm:px-8 sm:py-32 lg:flex-row lg:items-center">
        <div class="min-w-0 flex-1">
          <h1 class="max-w-4xl text-5xl leading-[0.98] font-semibold tracking-[-0.035em] text-balance text-foreground sm:text-7xl lg:text-6xl">
            Show people around. Keep Nuxt feeling like Nuxt.
          </h1>
          <p class="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
            Accessible, route-aware product tours with typed definitions, semantic targets, and defaults you can trust.
          </p>
          <div class="mt-10 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              class="h-11 px-5 font-semibold"
              @click="startDemo"
            >
              <Icon
                name="lucide:play"
                class="size-4"
                aria-hidden="true"
              />
              Try the live tour
            </Button>
            <Button
              as-child
              variant="outline"
              class="h-11 px-5 font-semibold"
            >
              <NuxtLink to="/docs">
                Read the guide
                <Icon
                  name="lucide:arrow-right"
                  class="size-4"
                  aria-hidden="true"
                />
              </NuxtLink>
            </Button>
          </div>
          <div class="mt-5">
            <div class="inline-flex h-10 max-w-full items-center gap-3 rounded-md border border-border bg-muted/40 pr-1.5 pl-4 font-mono text-[13px] text-foreground/90">
              <span
                class="text-muted-foreground select-none"
                aria-hidden="true"
              >$</span>
              <span class="truncate">{{ installCommand }}</span>
              <button
                type="button"
                class="content-codeblock-copy-button"
                :aria-label="copied ? 'Copied' : 'Copy install command'"
                @click="copyInstall"
              >
                <Icon
                  :name="copied ? 'lucide:check' : 'lucide:clipboard'"
                  class="size-3.5"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
          <p
            v-if="errorMessage"
            class="mt-3 text-sm text-destructive"
            role="alert"
          >
            {{ errorMessage }}
          </p>
        </div>

        <div class="w-full min-w-0 max-w-2xl shrink-0 lg:w-[30rem] lg:max-w-full xl:w-[36rem]">
          <SiteHeroCode :tabs="heroCodeTabs" />
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
      <TourDemo />
    </section>

    <section
      v-tour-target="'demo-recipes'"
      class="border-t border-border"
    >
      <div class="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div class="min-w-0">
          <h2 class="max-w-xl text-3xl leading-tight font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-4xl">
            From first tour to product-ready patterns.
          </h2>
          <p class="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Run focused recipes for rich media, live controls, Vue refs, route changes, conditional steps, and custom cards.
          </p>
          <NuxtLink
            to="/docs/recipes"
            class="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Open the interactive recipe lab
            <Icon
              name="lucide:arrow-right"
              class="size-4"
              aria-hidden="true"
            />
          </NuxtLink>
        </div>
        <ul
          class="divide-y divide-border border-y border-border"
          aria-label="Available recipe topics"
        >
          <li class="flex min-h-15 items-center gap-3 text-sm font-semibold text-foreground">
            <Icon
              name="lucide:image"
              class="size-4 text-primary"
              aria-hidden="true"
            />
            Images and Vue components
          </li>
          <li class="flex min-h-15 items-center gap-3 text-sm font-semibold text-foreground">
            <Icon
              name="lucide:route"
              class="size-4 text-primary"
              aria-hidden="true"
            />
            Routes and dynamic targets
          </li>
          <li class="flex min-h-15 items-center gap-3 text-sm font-semibold text-foreground">
            <Icon
              name="lucide:mouse-pointer-click"
              class="size-4 text-primary"
              aria-hidden="true"
            />
            Interaction and focus
          </li>
          <li class="flex min-h-15 items-center gap-3 text-sm font-semibold text-foreground">
            <Icon
              name="lucide:palette"
              class="size-4 text-primary"
              aria-hidden="true"
            />
            Themes and custom cards
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>

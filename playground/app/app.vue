<script setup lang="ts">
const onboarding = useNuxtTour('onboarding')
const errorMessage = ref('')

async function startTour(): Promise<void> {
  errorMessage.value = ''
  try {
    await onboarding.start({ replace: true })
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The tour could not start.'
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <NuxtLink
        class="brand"
        to="/"
      >
        Lupinum Nuxt Tour
      </NuxtLink>
      <nav aria-label="Main navigation">
        <NuxtLink to="/">
          Home
        </NuxtLink>
        <NuxtLink
          v-tour-target="'projects-nav'"
          to="/projects"
        >
          Projects
        </NuxtLink>
      </nav>
      <button
        class="start-button"
        type="button"
        @click="startTour"
      >
        Start tour
      </button>
    </header>

    <NuxtPage />

    <p
      v-if="errorMessage"
      class="error"
      role="alert"
    >
      {{ errorMessage }}
    </p>
    <TourHost>
      <template #progress="{ index, total, labels }">
        <p data-tour-part="progress">
          {{ labels.progress(index + 1, total) }}
        </p>
        <progress
          class="tour-progress"
          :value="index + 1"
          :max="total"
          :aria-label="labels.progress(index + 1, total)"
        />
      </template>
    </TourHost>
  </div>
</template>

<style>
.tour-progress { display: block; width: 100%; height: 0.25rem; margin-block: 0.75rem; accent-color: var(--tour-accent); }
</style>

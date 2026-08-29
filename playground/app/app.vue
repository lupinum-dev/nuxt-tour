<script setup lang="ts">
const onboarding = useTour('onboarding')
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
    <TourHost />
  </div>
</template>

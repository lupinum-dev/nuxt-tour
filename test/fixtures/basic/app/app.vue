<script setup lang="ts">
const onboarding = useTour('onboarding')
</script>

<template>
  <main>
    <div>Nuxt Tour fixture</div>
    <button
      data-tour-target="welcome"
      @click="onboarding.start()"
    >
      Start tour
    </button>
    <TourHost />
  </main>
</template>

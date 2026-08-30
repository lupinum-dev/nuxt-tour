<script setup lang="ts">
const onboarding = useNuxtTour('onboarding')
</script>

<template>
  <main>
    <div>Nuxt Tour fixture</div>
    <button
      v-tour-target="'welcome'"
      @click="onboarding.start()"
    >
      Start tour
    </button>
    <TourHost />
  </main>
</template>

<script setup lang="ts">
const onboarding = useNuxtTour('onboarding')
</script>

<template>
  <main v-tour-target="'welcome-shell'">
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

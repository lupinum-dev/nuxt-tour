<script setup lang="ts">
const inherited = useNuxtTour('base-only')
const overridden = useNuxtTour('shared')

void inherited.goTo('base')
void overridden.goTo('project-step')

// @ts-expect-error The lower-priority definition does not leak through the override.
void overridden.goTo('base-step')
</script>

<template>
  <main>Nuxt Tour layers fixture</main>
  <TourHost />
</template>

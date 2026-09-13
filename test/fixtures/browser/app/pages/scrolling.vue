<script setup lang="ts">
defineOptions({ name: 'ScrollingFixture' })
const tour = useNuxtTour('scrolling')
</script>

<template>
  <main>
    <button
      data-testid="start-scroll"
      @click="tour.start()"
    >
      Start scrolling tour
    </button>
    <div v-tour-target="'scroll-start'">
      Scroll start
    </div>
    <div style="height: 1600px" />
    <div
      v-tour-target="'scroll-end'"
      style="height: 100px"
    >
      Scroll end
    </div>
    <div style="height: 600px" />
  </main>
</template>

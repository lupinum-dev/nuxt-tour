<script setup lang="ts">
defineOptions({ name: 'ScrollingFixture' })
const tour = useNuxtTour('scrolling')
const tall = useNuxtTour('tall')
</script>

<template>
  <main>
    <button
      data-testid="start-scroll"
      @click="tour.start()"
    >
      Start scrolling tour
    </button>
    <button
      data-testid="start-tall"
      @click="tall.start()"
    >
      Start tall target tour
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
    <div
      v-tour-target="'scroll-tall'"
      style="height: calc(100vh - 160px)"
    >
      Tall target
    </div>
    <div style="height: 600px" />
  </main>
</template>

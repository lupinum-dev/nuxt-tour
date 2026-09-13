<script setup lang="ts">
defineOptions({ name: 'MotionFixture' })
const tour = useNuxtTour('motion')
const slow = useNuxtTour('slow')
const clicks = ref(0)
</script>

<template>
  <main>
    <button
      data-testid="start-motion"
      @click="tour.start()"
    >
      Start motion
    </button>
    <button
      data-testid="start-slow"
      @click="slow.start()"
    >
      Start slow preparation
    </button>
    <div class="motion-targets">
      <button
        v-tour-target="'motion-first'"
        class="motion-first"
        @click="clicks++"
      >
        First
      </button>
      <button
        v-tour-target="'motion-second'"
        class="motion-second"
        @click="clicks++"
      >
        Second
      </button>
      <button
        data-testid="unrelated"
        @click="clicks++"
      >
        Unrelated
      </button>
    </div>
    <output>{{ clicks }}</output>
  </main>
</template>

<style scoped>
.motion-targets { display: flex; align-items: start; gap: 1rem; padding: 1rem; }
.motion-targets button { min-width: 0; margin: 0; }
.motion-first { width: 80px; height: 48px; }
.motion-second { width: 120px; height: 100px; margin-top: 80px !important; }
</style>

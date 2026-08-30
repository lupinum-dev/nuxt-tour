<script setup lang="ts">
defineOptions({ name: 'BrowserFixtureProject' })

await new Promise(resolve => setTimeout(resolve, 80))
const clicks = ref(0)
</script>

<template>
  <main>
    <h1>Project</h1>
    <button
      v-tour-target="'project-target'"
      data-testid="project-target"
      type="button"
      @click="clicks += 1"
    >
      Project target
    </button>
    <output data-testid="project-clicks">{{ clicks }}</output>
  </main>
</template>

<script setup lang="ts">
defineOptions({ name: 'BrowserFixtureHome' })

const route = useRoute()
const targetVisible = ref(true)
const replacements = ref(0)

function replaceTarget(): void {
  targetVisible.value = false
  replacements.value += 1
  setTimeout(() => {
    targetVisible.value = true
  }, 100)
}
</script>

<template>
  <main>
    <h1>Browser fixture</h1>
    <button
      v-if="route.query.panel === 'open' && targetVisible"
      v-tour-target="'query-target'"
      data-testid="query-target"
      type="button"
      @click="replaceTarget"
    >
      Query target
    </button>
    <p data-testid="target-replacements">
      {{ replacements }}
    </p>
  </main>
</template>

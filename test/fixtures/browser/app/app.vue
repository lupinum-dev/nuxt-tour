<script setup lang="ts">
const journey = useNuxtTour('journey')
const hostVisible = ref(true)

onMounted(() => {
  const controls = window as typeof window & {
    __navigateExternal?: () => void
    __removeTourHost?: () => void
  }
  controls.__removeTourHost = () => {
    hostVisible.value = false
  }
  controls.__navigateExternal = () => {
    void navigateTo('/external')
  }
})

onBeforeUnmount(() => {
  const controls = window as typeof window & {
    __navigateExternal?: () => void
    __removeTourHost?: () => void
  }
  delete controls.__removeTourHost
  delete controls.__navigateExternal
})

function start(): void {
  void journey.start({ replace: true })
}
</script>

<template>
  <div data-testid="application">
    <header>
      <button
        data-testid="start"
        type="button"
        @click="start"
      >
        Start tour
      </button>
      <button
        data-testid="remove-host"
        type="button"
        @click="hostVisible = false"
      >
        Remove host
      </button>
      <NuxtLink
        data-testid="external-navigation"
        to="/external"
      >
        External navigation
      </NuxtLink>
    </header>
    <NuxtPage />
  </div>
  <TourHost v-if="hostVisible" />
</template>

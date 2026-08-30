<script setup lang="ts">
const activeFilter = ref<'all' | 'at-risk'>('all')
</script>

<template>
  <div class="interaction-preview">
    <p>Project health</p>
    <div
      v-tour-target="'recipe-interaction-target'"
      class="filter-control"
      aria-label="Filter project health"
    >
      <button
        type="button"
        :aria-pressed="activeFilter === 'all'"
        @click="activeFilter = 'all'"
      >
        All
      </button>
      <button
        type="button"
        :aria-pressed="activeFilter === 'at-risk'"
        @click="activeFilter = 'at-risk'"
      >
        At risk
      </button>
    </div>
    <strong>{{ activeFilter === 'all' ? '12 projects' : '3 projects need attention' }}</strong>
  </div>
</template>

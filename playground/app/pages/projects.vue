<script setup lang="ts">
defineOptions({ name: 'PlaygroundProjectsPage' })
</script>

<template>
  <main class="page">
    <p class="context">
      Example destination
    </p>
    <div class="page-heading">
      <div>
        <h1>Projects</h1>
        <p class="lede">
          The tour navigated here and waited for this page to settle.
        </p>
      </div>
      <button
        v-tour-target="'create-project'"
        class="primary-button"
        type="button"
      >
        Create project
      </button>
    </div>
  </main>
</template>

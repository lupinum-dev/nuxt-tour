<script setup lang="ts">
defineOptions({ name: 'PlaygroundProjectsPage' })
</script>

<template>
  <main>
    <section class="page">
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
    </section>

    <div
      class="example-spacer"
      aria-hidden="true"
    />

    <section
      v-tour-target="'project-insights'"
      class="page example-insights"
    >
      <p class="context">
        Distant target
      </p>
      <h2>Project insights</h2>
      <p class="lede">
        This second anchor demonstrates a long downward transition and the same journey in reverse.
      </p>
    </section>
  </main>
</template>

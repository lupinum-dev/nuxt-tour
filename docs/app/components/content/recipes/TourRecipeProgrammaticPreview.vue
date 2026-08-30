<script setup lang="ts">
const target = useTemplateRef<HTMLButtonElement>('target')
useTourTarget('recipe-programmatic-target', target)
</script>

<template>
  <div class="programmatic-preview">
    <Icon
      name="lucide:braces"
      aria-hidden="true"
    />
    <p>The button below is registered from its Vue ref.</p>
    <button
      ref="target"
      type="button"
    >
      Create project
    </button>
  </div>
</template>

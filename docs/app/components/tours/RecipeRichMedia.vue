<template>
  <figure class="recipe-media-step">
    <img
      src="/recipes/project-overview.svg"
      width="640"
      height="360"
      alt="Nuxt project dashboard with a code preview, progress, and active tasks"
    >
    <figcaption>
      Components make room for responsive images, video, live data, and your own design system.
    </figcaption>
  </figure>
</template>

<style scoped>
.recipe-media-step {
  display: grid;
  gap: 0.75rem;
  margin: 0;
}

.recipe-media-step img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 0.75rem;
}

.recipe-media-step figcaption {
  color: var(--tour-muted);
  font-size: 0.9rem;
  line-height: 1.55;
}
</style>

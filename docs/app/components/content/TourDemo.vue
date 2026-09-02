<script setup lang="ts">
const tour = useNuxtTour('docs-demo')
const filter = ref<'all' | 'active'>('all')
const created = ref(false)
const errorMessage = ref('')

const projects = computed(() => {
  const items = [
    { name: 'Wetland Atlas', detail: '12 tasks', color: 'mint', active: true },
    { name: 'Solar Commons', detail: '8 tasks', color: 'sun', active: true },
    { name: 'Forest Archive', detail: 'Complete', color: 'coral', active: false },
  ]
  if (created.value) items.unshift({ name: 'New habitat study', detail: 'Just now', color: 'blue', active: true })
  return filter.value === 'active' ? items.filter(project => project.active) : items
})

async function startTour(): Promise<void> {
  errorMessage.value = ''
  try {
    await tour.start({ replace: true })
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The demo could not start.'
  }
}

function createProject(): void {
  created.value = true
}
</script>

<template>
  <section
    id="live-demo"
    class="tour-demo"
    aria-labelledby="tour-demo-title"
  >
    <div class="demo-heading">
      <div>
        <h2 id="tour-demo-title">
          Try the actual library
        </h2>
        <p>Click through nearby, distant, downward, and upward targets. Each move uses the same polished adaptive timing.</p>
      </div>
      <button
        type="button"
        class="demo-start"
        :disabled="tour.pending.value"
        @click="startTour"
      >
        <Icon
          name="lucide:play"
          aria-hidden="true"
        />
        {{ tour.isActive.value ? 'Restart live tour' : 'Start live tour' }}
      </button>
    </div>

    <div
      v-tour-target="'demo-shell'"
      class="demo-window"
    >
      <div
        class="demo-windowbar"
        aria-hidden="true"
      >
        <span />
        <span />
        <span />
        <p>app.lupinum.test/projects</p>
      </div>

      <div class="demo-app">
        <aside
          class="demo-sidebar"
          aria-hidden="true"
        >
          <div class="demo-mark">
            <span>L</span>
            <strong>Lupinum</strong>
          </div>
          <nav>
            <span>
              <Icon
                name="lucide:layout-dashboard"
                aria-hidden="true"
              />
              Overview
            </span>
            <span class="is-current">
              <Icon
                name="lucide:folder-kanban"
                aria-hidden="true"
              />
              Projects
            </span>
            <span>
              <Icon
                name="lucide:users"
                aria-hidden="true"
              />
              Team
            </span>
          </nav>
          <div class="demo-profile">
            <span>MR</span>
            <p><strong>Maya R.</strong><small>Product lead</small></p>
          </div>
        </aside>

        <div class="demo-main">
          <header class="demo-workspace">
            <div>
              <p>Friday, 29 August</p>
              <h3>Projects</h3>
            </div>
            <button
              v-tour-target="'demo-create'"
              type="button"
              class="demo-create"
              @click="createProject"
            >
              <Icon
                :name="created ? 'lucide:check' : 'lucide:plus'"
                aria-hidden="true"
              />
              {{ created ? 'Sample created' : 'New project' }}
            </button>
          </header>

          <div class="demo-toolbar">
            <div
              v-tour-target="'demo-filters'"
              class="demo-filters"
              aria-label="Filter projects"
            >
              <button
                type="button"
                :aria-pressed="filter === 'all'"
                @click="filter = 'all'"
              >
                All projects
              </button>
              <button
                type="button"
                :aria-pressed="filter === 'active'"
                @click="filter = 'active'"
              >
                Active
              </button>
            </div>
            <span
              class="demo-search"
              aria-hidden="true"
            >
              <Icon
                name="lucide:search"
                aria-hidden="true"
              />
            </span>
          </div>

          <div
            class="demo-projects"
            aria-live="polite"
          >
            <article
              v-for="project in projects"
              :key="project.name"
              class="demo-project"
            >
              <span
                class="demo-project-icon"
                :data-color="project.color"
              >
                <Icon
                  name="lucide:leaf"
                  aria-hidden="true"
                />
              </span>
              <div>
                <h4>{{ project.name }}</h4>
                <p>{{ project.detail }}</p>
              </div>
              <span class="demo-project-state">{{ project.active ? 'In progress' : 'Completed' }}</span>
              <Icon
                name="lucide:chevron-right"
                class="demo-chevron"
                aria-hidden="true"
              />
            </article>
          </div>

          <div
            v-tour-target="'demo-api'"
            class="demo-api"
          >
            <span>app/tours/onboarding.ts</span>
            <code><b>target:</b> <i>'new-project'</i>, <b>interaction:</b> <i>'target'</i></code>
          </div>
        </div>
      </div>
    </div>

    <p
      v-if="errorMessage"
      class="demo-error"
      role="alert"
    >
      {{ errorMessage }}
    </p>
    <p class="demo-note">
      <Icon
        name="lucide:accessibility"
        aria-hidden="true"
      />
      Keyboard navigation, focus management, dark mode, and reduced motion are built in.
    </p>
    <TourHost />
  </section>
</template>

<style scoped>
.tour-demo {
  --demo-ease: cubic-bezier(0.19, 1, 0.22, 1);
  color: var(--foreground);
}

.demo-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 2rem;
  margin-block-end: 1.5rem;
}

.demo-heading h2 {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  line-height: 1.08;
  letter-spacing: -0.03em;
}

.demo-heading p {
  max-width: 39rem;
  margin: 0.65rem 0 0;
  color: var(--muted-foreground);
  line-height: 1.65;
}

.demo-start,
.demo-create {
  display: inline-flex;
  min-height: 2.75rem;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 1rem;
  border: 0;
  border-radius: 0.75rem;
  background: var(--brand);
  color: var(--brand-foreground);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 140ms ease, transform 140ms var(--demo-ease);
  touch-action: manipulation;
}

.demo-start svg,
.demo-create svg {
  width: 1rem;
  height: 1rem;
}

.demo-start:active:not(:disabled),
.demo-create:active:not(:disabled) {
  transform: scale(0.97);
}

.demo-start:disabled {
  cursor: wait;
}

.demo-window {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--card);
}

.demo-windowbar {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.4rem;
  padding: 0 1rem;
  border-bottom: 1px solid var(--border);
  background: color-mix(in oklab, var(--muted) 55%, var(--card));
}

.demo-windowbar > span {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
  background: color-mix(in oklab, var(--muted-foreground) 42%, transparent);
}

.demo-windowbar p {
  margin: 0 auto;
  padding-inline-end: 3rem;
  color: var(--muted-foreground);
  font-size: 0.75rem;
}

.demo-app {
  display: grid;
  min-height: 31rem;
  grid-template-columns: 12rem minmax(0, 1fr);
}

.demo-sidebar {
  display: flex;
  flex-direction: column;
  padding: 1.25rem 0.85rem;
  border-right: 1px solid var(--border);
  background: color-mix(in oklab, var(--muted) 26%, var(--card));
}

.demo-mark {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0 0.55rem 1.2rem;
}

.demo-mark > span,
.demo-profile > span {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: none;
  border-radius: 0.625rem;
  background: var(--foreground);
  color: var(--background);
  font-size: 0.75rem;
  font-weight: 800;
  place-items: center;
}

.demo-sidebar nav {
  display: grid;
  gap: 0.25rem;
}

.demo-sidebar nav span {
  display: flex;
  min-height: 2.5rem;
  align-items: center;
  gap: 0.7rem;
  padding: 0 0.7rem;
  border: 0;
  border-radius: 0.625rem;
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  font-size: 0.8125rem;
  text-align: start;
}

.demo-sidebar nav span.is-current {
  background: var(--background);
  color: var(--foreground);
  font-weight: 700;
}

.demo-sidebar nav svg {
  width: 1rem;
  height: 1rem;
}

.demo-profile {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: auto;
  padding: 0.75rem 0.55rem 0;
  border-top: 1px solid var(--border);
}

.demo-profile > span {
  background: color-mix(in oklab, var(--brand) 18%, var(--muted));
  color: var(--foreground);
}

.demo-profile p,
.demo-profile small {
  display: block;
  margin: 0;
}

.demo-profile strong {
  font-size: 0.75rem;
}

.demo-profile small {
  margin-top: 0.1rem;
  color: var(--muted-foreground);
  font-size: 0.675rem;
}

.demo-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: clamp(1rem, 3vw, 2rem);
}

.demo-workspace {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-radius: 0.75rem;
}

.demo-workspace p {
  margin: 0 0 0.25rem;
  color: var(--muted-foreground);
  font-size: 0.75rem;
}

.demo-workspace h3 {
  margin: 0;
  font-size: clamp(1.5rem, 4vw, 2rem);
  line-height: 1.1;
  letter-spacing: -0.03em;
}

.demo-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 2rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}

.demo-filters {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: 0.75rem;
  background: var(--muted);
}

.demo-filters button,
.demo-search {
  min-height: 2.25rem;
  padding: 0 0.75rem;
  border: 0;
  border-radius: 0.55rem;
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 650;
  cursor: pointer;
}

.demo-filters button[aria-pressed='true'] {
  background: var(--card);
  color: var(--foreground);
  box-shadow: 0 0.125rem 0.4rem rgb(0 0 0 / 8%);
}

.demo-search {
  display: grid;
  width: 2.25rem;
  padding: 0;
  border: 1px solid var(--border);
  place-items: center;
}

.demo-search svg {
  width: 0.9rem;
}

.demo-projects {
  display: grid;
}

.demo-project {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 0.85rem;
  padding: 1rem 0.25rem;
  border-bottom: 1px solid var(--border);
}

.demo-project-icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.7rem;
  place-items: center;
}

.demo-project-icon[data-color='mint'] { background: #d9f3df; color: #235c38; }
.demo-project-icon[data-color='sun'] { background: #f8edbe; color: #735b0d; }
.demo-project-icon[data-color='coral'] { background: #f6d8ce; color: #783e2f; }
.demo-project-icon[data-color='blue'] { background: #d7e8f7; color: #285578; }

.demo-project-icon svg {
  width: 1rem;
}

.demo-project h4,
.demo-project p {
  margin: 0;
}

.demo-project h4 {
  overflow: hidden;
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.demo-project p {
  margin-top: 0.15rem;
  color: var(--muted-foreground);
  font-size: 0.7rem;
}

.demo-project-state {
  color: var(--muted-foreground);
  font-size: 0.7rem;
}

.demo-chevron {
  width: 0.9rem;
  color: var(--muted-foreground);
}

.demo-api {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: auto;
  padding: 0.8rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: color-mix(in oklab, var(--muted) 72%, var(--card));
  color: var(--foreground);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.7rem;
}

.demo-api > span {
  color: var(--muted-foreground);
}

.demo-api code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.demo-api b { color: var(--brand); font-weight: 600; }
.demo-api i {
  color: color-mix(in oklab, var(--brand) 58%, var(--foreground));
  font-style: normal;
}

.demo-note,
.demo-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.9rem 0 0;
  color: var(--muted-foreground);
  font-size: 0.75rem;
}

.demo-note svg {
  width: 1rem;
  height: 1rem;
}

.demo-error {
  color: var(--destructive);
}

.tour-demo :is(button, a):focus-visible {
  outline: 3px solid var(--ring);
  outline-offset: 3px;
}

@media (hover: hover) and (pointer: fine) {
  .demo-start:hover:not(:disabled),
  .demo-create:hover:not(:disabled) {
    opacity: 0.88;
  }

  .demo-filters button:hover {
    color: var(--foreground);
  }
}

@media (max-width: 700px) {
  .demo-heading {
    align-items: stretch;
    flex-direction: column;
    gap: 1rem;
  }

  .demo-start {
    width: 100%;
  }

  .demo-app {
    min-height: 29rem;
    grid-template-columns: 1fr;
  }

  .demo-sidebar {
    display: none;
  }

  .demo-main {
    padding: 1rem;
  }

  .demo-project-state,
  .demo-chevron {
    display: none;
  }

  .demo-project {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .demo-api {
    align-items: flex-start;
    flex-direction: column;
    margin-top: 1rem;
  }

  .demo-api code {
    max-width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .demo-start,
  .demo-create {
    transition: opacity 140ms ease;
  }
}
</style>

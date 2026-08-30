import NestedEscapeDemo from '../components/NestedEscapeDemo.vue'

export default defineTour({
  id: 'journey',
  steps: [
    {
      id: 'welcome',
      title: 'Welcome',
      content: NestedEscapeDemo,
    },
    {
      id: 'query',
      route: { path: '/', query: { panel: 'open' } },
      target: 'query-target',
      title: 'Query route',
      content: 'The same page instance can reveal a new target.',
      interaction: 'target',
    },
    {
      id: 'project',
      route: '/projects/42',
      target: 'project-target',
      title: 'Project route',
      content: 'The destination waits for Suspense and the page transition.',
      interaction: 'page',
    },
  ],
})

export default defineTour({
  id: 'docs-demo',
  steps: [
    {
      id: 'workspace',
      target: 'demo-workspace',
      title: 'A real tour, running right here',
      content: 'This is the actual Nuxt Tour runtime—not a video or a hand-built imitation.',
      placement: 'bottom-start',
    },
    {
      id: 'interaction',
      target: 'demo-filters',
      title: 'The interface can stay interactive',
      content: 'Try changing the filter. Target interaction keeps useful controls available while everything else stays focused.',
      placement: 'bottom-start',
      interaction: 'target',
    },
    {
      id: 'api',
      target: 'demo-api',
      title: 'Stable targets, typed definitions',
      content: 'Name the product concept once. Nuxt discovers the tour and gives useTour() its exact tour and step IDs.',
      placement: 'top-start',
    },
    {
      id: 'action',
      target: 'demo-create',
      title: 'Tours can guide real work',
      content: 'Try the button. The target remains usable, focus stays correct, and the tour never flashes between steps.',
      placement: 'bottom-end',
      interaction: 'target',
    },
  ],
})

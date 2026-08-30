export default defineTour({
  id: 'onboarding',
  steps: [
    {
      id: 'welcome',
      title: 'A tour that feels like Nuxt',
      content: 'Definitions live in app/tours. The module discovers and types them automatically.',
    },
    {
      id: 'navigation',
      target: 'projects-nav',
      title: 'Semantic targets',
      content: 'Targets use stable names instead of brittle selectors. This link stays interactive.',
      placement: 'bottom-end',
      interaction: 'target',
    },
    {
      id: 'create-project',
      route: '/projects',
      target: 'create-project',
      title: 'Routes are part of the step',
      content: 'Nuxt Tour waits for the destination page and target before it shows the card.',
      placement: 'bottom-start',
    },
    {
      id: 'project-insights',
      target: 'project-insights',
      title: 'Long travel stays responsive',
      content: 'Native scrolling adapts to the distance. The spotlight opens as this section approaches its final position.',
      placement: 'top-start',
    },
    {
      id: 'return-to-create',
      target: 'create-project',
      title: 'Previous and next stay symmetrical',
      content: 'The same centering and reveal rules apply when the tour moves back up the page.',
      placement: 'bottom-start',
    },
  ],
})

export default defineTour({
  id: 'motion',
  steps: [
    { id: 'first', target: 'motion-first', title: 'First target', content: 'Move to a different size.', interaction: 'target' },
    { id: 'second', target: 'motion-second', title: 'Second target', content: 'The opening stays continuous.', interaction: 'target' },
    { id: 'third', target: 'motion-first', title: 'Back again', content: 'Return to the first target.', gap: 12 },
    { id: 'fourth', target: 'motion-first', title: 'Back again', content: 'Return to the first target.', gap: 36 },
  ],
})

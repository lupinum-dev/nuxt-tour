export default defineTour({
  id: 'scrolling',
  steps: [
    { id: 'start', target: 'scroll-start', title: 'Start', content: 'A nearby target.', scroll: false },
    { id: 'end', target: 'scroll-end', title: 'End', content: 'A distant target.' },
  ],
})

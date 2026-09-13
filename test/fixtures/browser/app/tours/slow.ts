export default defineTour({
  id: 'slow',
  steps: [{
    id: 'waiting',
    title: 'Prepared step',
    content: 'Preparation finished.',
    prepare: ({ signal }) => new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 2000)
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        resolve()
      }, { once: true })
    }),
  }],
})

export default defineTour({
  id: 'recipe-interaction',
  steps: [{
    id: 'filter',
    target: 'recipe-interaction-target',
    title: 'Let people use the highlighted control',
    content: 'Change the filter while this card is open. The rest of the page remains protected.',
    interaction: 'target',
    placement: 'bottom-start',
  }],
})

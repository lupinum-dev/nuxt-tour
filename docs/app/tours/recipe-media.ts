import RecipeRichMedia from '../components/tours/RecipeRichMedia.vue'

export default defineTour({
  id: 'recipe-media',
  steps: [{
    id: 'media',
    target: 'recipe-media-target',
    title: 'Use a Vue component for rich content',
    content: RecipeRichMedia,
    placement: 'bottom',
  }],
})

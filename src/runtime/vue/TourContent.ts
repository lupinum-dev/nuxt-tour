import { defineComponent, h } from 'vue'
import type { PropType } from 'vue'
import type { TourStep } from '../types'

const TourContent = defineComponent({
  name: 'TourContent',
  props: {
    step: {
      type: Object as PropType<TourStep>,
      required: true,
    },
  },
  setup(props) {
    return () => typeof props.step.content === 'string'
      ? h('p', { 'data-tour-part': 'content' }, props.step.content)
      : h('div', { 'data-tour-part': 'content' }, [h(props.step.content)])
  },
})

export { TourContent }
export default TourContent

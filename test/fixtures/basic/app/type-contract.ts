import { createTourPlugin } from '@lupinum/nuxt-tour/vue'

const onboarding = useNuxtTour('onboarding')

void onboarding.goTo('welcome')
useTourTarget('welcome', ref<HTMLElement | null>(null))
useTourTarget('welcome-shell', ref<HTMLElement | null>(null))

// @ts-expect-error Unknown discovered tour IDs must fail at build time.
useNuxtTour('onboadring')

// @ts-expect-error Step IDs stay specific to the selected tour.
void onboarding.goTo('missing-step')

// @ts-expect-error Semantic target IDs are inferred from discovered definitions.
useTourTarget('welcomme', ref<HTMLElement | null>(null))

defineTour({
  id: 'typed-route',
  steps: [{
    id: 'route',
    title: 'Route',
    content: 'Route',
    route: {
      name: 'project',
      params: { id: 42 },
      query: { filter: ['open', null] },
    },
  }],
})

defineTour({
  id: 'invalid-route',
  steps: [{
    id: 'route',
    title: 'Route',
    content: 'Route',
    route: {
      path: '/project',
      // @ts-expect-error Route query values must be serializable router values.
      query: { filter: { nested: true } },
    },
  }],
})

// A real Vue Router instance satisfies the public structural router contract.
createTourPlugin({ tours: [], router: useRouter() })

export {}

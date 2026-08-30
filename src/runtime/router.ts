import type { TourRoute } from './types'

/** Internal routing boundary used by the framework-specific installations. */
export interface TourRouterAdapter {
  navigate: (route: TourRoute, signal: AbortSignal) => Promise<void>
  subscribe?: (onExternalNavigation: () => void) => () => void
}

export function tourNavigationAbort(message = 'The tour transition was aborted.'): Error {
  return new DOMException(message, 'AbortError')
}

import type { TourRoute, TourRouteParamsValue, TourRouteQueryValue } from './types'

/** Internal routing boundary used by the framework-specific installations. */
export interface TourRouterAdapter {
  navigate: (route: TourRoute, signal: AbortSignal) => Promise<void>
  subscribe?: (onExternalNavigation: () => void) => () => void
}

export function tourNavigationAbort(message = 'The tour transition was aborted.'): Error {
  return new DOMException(message, 'AbortError')
}

// Vue Router accepts mutable arrays. Keep the tour definition readonly and give
// the router its own destination values in both framework adapters.
function mutableParams(values: Readonly<Record<string, TourRouteParamsValue>> | undefined) {
  if (!values) return
  const result: Record<string, string | number | null | (string | number)[]> = {}
  for (const [key, value] of Object.entries(values)) {
    result[key] = typeof value === 'object' && value !== null ? [...value] : value
  }
  return result
}

function mutableQuery(values: Readonly<Record<string, TourRouteQueryValue>> | undefined) {
  if (!values) return
  const result: Record<string, string | number | null | (string | number | null)[]> = {}
  for (const [key, value] of Object.entries(values)) {
    result[key] = typeof value === 'object' && value !== null ? [...value] : value
  }
  return result
}

export function routeLocation(route: TourRoute) {
  if (typeof route === 'string') return { location: route, replace: false }
  const { replace = false, ...destination } = route
  const location = 'name' in destination
    ? { ...destination, params: mutableParams(destination.params), query: mutableQuery(destination.query) }
    : { ...destination, query: mutableQuery(destination.query) }
  return { location, replace }
}

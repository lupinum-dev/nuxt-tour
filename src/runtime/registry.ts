/**
 * Nuxt augments this interface with definitions discovered in `app/tours`.
 *
 * This module is the single declaration-merging boundary for generated tour
 * types. Keep it type-only so Vue and Nuxt consumers can import it safely.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- declaration merging requires an interface.
export interface TourRegistry {}

type SemanticTargetId<Target>
  = Target extends string
    ? Target
    : Target extends { readonly id: infer Id extends string }
      ? Id
      : never

type DefinitionTarget<Definition>
  = Definition extends { readonly steps: readonly (infer Step)[] }
    ? Step extends { readonly target?: infer Target }
      ? Target
      : never
    : never

/** Semantic target IDs inferred from Nuxt's generated tour registry. */
export type TourTargetId = [keyof TourRegistry] extends [never]
  ? string
  : SemanticTargetId<DefinitionTarget<TourRegistry[keyof TourRegistry]>>

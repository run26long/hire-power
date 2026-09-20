// ============================================================================
// THE APPEARANCE VALUES, WITH NO REACT IN THEM
//
// Three strings and the rule for reading them, kept in a module of their own
// because both sides of the wire need them and only one side can have hooks.
//
// The colour-mode hooks live in profileColorMode.js, which imports useState
// and useEffect and is therefore a client module. A route handler that
// imports anything from it does not get these values: Next refuses to compile
// a server route whose import graph reaches a React hook, and before it
// refused, the import resolved to a client-reference proxy instead of the
// array - so `COLOR_MODES.includes(...)` threw, the route answered 500, and
// the settings control reported that it could not save.
//
// So the constants sit here, where nothing imports React. The client module
// re-exports them, which is why every component still imports them from the
// same place it always did.
// ============================================================================

export const COLOR_MODES = ['system', 'light', 'dark']

// What a profile with nothing stored renders as, and so what every profile
// that existed before this setting renders as.
export const DEFAULT_COLOR_MODE = 'dark'

export function normalizeColorMode(value) {
  return COLOR_MODES.includes(value) ? value : DEFAULT_COLOR_MODE
}

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

// Two, since a published profile is a document: what the owner chose is what
// every reader sees, whatever their laptop prefers. 'system' was the third
// and is gone from the control and from what the route will store; a profile
// that still holds it normalises to the default below, which is what an
// unset profile has always rendered as.
export const COLOR_MODES = ['light', 'dark']

// What a profile with nothing stored renders as, and so what every profile
// that existed before this setting renders as.
export const DEFAULT_COLOR_MODE = 'dark'

export function normalizeColorMode(value) {
  return COLOR_MODES.includes(value) ? value : DEFAULT_COLOR_MODE
}

// ============================================================================
// THE ACCENT PALETTES
//
// Nine, and nothing else. What the database stores is the middle value - the
// one that names the palette - and what the page paints is one of the two
// beside it, because a hue that carries an eyebrow on a near-white page is
// too dark to read on an eggplant one and the light version of it is too pale
// to read on paper. So each palette is three colours: the one that is stored,
// the one light mode uses, and the one dark mode uses.
//
// The stored value is the identity. It is what the column holds, what the
// route accepts, and the only one of the three that ever crosses the wire.
// The other two are looked up from it, here and in tokens.css, which is why
// this list and that stylesheet have to be changed together.
//
// WHY THE LIST IS CLOSED
// An accent reaches every eyebrow, rule, focus ring and wash on a published
// page. A free-form hex is a way to make a profile unreadable, or to fail
// contrast in one mode while passing in the other, with nothing between the
// owner and that outcome. Nine palettes were chosen against both grounds; a
// tenth is a decision, not an input.
// ============================================================================

// `hidden` takes a palette out of the picker without taking it out of the
// system: the definition, the stored value, the token blocks and every
// profile already painted in it are untouched, and putting one back on offer
// is deleting one word. Hidden palettes are still valid values, because a
// profile that chose one before it was withdrawn must keep rendering.
export const ACCENTS = [
  { id: 'purple',     label: 'Hire Power Purple', stored: '#5B4FCF', light: '#6D4BD1', dark: '#A78BFA' },
  { id: 'emerald',    label: 'Emerald',           stored: '#18745F', light: '#18745F', dark: '#72C8AE', hidden: true },
  { id: 'cobalt',     label: 'Cobalt',            stored: '#3559C7', light: '#3559C7', dark: '#8EA6FF' },
  { id: 'espresso',   label: 'Espresso',          stored: '#6B4A3B', light: '#6B4A3B', dark: '#C89D87', hidden: true },
  { id: 'sage',       label: 'Sage',              stored: '#78927A', light: '#526B55', dark: '#A9C4A8' },
  { id: 'navy',       label: 'Navy',              stored: '#23405F', light: '#31577A', dark: '#86A9CE' },
  { id: 'crimson',    label: 'Crimson',           stored: '#A63D4D', light: '#A63D4D', dark: '#F08A98', hidden: true },
  { id: 'slate',      label: 'Slate',             stored: '#5F6B7A', light: '#5F6B7A', dark: '#ABB5C3' },
  { id: 'monochrome', label: 'Black',             stored: '#3D3D43', light: '#4B4B52', dark: '#C9C9D0' },
]

// The palette every profile is on until somebody chooses another, and the one
// a stored value nobody recognises falls back to. It is the purple the page
// has always been painted in, so a profile with nothing stored and a profile
// storing this are the same page.
export const DEFAULT_ACCENT = ACCENTS[0].stored

export const ACCENT_VALUES = ACCENTS.map(a => a.stored)

// What the picker offers. Every stored value stays valid - see the note on
// `hidden` above - so this is a view of the list and not a second list.
export const OFFERED_ACCENTS = ACCENTS.filter(a => !a.hidden)

// Case-insensitive, because a hex is a hex however it was typed, and it
// answers with the spelling the list holds so the column only ever carries
// one of nine exact strings.
export function normalizeAccent(value) {
  const want = String(value || '').trim().toLowerCase()
  const found = ACCENTS.find(a => a.stored.toLowerCase() === want)
  return found ? found.stored : DEFAULT_ACCENT
}

// The palette a stored value belongs to. Null is not an error here - it is
// every profile written before this setting existed, and it is the default.
export function accentFor(value) {
  const want = String(value || '').trim().toLowerCase()
  return ACCENTS.find(a => a.stored.toLowerCase() === want) || ACCENTS[0]
}

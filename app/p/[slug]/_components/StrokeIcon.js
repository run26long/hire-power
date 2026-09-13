'use client'

// One 24x24 stroke icon, drawn from whichever paths it is handed. Stroked
// rather than filled so every icon on the page carries the same weight, and
// inheriting `currentColor` so colour arrives from the token on its container
// instead of from a prop.
export default function StrokeIcon({ paths, size = 18, strokeWidth = 1.4 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d, index) => <path key={index} d={d} />)}
    </svg>
  )
}

export const ICON_CERT = ['M12 15a6 6 0 100-12 6 6 0 000 12z', 'M8.2 14L7 22l5-3 5 3-1.2-8']
export const ICON_PLUS = ['M12 5v14', 'M5 12h14']

// Artifacts are drawn by what the thing is, so a link holder can tell a video
// from a document before they open it.
export const ICON_MEDIA = {
  image: ['M4 5h16v14H4z', 'M4 15l4-4 3 3 4-4 5 5'],
  video: ['M3 6h12v12H3z', 'M15 10l6-3v10l-6-3z'],
  audio: ['M9 17V5l10-2v12'],
  document: ['M6 3h8l4 4v14H6z', 'M14 3v4h4'],
  link: ['M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1', 'M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1'],
  default: ['M5 4h14v16H5z']
}

'use client'

import { useResolvedProfileMode } from '@/lib/profileColorMode'

// ============================================================================
// THE HIRE POWER WORDMARK, ON WHICHEVER GROUND IT LANDS ON
//
// One asset, two treatments. The white wordmark is the shape in both modes:
// on a dark page it is drawn as the image it is, and on a light one it is
// used as a mask over a flat charcoal, which is the same mark in one colour
// without a second file to keep in step with the first.
//
// WHY A MASK AND NOT A FILTER
// The source is a raster. A filter chain can push white toward a colour but
// only approximately, and the approximations are unreadable in the source;
// a mask takes the alpha channel and lets the element paint whatever colour
// it is told to, exactly. The charcoal is one value for every palette on
// purpose: the mark is Hire Power's, not the profile's, and a wordmark that
// changed hue with the owner's colour would be nine logos.
//
// WHY THE SPAN CARRIES AN ASPECT RATIO
// The image sized itself; a masked box cannot. The three places this renders
// set one dimension and leave the other automatic - two set a height, one a
// width - so the ratio of the asset is declared here and both directions
// resolve to the size they always had.
// ============================================================================

const WHITE_MARK = '/images/hire-power-logo-white-v2.png'

// The asset's own pixels: 7016 x 1608.
const MARK_RATIO = '7016 / 1608'

export default function ProfileMark({ className }) {
  const mode = useResolvedProfileMode()

  if (mode === 'light') {
    return (
      <span
        className={className}
        role="img"
        aria-label="Hire Power"
        data-mark="mono"
        style={{
          aspectRatio: MARK_RATIO,
          WebkitMaskImage: `url(${WHITE_MARK})`,
          maskImage: `url(${WHITE_MARK})`,
        }}
      />
    )
  }

  return <img className={className} src={WHITE_MARK} alt="Hire Power" />
}

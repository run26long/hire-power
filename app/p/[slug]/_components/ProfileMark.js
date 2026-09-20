'use client'

import { useResolvedProfileMode } from '@/lib/profileColorMode'

// ============================================================================
// THE HIRE POWER WORDMARK, ON WHICHEVER GROUND IT LANDS ON
//
// The one mark on the Career Profile that cannot be a token. It is a raster,
// a raster cannot be recoloured by CSS without turning it into a silhouette,
// and the white one is invisible the moment the page is not dark. So the mode
// picks the file.
//
// Both files already existed. Nothing here was generated: the white mark is
// the one the Profile has always used, and the dark one is the wordmark the
// rest of the application uses on its own light pages.
//
// The two are not the same shape - the white file is trimmed tighter, so at a
// fixed height the dark mark renders a few pixels narrower. Both sit at the
// end of a flex row with nothing depending on their width, so the difference
// shows as a slightly different mark and not as a moved layout.
//
// One component rather than the three copies of this decision it replaces, so
// a third asset or a third mode is one edit.
// ============================================================================

const MARK = {
  dark: '/images/hire-power-logo-white-v2.png',
  light: '/images/HIRE_POWER_LOGO.png',
}

export default function ProfileMark({ className }) {
  const mode = useResolvedProfileMode()
  return <img className={className} src={MARK[mode]} alt="Hire Power" />
}

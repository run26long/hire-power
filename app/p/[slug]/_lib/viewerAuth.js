'use client'

import { useCallback } from 'react'

import { createClient } from '@/utils/supabase/client'

// ============================================================================
// WHO IS LOOKING, ASKED OF THE SESSION RATHER THAN OF THE EDITOR
//
// The private media route decides for itself whether the caller owns the
// profile: it reads the bearer token, resolves the user, and compares that
// user against the profile's owner. A draft profile serves its files to
// nobody else. So the only thing the page has to do is send the token it
// already has.
//
// It used to get that token from the edit context, and the edit context is
// null unless the owner is actively editing. Three ways of looking at the
// same draft profile therefore behaved differently:
//
//   Edit mode            token sent, files served
//   Preview mode         no context, no token, every file 404
//   the /p/<slug> link    no context at all, same
//
// Preview and the real link are how an owner checks their own work before
// publishing it, and both of them showed a page with none of its pictures.
// That is not a preview of anything.
//
// This asks the browser session instead, which exists in all three and does
// not care which mode the page is in. There is no gate here on being the
// owner, because this is not where that question belongs: a signed-in visitor
// looking at somebody else's profile sends their own token, the route finds
// they are not the owner, and the profile has to be published for them the
// way it always did. Nothing is widened by sending a token; the route decides
// what it is worth.
//
// No session, storage blocked, or the client refusing to build at all: no
// header, which is exactly a public reader.
//
// The identity is stable, so a grid of twenty tiles does not re-sign every
// thumbnail each time something unrelated renders.
// ============================================================================

export function useViewerAuthHeaders() {
  return useCallback(async () => {
    try {
      const { data } = await createClient().auth.getSession()
      const token = data?.session?.access_token
      return token ? { Authorization: `Bearer ${token}` } : {}
    } catch {
      return {}
    }
  }, [])
}

'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }) {
  useEffect(() => {
    try {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        capture_pageview: true,
        capture_pageleave: true,
        on_request_error: () => {
          // Swallow blocked/failed PostHog requests silently.
          // Privacy blockers (Pi-hole, NextDNS, uBlock) will trip this constantly.
        },
      })
    } catch (e) {
      // PostHog init itself failed. Non-fatal — analytics simply won't run for this user.
      console.warn('PostHog init failed:', e)
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
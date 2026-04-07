import posthog from 'posthog-js'

export function track(event, properties = {}) {
  try {
    posthog.capture(event, properties)
  } catch (e) {
    // silent fail — analytics should never break the app
  }
}
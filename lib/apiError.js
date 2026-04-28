import { NextResponse } from 'next/server';

/**
 * Returns a clean, user-safe error response from an API route.
 *
 * - Logs the original error server-side
 * - Returns a generic, copy-controlled message to the client
 * - Never leaks error.message, stack traces, SDK internals, or DB internals
 *
 * Usage:
 *   try { ... }
 *   catch (error) {
 *     return apiError(error, "Couldn't analyze the resume. Please try again.");
 *   }
 *
 * Optional 3rd argument: HTTP status code (defaults to 500).
 * Optional 4th argument: error code string for client-side mapping.
 */
export function apiError(error, userMessage, status = 500, code = null) {
  console.error('API error:', error);

  const body = { error: userMessage };
  if (code) body.code = code;

  return NextResponse.json(body, { status });
}
/**
 * Wrapper around fetch() that:
 * - Checks response.ok before parsing
 * - Validates Content-Type is JSON before calling .json()
 * - Throws a clean Error with the server's message (or a generic fallback)
 *   so callers can use try/catch + setErrorToast cleanly
 *
 * Usage:
 *   try {
 *     const data = await fetchJSON('/api/something', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({ foo: 'bar' }),
 *     });
 *     // use data
 *   } catch (err) {
 *     setErrorToast(err.message);
 *   }
 *
 * If the API returns { error: "...", code: "..." }, the thrown Error
 * will have err.message = the error string and err.code = the code.
 */
export async function fetchJSON(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (networkError) {
    // Network failure, DNS issue, browser offline, etc.
    throw new Error("We couldn't reach the server. Check your connection and try again.");
  }

  // Check Content-Type — non-JSON 500 pages from Vercel return HTML
  const contentType = response.headers.get('content-type') || '';
  const isJSON = contentType.includes('application/json');

  if (!response.ok) {
    // Try to parse the error body if it's JSON
    if (isJSON) {
      try {
        const errorBody = await response.json();
        const err = new Error(errorBody.error || 'Something went wrong. Please try again.');
        if (errorBody.code) err.code = errorBody.code;
        err.status = response.status;
        throw err;
      } catch (parseError) {
        // If parsing failed, fall through to generic
        if (parseError instanceof Error && parseError.message) throw parseError;
      }
    }
    const err = new Error('Something went wrong. Please try again.');
    err.status = response.status;
    throw err;
  }

  // Response is OK — parse JSON body
  if (!isJSON) {
    throw new Error('The server returned an unexpected response. Please try again.');
  }

  try {
    return await response.json();
  } catch {
    throw new Error('The server returned an unexpected response. Please try again.');
  }
}
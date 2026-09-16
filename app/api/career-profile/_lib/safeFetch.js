import dns from 'node:dns/promises'
import https from 'node:https'
import http from 'node:http'
import net from 'node:net'

// ============================================================================
// FETCHING A URL SOMEBODY ELSE CHOSE
//
// This exists for one feature - reading the OG tags off a link an owner is
// adding as evidence - and it is the single most dangerous shape in the
// product. A server that fetches an arbitrary URL on request is a server that
// will fetch the things only it can reach: the cloud metadata endpoint, an
// internal admin panel, a database on a private subnet, a localhost port.
//
// So the rules, and why each one is here rather than in a list of nice ideas.
//
// SCHEMES
// http and https only. file: reads the disk. gopher: and dict: can be used to
// speak to other protocols entirely. Anything not on the allowlist is refused
// before it is parsed further.
//
// PORTS
// 80 and 443 only. A URL is not made safe by its hostname when the port is
// 6379: the interesting internal targets are almost all on other ports, and an
// OG tag has never been served from one.
//
// ADDRESSES
// Every address the hostname resolves to is checked, not just the first, and a
// single bad one refuses the whole request. Loopback, the three RFC1918
// ranges, carrier-grade NAT, link-local - which is where 169.254.169.254 lives
// and is the reason link-local matters more than the private ranges - plus
// unspecified, multicast and reserved space. The v6 equivalents, and v6
// addresses that embed a v4 one, because ::ffff:127.0.0.1 is a loopback
// address written so that a naive string check misses it.
//
// DNS REBINDING, AND WHY THE LOOKUP IS PINNED
// Checking the address and then calling fetch() leaves a gap: the name can
// resolve to something else between the check and the connection, and the
// check becomes theatre. So the addresses are resolved once, validated, and
// then handed to the socket through a `lookup` that returns only what was
// already approved. The connection goes to an address this module has seen.
//
// REDIRECTS
// Followed by hand, three at most, and every hop goes through the whole of the
// above again. A redirect is a fresh URL chosen by a server we do not trust,
// and the common bypass is an allowed host answering 302 to 127.0.0.1.
//
// SIZE AND TIME
// One megabyte and five seconds. The body is abandoned mid-stream the moment
// it passes the cap, so a response that never ends cannot hold a connection
// open by being interesting, and a page larger than the cap still yields the
// head that was read before it was cut off.
//
// WHAT IT STILL DOES NOT DO
// It does not make the response trustworthy. Everything read out of the body
// is text chosen by a stranger, and it reaches the owner as a form field they
// can see and change before anything is stored.
// ============================================================================

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])
const ALLOWED_PORTS = new Set([80, 443])

export const MAX_BYTES = 1024 * 1024
export const TIMEOUT_MS = 5000
export const MAX_REDIRECTS = 3

// ---------------------------------------------------------------------------
// Is this address one the public internet can reach?
// ---------------------------------------------------------------------------
function isBlockedIPv4(address) {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b] = parts

  if (a === 0) return true                              // 0.0.0.0/8, "this network"
  if (a === 10) return true                             // RFC1918
  if (a === 127) return true                            // loopback
  if (a === 100 && b >= 64 && b <= 127) return true     // carrier-grade NAT
  if (a === 169 && b === 254) return true               // link-local, incl. 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true      // RFC1918
  if (a === 192 && b === 168) return true               // RFC1918
  if (a === 192 && b === 0) return true                 // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true  // benchmarking
  if (a >= 224) return true                             // multicast and reserved
  return false
}

function isBlockedIPv6(address) {
  const lower = address.toLowerCase().split('%')[0]

  if (lower === '::' || lower === '::1') return true     // unspecified, loopback

  // A v4 address wearing a v6 spelling. ::ffff:127.0.0.1 is loopback, and so
  // is its hex form, so the embedded address is checked as v4.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isBlockedIPv4(mapped[1])
  const hexMapped = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hexMapped) {
    const high = parseInt(hexMapped[1], 16)
    const low = parseInt(hexMapped[2], 16)
    return isBlockedIPv4([high >> 8 & 255, high & 255, low >> 8 & 255, low & 255].join('.'))
  }

  if (/^f[cd]/.test(lower)) return true                  // unique local
  if (/^fe[89ab]/.test(lower)) return true               // link-local
  if (/^ff/.test(lower)) return true                     // multicast
  return false
}

export function isBlockedAddress(address) {
  const version = net.isIP(address)
  if (version === 4) return isBlockedIPv4(address)
  if (version === 6) return isBlockedIPv6(address)
  return true    // not an address at all
}

// ---------------------------------------------------------------------------
// The URL, and everywhere its hostname points.
// ---------------------------------------------------------------------------
async function resolveAndCheck(rawUrl) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    return { error: "That doesn't look like a web address." }
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { error: 'Only http and https links can be previewed.' }
  }

  const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80)
  if (!ALLOWED_PORTS.has(port)) {
    return { error: 'Only standard web ports can be previewed.' }
  }

  // A literal address in the URL never reaches DNS, so it is checked directly.
  const literal = net.isIP(url.hostname.replace(/^\[|\]$/g, ''))
  if (literal) {
    const address = url.hostname.replace(/^\[|\]$/g, '')
    if (isBlockedAddress(address)) return { error: 'That address cannot be reached from here.' }
    return { url, port, addresses: [{ address, family: literal }] }
  }

  let addresses
  try {
    addresses = await dns.lookup(url.hostname, { all: true, verbatim: true })
  } catch {
    return { error: "We couldn't find that site." }
  }
  if (!addresses.length) return { error: "We couldn't find that site." }

  // Every one of them. A name that answers with one public and one private
  // address is the oldest trick here, and taking the first would fall for it.
  for (const entry of addresses) {
    if (isBlockedAddress(entry.address)) {
      return { error: 'That address cannot be reached from here.' }
    }
  }

  return { url, port, addresses }
}

// ---------------------------------------------------------------------------
// One hop, to an address already approved.
// ---------------------------------------------------------------------------
function requestOnce({ url, port, addresses }) {
  return new Promise((resolve) => {
    const client = url.protocol === 'https:' ? https : http

    // The socket connects to what was validated, not to whatever the resolver
    // says at connect time. This is the whole DNS-rebinding defence.
    const pinnedLookup = (_hostname, options, callback) => {
      if (options && options.all) return callback(null, addresses)
      const first = addresses[0]
      return callback(null, first.address, first.family)
    }

    const request = client.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        lookup: pinnedLookup,
        headers: {
          // Named honestly. A preview fetcher pretending to be a browser is a
          // preview fetcher that cannot be blocked by a site that would rather
          // not be read.
          'User-Agent': 'HirePower-LinkPreview/1.0 (+https://HirePowerAI.com)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Encoding': 'identity'
        }
      },
      (response) => {
        const status = response.statusCode || 0

        if (status >= 300 && status < 400 && response.headers.location) {
          response.destroy()
          resolve({ redirect: response.headers.location })
          return
        }

        if (status < 200 || status >= 300) {
          response.destroy()
          resolve({ error: 'That link did not answer.' })
          return
        }

        const type = String(response.headers['content-type'] || '')
        if (type && !/^\s*(text\/html|application\/xhtml\+xml)/i.test(type)) {
          response.destroy()
          resolve({ error: 'That link is not a web page.' })
          return
        }

        // Content-Length is deliberately NOT consulted. There is exactly one
        // size bound here and it is enforced on bytes actually read, because
        // a declared length is a claim by the same server we are guarding
        // against - refusing on it would catch only honest large pages while
        // a liar still had to be stopped mid-stream. Reading the first
        // megabyte of a long article and taking its head out is also the
        // useful answer, where refusing it outright gives the owner nothing.

        const chunks = []
        let size = 0
        response.on('data', (chunk) => {
          size += chunk.length
          if (size > MAX_BYTES) {
            // Abandoned mid-stream. Reading to the end first would make the
            // cap a suggestion.
            response.destroy()
            resolve({ html: Buffer.concat(chunks).toString('utf8'), truncated: true })
            return
          }
          chunks.push(chunk)
        })
        response.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8') }))
        response.on('error', () => resolve({ error: "We couldn't read that page." }))
      }
    )

    request.setTimeout(TIMEOUT_MS, () => {
      request.destroy()
      resolve({ error: 'That link took too long to answer.' })
    })
    request.on('error', () => resolve({ error: "We couldn't reach that link." }))
    request.end()
  })
}

// ---------------------------------------------------------------------------
// The whole thing: validate, fetch, follow, validate again.
// ---------------------------------------------------------------------------
export async function fetchPageSafely(rawUrl) {
  let target = rawUrl
  const seen = []
  // Whether a socket was ever opened. A URL refused for its scheme, its port
  // or its address costs nothing outbound, and the caller uses this to avoid
  // charging it against the quota meant for real requests.
  let attempted = false

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const checked = await resolveAndCheck(target)
    if (checked.error) return { error: checked.error, attempted }

    // A redirect loop that stays inside the hop budget still gets nowhere, and
    // saying so is better than spending the budget.
    const key = checked.url.toString()
    if (seen.includes(key)) return { error: 'That link redirects in a circle.', attempted }
    seen.push(key)

    attempted = true
    const result = await requestOnce(checked)

    if (result.redirect) {
      if (hop === MAX_REDIRECTS) return { error: 'That link redirects too many times.', attempted }
      // Resolved against the current URL, so a relative Location works and an
      // absolute one replaces it - and either way the next pass validates it
      // from scratch.
      try {
        target = new URL(result.redirect, checked.url).toString()
      } catch {
        return { error: 'That link redirects somewhere we cannot follow.', attempted }
      }
      continue
    }

    if (result.error) return { error: result.error, attempted }
    return { html: result.html, finalUrl: checked.url.toString(), attempted }
  }

  return { error: 'That link redirects too many times.', attempted }
}

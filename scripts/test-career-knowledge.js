/**
 * Throwaway test script for /api/career-knowledge.
 *
 * Posts a canned two-turn transcript so the endpoint can be exercised without
 * running a full coaching session.
 *
 * The route authenticates strictly via a user bearer token (no internal-secret
 * bypass), so you must supply a real Supabase access token. This script does
 * NOT mint one — see the README block at the bottom of this file for how to
 * grab one from the browser.
 *
 * Usage (from the repo root, with the dev server running on :3000):
 *
 *   SUPABASE_ACCESS_TOKEN=eyJ... node scripts/test-career-knowledge.js
 *
 * or pass it as the first argument:
 *
 *   node scripts/test-career-knowledge.js eyJ...
 */

const TOKEN = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN
const URL = process.env.CAREER_KNOWLEDGE_URL || 'http://localhost:3000/api/career-knowledge'

if (!TOKEN) {
  console.error('Missing token. Pass it as argv[2] or set SUPABASE_ACCESS_TOKEN.')
  console.error('See the comment at the bottom of this file for how to get one.')
  process.exit(1)
}

// Two turns, one obvious extractable fact: the GSA Schedule 70 contract work.
const transcript = [
  { role: 'assistant', content: 'What kind of contracts did you handle in that role?' },
  { role: 'user', content: "I managed our GSA Schedule 70 contracts for federal IT procurement for about four years. I was the only person on the team who knew how to do the annual price list updates." }
]

// Deliberately thin, so nothing in the transcript is filtered out as
// "already on the resume."
const resumeData = {
  fullName: 'Test Candidate',
  summary: '',
  experience: [
    {
      title: 'Contracts Administrator',
      company: 'Example Corp',
      bullets: ['Supported the contracts team with document management']
    }
  ],
  skillsCategories: {}
}

async function main() {
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      action: 'extract',
      resumeId: null,
      transcript,
      resumeData,
      jobTitle: 'Contracts Specialist',
      jobCompany: 'Test Company'
    })
  })

  const text = await res.text()
  console.log('HTTP', res.status, res.statusText)
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2))
  } catch {
    console.log('Non-JSON response body:')
    console.log(text)
  }
}

main().catch(err => {
  console.error('Request failed:', err)
  process.exit(1)
})

/**
 * HOW TO GET A TOKEN
 *
 * This repo has no script-based auth path, and the route requires a real user
 * JWT (SUPABASE_SERVICE_ROLE_KEY and INTERNAL_API_SECRET will NOT work — the
 * route calls supabase.auth.getUser(token) and rejects anything that does not
 * resolve to a user).
 *
 * Easiest option — copy it out of a logged-in browser session:
 *   1. Log in to the app at http://localhost:3000
 *   2. Open DevTools > Console
 *   3. Run:  JSON.parse(Object.entries(localStorage).find(([k]) => k.includes('auth-token'))[1]).access_token
 *   4. Copy the string it prints (starts with "eyJ") and pass it to this script.
 *
 * Tokens expire in about an hour, so re-copy if you start getting 401s.
 */

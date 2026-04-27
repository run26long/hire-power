// Parses capture tags out of assistant message text and returns:
//   - cleanText: the message with all [CAPTURED:...] tags stripped (for chat display)
//   - captures: array of { type, payload } objects parsed from the tags
//
// Tag format: [CAPTURED:type · payload]
// Types: job, education, skill, achievement

const TAG_REGEX = /\[CAPTURED:(job|education|skill|achievement)\s*·\s*([^\]]+)\]/g

export function parseCaptureTags(text) {
  if (!text || typeof text !== 'string') {
    return { cleanText: text || '', captures: [] }
  }

  const captures = []
  let match

  // Reset regex state for each call
  TAG_REGEX.lastIndex = 0

  while ((match = TAG_REGEX.exec(text)) !== null) {
    captures.push({
      type: match[1],
      payload: match[2].trim()
    })
  }

  // Strip tags from displayed text. Also clean up any orphaned newlines left behind.
  const cleanText = text
    .replace(TAG_REGEX, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { cleanText, captures }
}

// Replays an entire message history and returns aggregated counts + achievement list.
// Used on page load to rebuild counter state from saved coaching_conversation.
export function replayCaptures(messages) {
  const counts = { jobs: 0, education: 0, skills: 0, wins: 0 }
  const achievements = []
  const seenJobs = new Set()
  const seenEducation = new Set()
  const seenSkills = new Set()
  const seenAchievements = new Set()

  if (!Array.isArray(messages)) return { counts, achievements }

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue

    const content = typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.map(b => b.text || '').join(' ')
        : ''

    const { captures } = parseCaptureTags(content)

    for (const capture of captures) {
      const key = capture.payload.toLowerCase()

      if (capture.type === 'job' && !seenJobs.has(key)) {
        seenJobs.add(key)
        counts.jobs++
      } else if (capture.type === 'education' && !seenEducation.has(key)) {
        seenEducation.add(key)
        counts.education++
      } else if (capture.type === 'skill' && !seenSkills.has(key)) {
        seenSkills.add(key)
        counts.skills++
      } else if (capture.type === 'achievement' && !seenAchievements.has(key)) {
        seenAchievements.add(key)
        counts.wins++
        achievements.push(capture.payload)
      }
    }
  }

  return { counts, achievements }
}
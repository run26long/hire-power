// ============================================================================
// THE CAREER COACH HANDOFF PHRASE
//
// The coach signals it has finished by saying one exact sentence, and two
// places watch for it: the route that decides a conversation is complete, and
// the page that decides whether to show the button. The sentence itself is
// written into the system prompt, so three things have to agree.
//
// They did not agree for a moment during the Resume Coach rename: the prompt
// started saying "Resume Writer" while both watchers were still looking for
// "Resume Coach", which would have left every finished conversation looking
// unfinished. Hence one file.
//
// BOTH SPELLINGS MATCH, AND THAT IS NOT TRANSITIONAL
// Conversations already in the database contain the old sentence, and they are
// read back every time somebody reopens one. Matching only the new spelling
// would take the button away from anybody mid-flow when this shipped, and
// would keep taking it away from anybody who returns to an old conversation
// later. The old phrase costs one comparison and never expires.
// ============================================================================

const PHRASES = [
  'continue to resume writer',
  // What the prompt said before the rename. Kept for stored conversations.
  'continue to resume coach'
]

export function signalsHandoff(message) {
  if (typeof message !== 'string' || !message) return false
  const text = message.toLowerCase()
  return PHRASES.some(phrase => text.includes(phrase))
}

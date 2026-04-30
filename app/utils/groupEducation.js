// Groups consecutive education entries from the same school.
// Two entries are considered "same school" if their school names match
// after lowercasing and trimming. Non-consecutive entries stay separate
// (e.g., BS from UCF, MS from UF, Doctorate from UCF renders as three
// separate blocks — preserves the chronological story).
//
// Returns an array of groups. Each group has:
//   - school: the school name (from the first entry in the group)
//   - location: the location (from the first entry in the group)
//   - degrees: array of the original entries, ordered as they appeared
//
// Single-degree "groups" are valid — most education entries will be
// groups of one.

export function groupEducation(education) {
  if (!Array.isArray(education) || education.length === 0) return [];

  const normalize = (str) => (str || '').trim().toLowerCase();

  const groups = [];
  let currentGroup = null;

  for (let i = 0; i < education.length; i++) {
    const entry = education[i];
    const schoolKey = normalize(entry.school);
    const entryWithIndex = { ...entry, _originalIndex: i };

    if (currentGroup && normalize(currentGroup.school) === schoolKey && schoolKey !== '') {
      // Same school as previous — add to current group.
      currentGroup.degrees.push(entryWithIndex);
    } else {
      // New group.
      currentGroup = {
        school: entry.school || '',
        degrees: [entryWithIndex],
      };
      groups.push(currentGroup);
    }
  }

  // For each group, pick the location from the first (most recent) entry.
  for (const group of groups) {
    const firstEntry = group.degrees[0];
    group.location = firstEntry.location || '';
  }

  return groups;
}
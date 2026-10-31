'use client';

// ============================================================================
// THE CAREER PROFILE, IN MINIATURE
//
// A drawing of the public profile's masthead, for the slot on the Resume
// Writer hub that points at it. Decorative throughout: it is a picture of a
// page, not a control, so it is aria-hidden and takes no pointer events, and
// the card it sits on carries the real heading, the real sentence and the real
// button.
//
// WHY IT CARRIES REAL DATA
// A generic mock-up of a profile says "some people have one of these". The
// owner's own name, their own directions and their own numbers say "this one
// is yours, and it is already written". The fallback exists for the case where
// that is not true yet - before coaching, and for a profile the generator has
// not finished - and it is one fixed sample rather than a half-empty version
// of the real thing, because a drawing with three blank numbers in it is an
// advert for an empty page.
//
// WHY THE TYPE IS DECLARED HERE RATHER THAN READ FROM A TOKEN
// The public profile's fonts live in --profile-font-display / -voice / -ui,
// declared on `.hp-profile, .hp-tm` in app/p/[slug]/_styles/tokens.css. The
// hub imports none of that stylesheet, so those properties resolve to nothing
// here. The three stacks are therefore spelled out below, copied from that
// file, so the miniature is set in the same faces as the page it is a picture
// of. --font-geist-sans is on <body> from the root layout and Source Serif 4
// is loaded there too, so both are really available; only the names were out
// of scope.
//
// WHY INLINE STYLE OBJECTS
// Every value here is a specific number - 6.5px type, a vertical-rl label, a
// -3deg rotation - and the hub already styles this way wherever Tailwind's
// scale does not reach. Writing them as utilities would mean inventing a dozen
// arbitrary classes for one drawing.
// ============================================================================

// Copied from app/p/[slug]/_styles/tokens.css. See the note above.
const FONT_DISPLAY = "var(--font-geist-sans), 'Inter Tight', 'DM Sans', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_UI = "var(--font-geist-sans), 'DM Sans', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_VOICE = "'Source Serif 4', Georgia, serif";

// The house lightning mark, the same path the share-card route draws at
// app/api/career-profile/og/[slug]/route.js.
// Exported: the hub's Go Pro links draw the same mark in the same gradient
// chip, and two copies of a path is two things to get wrong.
export const BOLT = 'M13 2 L3 14 h7 l-1 8 l10 -12 h-7 l1 -8 z';

// ---- THE NAME HAS TO FIT ----
//
// The left column is 150px and the name is set at 27px/900 with the tracking
// pulled in hard, which holds about nine characters. A longer one is scaled
// down rather than wrapped: the two-line break is part of the drawing, and a
// third line would push the tagline into the body row.
//
// Measured by character count rather than by the DOM. A real measurement would
// mean rendering at full size, reading the width and rendering again, which is
// two passes and a layout flash for a decoration - and it would have nothing
// to measure during the server render. The coefficient is the average advance
// of a capital in this face at this weight and tracking, as a fraction of the
// font size; it only has to be close, because `.mini` clips anything that
// still does not fit.
const NAME_MAX_PX = 27;
const NAME_COLUMN_PX = 150;
const NAME_ADVANCE = 0.56;

function nameFontSize(lines) {
  const longest = Math.max(1, ...lines.map(line => line.length));
  return Math.min(NAME_MAX_PX, NAME_COLUMN_PX / (longest * NAME_ADVANCE));
}

// "Daniel Mercer" draws as "Daniel" over "Mercer." - the given name on its own
// line and the stop after the last word, which is how the public page sets it.
// A single-word name is one line and keeps the stop.
function nameLines(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length === 1) return [`${words[0]}.`];
  return [words[0], `${words.slice(1).join(' ')}.`];
}

// Two lines and then an ellipsis, for the tagline and for each small caption.
// -webkit-box is the only line clamp with real support; it is what the public
// profile's own sections use.
const clamp = (lines) => ({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: lines,
  overflow: 'hidden'
});

/**
 * @param {string}   name        as the public page shows it
 * @param {string[]} directions  visible Career Directions, in public order
 * @param {string}   headline    the leading direction's headline
 * @param {{num: string, label: string}[]} proofPoints
 *                               that direction's proof points, in public
 *                               order. The first is the big number.
 */
export default function MiniProfileCard({ name, directions = [], headline = '', proofPoints = [] }) {
  const lines = nameLines(name);
  const nameSize = nameFontSize(lines);
  // Three slots in the drawing and no more, whatever arrives.
  const tabs = (Array.isArray(directions) ? directions : []).slice(0, 2);
  const proofs = (Array.isArray(proofPoints) ? proofPoints : []).slice(0, 3);

  return (
    <div
      aria-hidden="true"
      style={{
        // Parked against the top-right of whatever window it is given and
        // scaled down into it, so the card that holds it decides how much of
        // the page shows rather than this component guessing. The origin is
        // top right for the same reason: scaling from there keeps the
        // masthead - the part worth reading - pinned where it was put.
        position: 'absolute',
        right: -34,
        top: -14,
        zIndex: 1,
        pointerEvents: 'none',
        // Clipped, deliberately: it is the backstop behind the name's own
        // sizing, and it keeps the shadow's own box off the card's padding.
        overflow: 'hidden',
        width: 330,
        height: 210,
        borderRadius: 12,
        background: 'linear-gradient(160deg,#241a3d 0%,#1a1330 60%,#160f28 100%)',
        border: '1px solid rgba(255,255,255,.09)',
        boxShadow: '0 24px 50px rgba(40,20,90,.38),0 4px 12px rgba(40,20,90,.18)',
        transform: 'rotate(-3deg) scale(.72)',
        transformOrigin: 'top right',
        padding: '12px 14px',
        fontFamily: FONT_UI
      }}
    >
      {/* ---- The masthead row ---- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 800, fontSize: 7, letterSpacing: '.02em', color: '#fff' }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: '#fff', display: 'grid', placeItems: 'center' }}>
            <svg width="6" height="6" viewBox="0 0 24 24" fill="#1a1330">
              <path d={BOLT} />
            </svg>
          </span>
          HIRE POWER
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 6, padding: '4px 6px', borderRadius: 3, border: '1px solid rgba(255,255,255,.18)', color: '#e5e1f5' }}>
            Download resume
          </span>
          <span style={{ fontWeight: 600, fontSize: 6, padding: '4px 6px', borderRadius: 3, background: '#6d3fd8', border: '1px solid #6d3fd8', color: '#fff' }}>
            Contact
          </span>
        </div>
      </div>

      {/* ---- The direction tabs ----
          Indented past the left column so they sit over the body the way the
          real nav sits over the spread. */}
      <div style={{ display: 'flex', gap: 12, margin: '12px 0 0 118px', fontWeight: 600, fontSize: 6.5, color: '#cfc8e6', whiteSpace: 'nowrap' }}>
        {tabs.map((tab, i) => (
          <span
            key={`${tab}-${i}`}
            style={i === 0
              ? { color: '#fff', boxShadow: '0 2px 0 #a78bfa', paddingBottom: 3 }
              : undefined}
          >
            {tab}
          </span>
        ))}
      </div>

      {/* ---- The spread ---- */}
      <div style={{ display: 'flex', marginTop: 10 }}>
        <div style={{ width: NAME_COLUMN_PX }}>
          <div style={{ fontWeight: 800, fontSize: 5.5, letterSpacing: '.22em', color: '#a78bfa', marginBottom: 5 }}>
            CAREER PROFILE
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: nameSize, lineHeight: 0.9, letterSpacing: '-.045em', color: '#fff' }}>
            {lines.map((line, i) => (
              <span key={i} style={{ display: 'block' }}>{line}</span>
            ))}
          </div>
          <div style={{ fontFamily: FONT_VOICE, marginTop: 8, fontSize: 7.4, lineHeight: 1.35, color: '#d9d3ee', ...clamp(2) }}>
            {headline}
          </div>
        </div>

        <div style={{ position: 'relative', flex: 1, paddingLeft: 22, marginTop: 22 }}>
          <div style={{ position: 'absolute', left: 4, top: 4, writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 800, fontSize: 4.8, letterSpacing: '.24em', color: '#8b7bc4' }}>
            SELECTED PROOF
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 26, lineHeight: 1, letterSpacing: '-.04em', color: '#fff' }}>
            {proofs[0]?.num}
          </div>
          <div style={{ fontSize: 6, color: '#cfc8e6', marginTop: 3, ...clamp(2) }}>
            {proofs[0]?.label}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            {proofs.slice(1).map((proof, i) => (
              <div key={i}>
                <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 900, fontSize: 13, lineHeight: 1, color: '#fff' }}>
                  {proof.num}
                </div>
                <div style={{ fontSize: 5.2, color: '#b9b1d6', marginTop: 3, ...clamp(2) }}>
                  {proof.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

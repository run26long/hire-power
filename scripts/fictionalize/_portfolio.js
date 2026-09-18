// ============================================================================
// READING lib/portfolio.js FROM A CJS SCRIPT
//
// lib/portfolio.js owns the single rule that decides whether an item belongs to
// the Portfolio or to Evidence. Its header is explicit that two places deciding
// that question is two places that can disagree, and that the failure mode is
// an item appearing in both sections or in neither. So this does not restate
// the rule.
//
// It cannot be required directly: the file is ESM in a package with no
// "type": "module", so Node parses it as CJS and throws on the first export.
// Rather than copy the logic, the source is read, its `export ` keywords are
// stripped, and it is evaluated as the CommonJS module it almost already is.
// Nothing in that file imports anything, which is what makes this safe.
//
// If it ever grows an import, this throws with a clear message instead of
// silently falling back to a stale copy of the rule.
// ============================================================================

const fs = require('fs')
const path = require('path')
const vm = require('vm')

const SOURCE = path.join(__dirname, '..', '..', 'lib', 'portfolio.js')

function load() {
  const src = fs.readFileSync(SOURCE, 'utf8')

  if (/^\s*import\s/m.test(src)) {
    throw new Error(
      SOURCE + ' now has imports, so it can no longer be evaluated standalone. '
      + 'Fix this loader rather than copying the Portfolio/Evidence rule into the scripts.'
    )
  }

  const module = { exports: {} }
  const cjs = src.replace(/^\s*export\s+(const|function|default)\s/gm, '$1 ')
    // Re-export whatever the file defined at top level, by name.
    + '\n;(' + JSON.stringify(namesIn(src)) + ').forEach(n => { try { module.exports[n] = eval(n) } catch {} });'

  vm.runInNewContext(cjs, { module, exports: module.exports, console })

  if (typeof module.exports.isPortfolioItem !== 'function') {
    throw new Error('lib/portfolio.js no longer exports isPortfolioItem; fix this loader.')
  }
  return module.exports
}

// Every top-level binding the file exports, by name.
function namesIn(src) {
  const out = []
  const re = /^\s*export\s+(?:const|function)\s+([A-Za-z_$][\w$]*)/gm
  let m
  while ((m = re.exec(src)) !== null) out.push(m[1])
  return out
}

const api = load()

module.exports = {
  isPortfolioItem: api.isPortfolioItem,
  isEvidenceItem: api.isEvidenceItem,
  splitCollection: api.splitCollection,
  PORTFOLIO_PREVIEW_DESKTOP: api.PORTFOLIO_PREVIEW_DESKTOP,
  FREE_VISUAL_UPLOADS: api.FREE_VISUAL_UPLOADS
}

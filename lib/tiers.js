// ============================================================================
// WHAT EACH PLAN MAY DO
//
// One vocabulary for the whole platform. Before this file there were three,
// and they disagreed: the Career Profile asked canCustomiseProfile, the
// recruiter tools asked isEntitledTier, and everything else wrote
// `tier === 'pro'` inline in about fifteen places. That third one is not a
// question about entitlement, it is a question about one plan, and using it
// as an entitlement check is what made a Vault subscriber - somebody paying
// to keep their career on file - unable to open the job-specific resumes they
// built while they were on Pro.
//
// THE TWO QUESTIONS THAT ARE NOT THE SAME QUESTION
// "May this account make something new?" and "May this account use what it
// already made?" have different answers, and every gap in the tier audit came
// from a predicate that could only ask the first. Vault is the whole reason:
// it is the plan for somebody who has stopped building and wants to keep what
// they built. So the two are named separately here and can never collapse
// back into one `isPro`.
//
// WHY maintenance IS EVERYWHERE VAULT IS
// It is what a Vault subscription is called mid-change-of-plan. Before this
// file it was known only to MainNav and to profileTier, which meant a
// maintenance account was treated as free by the Resume Writer, Interview
// Practice, cover letters and the Vault itself. Nobody agreed to lose their
// work by changing how they pay for it.
//
// ANYTHING UNRECOGNISED IS FREE
// Including null, undefined, and a tier this build has never heard of. The
// failure mode of guessing generously is a free account inside a paid
// feature; the failure mode of guessing strictly is a paying account seeing
// an upgrade prompt, which is visible, reportable and fixable. Strict wins.
// This is the same rule profileTier.js states, for the same reason.
// ============================================================================

// Every plan that is paying something. The set Vault exists to be in.
const PAID_TIERS = new Set(['pro', 'vault', 'maintenance'])

// Pro alone. Named for what it gates rather than for the plan, so a reader at
// the call site sees the rule and not the price list.
const BUILDING_TIERS = new Set(['pro'])

// ---- May this account make something new? ----------------------------------
// New core resumes, new job-specific resumes, new career directions. Vault
// deliberately cannot: it keeps a career, it does not grow one.
export const canCreateResumes = (tier) => BUILDING_TIERS.has(tier)

// ---- May this account use what it already made? ----------------------------
// Opening and downloading existing resumes and cover letters, reading past
// interview transcripts. Everything a lapsed Pro built stays theirs on Vault.
export const canAccessBuiltWork = (tier) => PAID_TIERS.has(tier)

// ---- The Career Profile's tools ---------------------------------------------
// Recruiter tools on the public profile, video IMOW, privacy controls on
// evidence, and the visual upload allowance behind them.
//
// These were Pro alone, on the reasoning that they are an ongoing service
// rather than something the owner built. That reasoning does not survive the
// page they sit on: a Career Profile with its recruiter tools switched off is
// not the same profile with less of it, it is a different page, and Vault is
// the plan for keeping a profile rather than for keeping a reduced one. A
// profile is also the one thing here that other people read, so what it can do
// should not quietly change underneath the person whose name is on it.
//
// maintenance rides with Vault for the reason it always does: it is what a
// Vault subscription is called mid-change-of-plan, and nobody agreed to lose a
// feature by changing how they pay.
//
// Adding a new career direction is still Pro and is a different question: see
// UPGRADE_COPY.lenses_vault, and isEntitledTier, which still asks it.
export const canUseProTools = (tier) => PAID_TIERS.has(tier)

// ---- The Vault's own writing ------------------------------------------------
// Logging a win and preparing for a review. A free account can see what is in
// its Vault; adding to it is what the plan is for.
export const canLogWins = (tier) => PAID_TIERS.has(tier)
export const canUseReviewPrep = (tier) => PAID_TIERS.has(tier)

// ---- Ceilings ---------------------------------------------------------------
// The hub has three tiles and every one of them can be a resume, which is
// where MAX_CORES comes from; a direction can hold a core, so the two match.
export const MAX_LENSES = 3

// Three cover letters is the whole allowance on every plan but Pro. Vault is
// included on purpose: it keeps the three it wrote, and writing a fourth is
// building rather than keeping.
export const FREE_COVER_LETTERS = 3
export const coverLetterLimit = (tier) =>
  canCreateResumes(tier) ? Infinity : FREE_COVER_LETTERS

// ---- The refusals -----------------------------------------------------------
// One shape, so a client can branch on `code` rather than on a sentence, and
// so two routes refusing the same thing cannot word it two ways.
export const UPGRADE_REQUIRED = {
  error: 'This is part of Vault and Pro.',
  code: 'UPGRADE_REQUIRED'
}

export const PRO_REQUIRED = {
  error: 'This is a Pro feature.',
  code: 'PRO_REQUIRED'
}

// Where an upgrade prompt points. Vault features go to the plan page's Vault
// deep link, which /profile already handles; Pro features open the upgrade
// modal, which sells Pro and needs no href.
export { UPGRADE_HREF, UPGRADE_LABEL } from './profileTier.js'

// Customising a Career Profile is the same question as logging a win - may
// this account put its own words somewhere - and it was answered first in
// profileTier.js, with the reasoning. Re-exported rather than restated so
// there is one definition and the six profile routes that already import it
// keep working unchanged.
export { canCustomiseProfile } from './profileTier.js'

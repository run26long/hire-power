'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BrbLandingPage() {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [accountExists, setAccountExists] = useState(false)
  const [success, setSuccess] = useState(false)

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = showModal ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [showModal])

  // ESC closes modal
  useEffect(() => {
    if (!showModal) return
    const onKey = (e) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showModal])

  const openModal = (e) => {
    if (e) e.preventDefault()
    setShowModal(true)
    setError(null)
    setAccountExists(false)
  }

  const closeModal = () => {
    setShowModal(false)
    setError(null)
    setAccountExists(false)
  }

  const handleBackdropMouseDown = (e) => {
    e.currentTarget.dataset.downTarget = e.target === e.currentTarget ? 'backdrop' : 'inside'
  }
  const handleBackdropMouseUp = (e) => {
    if (e.target === e.currentTarget && e.currentTarget.dataset.downTarget === 'backdrop') {
      closeModal()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setAccountExists(false)
    try {
      const res = await fetch('/api/auth/signup-pro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, source: 'brb' })
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'ACCOUNT_EXISTS') {
          setAccountExists(true)
        } else {
          setError(data.error || 'Something went wrong. Please try again.')
        }
        return
      }
      const { createClient } = await import('@/utils/supabase/client')
      const supabase = createClient()
      await supabase.auth.signInWithPassword({ email, password })
      setSuccess(true)
      setTimeout(() => { window.location.href = data.checkoutUrl }, 800)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="shell">

        <section className="hero-a">
          <div className="hero-phone">
            <div className="ls-status">
              <span className="signal">5G</span>
              <span className="batt">87%</span>
            </div>
            <div className="ls-time">4:47</div>
            <div className="ls-date">monday · october 19</div>

            <div className="notif-stack">
              <div className="notif">
                <div className="ic mom">M</div>
                <div className="meta">
                  <div className="meta-top"><span className="app">mom</span><span className="when">4:13 pm</span></div>
                  <div className="msg">Did you finish your resume yet?</div>
                </div>
              </div>
              <div className="notif">
                <div className="ic li">in</div>
                <div className="meta">
                  <div className="meta-top"><span className="app">linkedin</span><span className="when">4:14 pm</span></div>
                  <div className="msg">sarah is now a product manager 🎉</div>
                </div>
              </div>
              <div className="notif brb-pop">
                <div className="ic brb">b</div>
                <div className="meta">
                  <div className="meta-top"><span className="app">brb</span><span className="when">now</span></div>
                  <div className="msg">no resume? good. let&apos;s fix that. 30 min, talk or type.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="below">
            <div className="hero-meta hero-meta-top">
              <span className="hm-frax">brb</span>
              <span className="hm-dot">·</span>
              best resume builder
              <span className="hm-dot">·</span>
              by Hire Power
            </div>
            <div className="pitch"><span className="hook">no resume?</span><span className="line">that&apos;s literally</span> <span className="punch">what we&apos;re here for.</span></div>
            <a href="#" className="cta" onClick={openModal}>write my resume</a>
            <div className="trust">mobile friendly · no laptop · talk or type</div>
          </div>
        </section>

        <div className="hero-meta hero-meta-bottom">
          <span className="hm-frax">brb</span>
          <span className="hm-dot">·</span>
          best resume builder
          <span className="hm-dot">·</span>
          by Hire Power
        </div>

        <div className="row">
          <div className="col">
            <div className="section-h">the notes</div>
            <section className="shot notes skew-right" style={{marginTop:'6px'}}>
              <div className="notes-head">
                <span>notes · personal</span>
                <span>edited just now</span>
              </div>
              <div className="title">ideas for my resume? maybe?</div>
              <div className="item done"><div className="check"></div>that summer i worked at target</div>
              <div className="item done"><div className="check"></div>tutored algebra for $20/hr</div>
              <div className="item"><div className="check"></div>treasurer of a club nobody came to</div>
              <div className="item"><div className="check"></div>ran my friend&apos;s etsy shop for 2 months</div>
              <div className="item"><div className="check"></div>that group project i actually did all of</div>
              <div className="scribble">^ all of it counts.</div>
            </section>
          </div>

          <div className="col">
            <div className="section-h">mom, again</div>
            <section className="shot imsg skew-left" style={{marginTop:'6px'}}>
              <div className="imsg-head">
                <div className="name">Mom</div>
              </div>
              <div className="time-marker"><span className="day">Today</span> 4:13 PM</div>
              <div className="b gray">Did you finish your resume yet?</div>
              <div className="b gray">Your cousin already has 3 interviews.</div>
              <div className="time-marker">6:18 PM</div>
              <div className="b gray">How&apos;s it going?</div>
              <div className="b blue">brb writing my resume</div>
              <div className="sticker" style={{bottom:'-14px',right:'16px',transform:'rotate(7deg)',fontSize:'16px',padding:'6px 12px'}}>every mom ever</div>
            </section>
          </div>
        </div>

        <div className="row row-match">
          <div className="col">
            <div className="section-h">your computer, 6:47 pm</div>
            <section className="shot blank-doc skew-right" style={{marginTop:'6px'}}>
              <div className="doc-bar">
                <div className="doc-dots"><span></span><span></span><span></span></div>
                <div className="doc-name">Resume_FINAL_v3.docx</div>
              </div>
              <div className="doc-page">
                <span className="doc-cursor"></span>
              </div>
              <div className="doc-status">
                <span>0 words</span>
                <span>23 min · staring</span>
              </div>
            </section>
          </div>

          <div className="col">
            <div className="section-h section-h-desktop">actually</div>
            <section className="reframe">
              <div className="r-eyebrow">// reframe</div>
              <h3>the blank page<br />is a <span className="liar">liar.</span></h3>
              <p>it makes you think you have nothing to say. you do. you just need someone to ask the right questions.</p>
              <div className="thats-us">that&apos;s us. ✦</div>
            </section>
          </div>
        </div>

        <div className="row">
          <div className="col">
            <div className="section-h">how it works</div>
            <section className="shot how skew-left" style={{marginTop:'6px'}}>
              <div className="how-tag">// brb, explained</div>
              <div className="how-title">chat with our<br />resume <span className="how-em">coach</span>.<br />that&apos;s <span className="how-em">it</span>.</div>
              <div className="how-points">
                <div className="how-pt">no typing required</div>
                <div className="how-pt">no forms to fill out</div>
                <div className="how-pt">no blank page to stare at</div>
              </div>
              <div className="how-line"></div>
              <div className="how-steps">
                <div className="how-step"><span className="how-num">01</span><span>coach asks the questions.</span></div>
                <div className="how-step"><span className="how-num">02</span><span>you answer. type or use talk-to-text.</span></div>
                <div className="how-step"><span className="how-num">03</span><span>30 min later: a real resume. yours.</span></div>
              </div>
              <div className="how-scribble">yeah. we really do it all for you</div>
            </section>
          </div>

          <div className="col">
            <div className="section-h">the convo</div>
            <section className="shot phone-chat skew-right" style={{marginTop:'6px'}}>
              <div className="ph-bar">
                <div className="ph-dot"></div>
                <div className="ph-title">brb · in progress</div>
              </div>
              <div className="ph-chat">
                <div className="pb coach">where have you worked? tell me about your most recent job.</div>
                <div className="pb you">target. two years. team lead on the floor.</div>
                <div className="pb coach">how many people were you responsible for on a typical shift?</div>
                <div className="pb you">like 8-10. more on weekends.</div>
                <div className="pb coach">when things went wrong, who handled it?</div>
                <div className="pb you">me, mostly. my manager just trusted me to handle it.</div>
                <div className="ph-typing"><span></span><span></span><span></span></div>
              </div>
            </section>
          </div>
        </div>

        <div className="row row-resume">
          <div className="rr-pullout">
            <div className="pullout-eyebrow">// the proof</div>
            <div className="pullout-text">a <em>real</em> resume.</div>
            <div className="pullout-scribble">in 30 minutes.<br />no computer needed.</div>
          </div>

          <div className="rr-resume">
            <div className="section-h">the resume</div>
            <section className="shot mini-resume skew-right" style={{marginTop:'6px'}}>
              <div className="mr-head">
                <div className="mr-name">Your Name</div>
                <div className="mr-contact">email · phone · LinkedIn</div>
              </div>
              <div className="mr-section">
                <div className="mr-section-h">Experience</div>
                <div className="mr-job-title">Team Lead, Target</div>
                <div className="mr-bullet">Led team of 8-10 associates across high-volume shifts, independently resolving inventory discrepancies and escalated customer issues with full manager confidence.</div>
                <div className="mr-bullet">Managed weekend shift operations including scheduling, conflict resolution, and customer escalations across departments.</div>
                <div className="mr-bullet">Trained 4 new associates on inventory systems and front-end protocols.</div>
              </div>
              <div className="mr-section">
                <div className="mr-section-h">Education</div>
                <div className="mr-line">University · expected 2027</div>
              </div>
              <div className="mr-fade">+ skills, projects, and the rest</div>
              <div className="mr-anno">told you. best resume builder. ↑</div>
            </section>
          </div>

          <div className="rr-handwriting">↖ told you.<br />best resume builder.</div>
        </div>

        <div className="row">
          <div className="col">
            <div className="section-h" style={{fontSize:'24px',lineHeight:1.15}}>Your parents paid $300 for this</div>
            <section className="shot receipt skew-left">
              <div className="r-head">
                <div className="biz">PRO RESUME WRITER</div>
                <div className="addr">est. forever ago<br />↓ what they paid</div>
              </div>
              <div className="r-row"><span>intake form longer than a college app</span><span>2 hrs</span></div>
              <div className="r-row"><span>back-and-forth emails</span><span>5 days</span></div>
              <div className="r-row"><span>first draft</span><span>$200</span></div>
              <div className="r-row"><span>revision round 1</span><span>$50</span></div>
              <div className="r-row"><span>revision round 2</span><span>$50</span></div>
              <div className="r-divider"></div>
              <div className="r-row total"><span>total</span><span>$300</span></div>
              <div className="r-row dim"><span>vibe</span><span>generic</span></div>
              <div className="r-foot">tysm come again</div>
            </section>
          </div>

          <div className="col">
            <div className="section-h" style={{fontSize:'24px',lineHeight:1.15}}>You pay thirty bucks</div>
            <section className="shot brb-card skew-right">
              <div className="brb-head">
                <div className="brb-name">brb</div>
                <div className="brb-sub">best resume builder</div>
              </div>
              <div className="brb-row"><span>one conversation</span><span>28 min</span></div>
              <div className="brb-row"><span>talk it or type it</span><span>your call</span></div>
              <div className="brb-row"><span>real resume</span><span>included</span></div>
              <div className="brb-row"><span>back-and-forth</span><span>none</span></div>
              <div className="brb-divider"></div>
              <div className="brb-row total"><span>total</span><span>$29.99/mo</span></div>
              <div className="brb-row vibe"><span>vibe</span><span>yours</span></div>
              <div className="brb-foot">brb · applying for jobs</div>
            </section>
          </div>
        </div>

        <div className="row row-close">
          <div className="col col-stat">
            <div className="section-h">the result</div>
            <div className="stat-shout"><span className="yel">28:14</span></div>
            <section className="best-part">
              <div className="bp-line">Start to <em>Finish.</em></div>
              <div className="bp-line">Zero to <em>Apply.</em></div>
              <div className="bp-line">Doomscroll to <em>Done.</em></div>
            </section>
          </div>
          <div className="col col-final">
            <section className="final">
              <h2><span className="yel">30</span> minutes.<br /><span className="yel">30</span> dollars.</h2>
              <p>DoorDash gone in 10 minutes?<br />Or a resume that buys DoorDash forever?<br /><em style={{fontFamily:"'Caveat', cursive",fontSize:'24px',fontWeight:700,fontStyle:'normal',display:'inline-block',transform:'rotate(-2deg)',marginTop:'6px'}}>(and gets mom off your back.)</em></p>
              <a href="#" className="cta-final" onClick={openModal}>write my resume</a>
            </section>
          </div>
        </div>

        <div className="foot">
          <span className="frax">brb</span> by Hire Power · 2026 ·
          <a href="/privacy">privacy</a><a href="/terms">terms</a>
          <span className="esc">prefer free? just you and a blank page at <a href="https://hirepowerai.com">hirepowerai.com</a> ✦</span>
        </div>

      </div>

      {showModal && (
        <div
          className="modal-overlay active"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onMouseDown={handleBackdropMouseDown}
          onMouseUp={handleBackdropMouseUp}
        >
          <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                aria-label="Close"
              >
                ×
              </button>
              <div className="header-row">
                <div className="modal-mark" id="modal-title">brb</div>
                <div className="header-text">
                  <div className="modal-tag">best resume builder</div>
                  <div className="modal-pwr">powered by Hire Power</div>
                </div>
              </div>
            </div>

            <div className="modal-body">
              {success ? (
                <div className="success-state">
                  <div className="success-icon">⚡</div>
                  <p className="success-text">account created. taking you to checkout...</p>
                </div>
              ) : (
                <>
                  <div className="transparency">
                    <span className="tx-label">heads up:</span>{' '}
                    you came for the resume. you&apos;ll get one. signing up also unlocks{' '}
                    <strong>every feature of Hire Power Pro</strong> &mdash; kind of like Netflix when you came for Stranger Things and got every other show too.
                  </div>

                  <p className="features-label">the rest of the library</p>
                  <ul className="features">
                    <li>a tailored resume for every job or internship you apply to</li>
                    <li>12 cover letters in the time it takes to scroll TikTok</li>
                    <li>interview practice that listens, not lectures</li>
                    <li>a job tracker that remembers where you applied (bc you won&apos;t)</li>
                  </ul>

                  {accountExists && (
                    <div className="msg-box info">
                      account already exists.{' '}
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => router.push('/dashboard')}
                      >
                        log in instead
                      </button>
                    </div>
                  )}
                  {error && (
                    <div className="msg-box err">{error}</div>
                  )}

                  <form className="signup-form" onSubmit={handleSubmit} noValidate>
                    <div className="field">
                      <label htmlFor="brb-email">email</label>
                      <input
                        type="email"
                        id="brb-email"
                        required
                        placeholder="you@example.com"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="brb-password">password</label>
                      <input
                        type="password"
                        id="brb-password"
                        required
                        minLength={6}
                        placeholder="min 6 characters"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>

                    <p className="cancel-line">
                      $29.99/mo. cancel anytime. (we&apos;ll just keep adding reasons not to.)
                    </p>

                    <button type="submit" className="cta-submit" disabled={loading}>
                      {loading ? 'creating account...' : 'write my resume · $29.99/mo'}
                    </button>
                  </form>

                  <p className="terms-line">
                    by creating a Hire Power account, you agree to our{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer">terms</a>{' '}
                    and{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a>.
                  </p>
                  <p className="login-line">
                    already on Hire Power?{' '}
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => router.push('/dashboard')}
                    >
                      log in
                    </button>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
:root {
  --paper: #f1ecf7;
  --paper-2: #e4dbef;
  --ink: #161616;
  --highlight: #a855f7;
  --hot: #c084fc;
  --green: #00cc66;
  --imessage-blue: #3478f6;
  --imessage-gray: #e9e9eb;
  --notes-yellow: #fff9c5;
  --notes-bg: #1c1c1e;
  --hp-grad: linear-gradient(to bottom right, #9333ea, #6b21a8);
}
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
html, body {
  background: var(--paper);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Inter", Arial, sans-serif;
  font-size: 15px;
  line-height: 1.4;
  background-image:
    radial-gradient(circle at 20% 10%, rgba(0,0,0,0.018) 0%, transparent 45%),
    radial-gradient(circle at 80% 90%, rgba(0,0,0,0.022) 0%, transparent 45%),
    radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 0%, transparent 60%);
}

.shell {
  max-width: 460px;
  margin: 0 auto;
  padding: 14px 16px 32px;
  position: relative;
}

.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 4px 18px;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: rgba(0,0,0,0.55);
}
.top .brand {
  color: var(--ink);
  font-weight: 600;
  display: flex; align-items: baseline; gap: 7px;
}
.top .brand .frax {
  font-family: Georgia, serif;
  font-style: normal;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.03em;
  text-transform: lowercase;
  line-height: 1;
}
.top .brand .by {
  font-family: 'DM Sans', sans-serif;
  font-weight: 600;
  font-size: 11px;
  color: rgba(0,0,0,0.4);
  text-transform: none;
  letter-spacing: 0;
}
.top .by-hp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'DM Sans', sans-serif;
  font-weight: 600;
  font-size: 11px;
  color: rgba(0,0,0,0.55);
  text-transform: none;
  letter-spacing: 0;
}
.top .by-hp .hp-icon {
  height: 18px;
  width: auto;
  display: block;
}

.hero-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: rgba(0,0,0,0.55);
  letter-spacing: 0.3px;
  text-transform: lowercase;
  padding: 0 0 24px;
  margin-top: -4px;
}
.hero-meta .hm-frax {
  font-family: Georgia, serif;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--ink);
  line-height: 1;
}
.hero-meta .hm-dot { color: rgba(0,0,0,0.28); }
.hero-meta .hp-icon {
  height: 16px;
  width: auto;
  display: inline-block;
  vertical-align: middle;
  margin: 0 1px;
}
.foot .hp-icon {
  height: 14px;
  width: auto;
  display: inline-block;
  vertical-align: middle;
  margin: 0 2px -2px;
}

.hero-a {
  background: linear-gradient(168deg, #1c1430 0%, #161616 55%, #0e0e14 100%);
  color: white;
  padding: 18px 18px 26px;
  border-radius: 26px;
  position: relative;
  margin-bottom: 22px;
  overflow: hidden;
  box-shadow: 0 14px 32px rgba(0,0,0,0.18);
}
.hero-a::before {
  content: "";
  position: absolute; inset: 0;
  background:
    radial-gradient(circle at 20% 80%, rgba(168,85,247,0.32) 0%, transparent 55%),
    radial-gradient(circle at 85% 12%, rgba(192,132,252,0.22) 0%, transparent 55%);
  pointer-events: none;
}
.hero-a > * { position: relative; }

.hero-a .ls-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
  margin-bottom: 14px;
  letter-spacing: 0.5px;
}
.hero-a .ls-status .signal { letter-spacing: 1.2px; }
.hero-a .ls-status .batt { display: inline-flex; align-items: center; gap: 4px; }
.hero-a .ls-status .batt::after {
  content: "";
  display: inline-block;
  width: 22px; height: 11px;
  border: 1.2px solid rgba(255,255,255,0.7);
  border-radius: 3px;
  position: relative;
  background: linear-gradient(to right, white 0 87%, transparent 87% 100%);
  background-clip: content-box;
  padding: 1px;
}

.hero-a .ls-time {
  font-family: 'Archivo Black', sans-serif;
  font-size: 102px;
  line-height: 0.85;
  text-align: center;
  letter-spacing: -6px;
  color: white;
  margin-top: 10px;
}
.hero-a .ls-date {
  text-align: center;
  font-family: 'DM Mono', monospace;
  font-size: 11px;
  color: rgba(255,255,255,0.55);
  margin-top: 4px;
  letter-spacing: 0.5px;
  text-transform: lowercase;
}

.hero-a .notif-stack {
  margin-top: 22px;
  display: flex; flex-direction: column;
  gap: 7px;
}
.hero-a .notif {
  background: rgba(255,255,255,0.13);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  padding: 11px 14px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  border: 0.5px solid rgba(255,255,255,0.08);
}
.hero-a .notif .ic {
  width: 30px; height: 30px;
  border-radius: 7px;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'DM Sans', sans-serif;
  font-weight: 800;
  font-size: 14px;
  color: white;
}
.hero-a .notif .ic.mom { background: #00cc66; }
.hero-a .notif .ic.li { background: #0a66c2; font-size: 11px; }
.hero-a .notif .ic.brb {
  background: var(--hp-grad);
  font-family: Georgia, serif;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -1px;
}
.hero-a .notif .meta { flex: 1; min-width: 0; }
.hero-a .notif .meta-top {
  display: flex; justify-content: space-between;
  align-items: baseline;
  margin-bottom: 3px;
  line-height: 1;
}
.hero-a .notif .meta-top .app {
  font-family: 'DM Sans', sans-serif;
  font-weight: 700;
  font-size: 12px;
  color: white;
  letter-spacing: 0.2px;
  text-transform: uppercase;
  line-height: 1;
}
.hero-a .notif .meta-top .when {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: rgba(255,255,255,0.45);
  text-transform: lowercase;
  line-height: 1;
}
.hero-a .notif .meta .msg {
  font-family: 'DM Sans', sans-serif;
  font-size: 13.5px;
  line-height: 1.25;
  color: rgba(255,255,255,0.92);
}
.hero-a .notif.brb-pop {
  background: rgba(168,85,247,0.18);
  border: 1px solid rgba(168,85,247,0.5);
  box-shadow: 0 0 26px rgba(168,85,247,0.32);
}
.hero-a .notif.brb-pop .meta-top .app { color: var(--hot); }

.hero-a .below {
  margin-top: 24px;
  text-align: center;
}
.hero-a .below .pitch {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-weight: 400;
  font-size: 19px;
  line-height: 1.25;
  color: rgba(255,255,255,0.85);
  margin-bottom: 18px;
  letter-spacing: -0.4px;
}
.hero-a .below .pitch .hook {
  font-size: 30px;
  font-weight: 700;
  color: rgba(255,255,255,0.95);
  letter-spacing: -0.6px;
  display: block;
  line-height: 1.1;
  margin-bottom: 6px;
}
.hero-a .below .pitch .line {
  display: inline;
  line-height: 1.25;
}
.hero-a .below .pitch .punch {
  display: inline;
  color: var(--hot);
  font-weight: 700;
  line-height: 1.25;
}
.hero-a .cta {
  display: inline-flex; align-items: center; gap: 10px;
  background: white;
  color: var(--ink);
  padding: 10px 28px;
  border-radius: 100px;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-weight: 700;
  font-size: 16px;
  line-height: 1;
  letter-spacing: 0.4px;
  text-decoration: none;
  box-shadow: 5px 5px 0 var(--hot), 5px 5px 0 1px var(--ink);
}
.hero-a .cta::after { content: "→"; font-size: 18px; }
.hero-a .trust {
  margin-top: 16px;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.6px;
  color: rgba(255,255,255,0.45);
  text-transform: lowercase;
}

.sticker {
  position: absolute;
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 18px;
  background: var(--hot);
  color: white;
  padding: 7px 13px;
  border-radius: 30px;
  transform: rotate(-8deg);
  box-shadow: 0 4px 12px rgba(192,132,252,0.42);
  z-index: 5;
  white-space: nowrap;
  line-height: 1;
}

.shot {
  background: white;
  border-radius: 22px;
  padding: 18px 18px 20px;
  margin-bottom: 22px;
  position: relative;
  box-shadow: 0 10px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
}
.shot.skew-left { transform: rotate(-1.4deg); }
.shot.skew-right { transform: rotate(1.2deg); }
.shot.skew-more { transform: rotate(-2.4deg); }

.imsg .imsg-head {
  text-align: center;
  border-bottom: 0.5px solid #ddd;
  padding-bottom: 11px;
  margin-bottom: 12px;
}
.imsg .imsg-head .name {
  font-size: 12px;
  font-weight: 600;
  color: #222;
}
.imsg .imsg-head .name::before {
  content: "•";
  color: #34C759;
  margin-right: 4px;
}
.imsg .imsg-head .sub {
  font-size: 10px;
  color: #888;
  margin-top: 2px;
  letter-spacing: 0.2px;
}
.imsg .b {
  max-width: 78%;
  padding: 8px 13px;
  border-radius: 18px;
  font-size: 15px;
  line-height: 1.32;
  margin: 4px 0;
  word-wrap: break-word;
}
.imsg .b.gray {
  background: var(--imessage-gray);
  color: var(--ink);
  border-bottom-left-radius: 5px;
  margin-right: auto;
}
.imsg .b.blue {
  background: var(--imessage-blue);
  color: white;
  border-bottom-right-radius: 5px;
  margin-left: auto;
}
.imsg .time-marker {
  text-align: center;
  font-size: 10px;
  color: #8e8e93;
  margin: 10px 0 5px;
  letter-spacing: 0.2px;
  font-weight: 500;
}
.imsg .time-marker .day {
  font-weight: 700;
  color: #4a4a4a;
}
.imsg .time-marker:first-of-type {
  margin-top: 2px;
}
.imsg .read {
  font-size: 10px;
  color: #888;
  text-align: right;
  margin-top: 2px;
  margin-right: 4px;
  font-weight: 500;
}

.notes {
  background: var(--notes-bg);
  color: white;
}
.notes .notes-head {
  display: flex;
  justify-content: space-between;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: rgba(255,255,255,0.5);
  text-transform: uppercase;
  letter-spacing: 1.2px;
  margin-bottom: 12px;
}
.notes .title {
  font-family: 'Archivo Black', sans-serif;
  font-size: 19px;
  line-height: 1.1;
  margin-bottom: 14px;
  letter-spacing: -0.5px;
  color: white;
}
.notes .item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 0;
  font-size: 14px;
  line-height: 1.35;
  color: rgba(255,255,255,0.92);
}
.notes .item .check {
  width: 18px; height: 18px;
  border: 1.5px solid rgba(255,255,255,0.7);
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 1px;
  position: relative;
}
.notes .item.done .check { background: white; border-color: white; }
.notes .item.done .check::after {
  content: "✓";
  position: absolute;
  inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--notes-bg);
}
.notes .item.done {
  text-decoration: line-through;
  text-decoration-color: rgba(255,255,255,0.45);
  opacity: 0.65;
}
.notes .scribble {
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 24px;
  color: var(--hot);
  margin-top: 12px;
  transform: rotate(-2deg);
  display: inline-block;
}

.vm {
  background: white;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
}
.vm .play {
  width: 46px; height: 46px;
  background: var(--imessage-blue);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: white;
  font-size: 14px;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(52,120,246,0.3);
}
.vm .vm-info { flex: 1; min-width: 0; }
.vm .vm-name {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.1px;
}
.vm .vm-wave {
  display: flex; align-items: center; gap: 1.5px;
  height: 24px;
  margin: 7px 0 5px;
}
.vm .vm-wave span {
  width: 2.5px;
  background: #999;
  border-radius: 1.5px;
  flex-shrink: 0;
}
.vm .vm-wave span:nth-child(odd) { height: 70%; }
.vm .vm-wave span:nth-child(even) { height: 35%; }
.vm .vm-wave span:nth-child(3n) { height: 95%; background: #555; }
.vm .vm-wave span:nth-child(5n) { height: 50%; }
.vm .vm-time {
  font-size: 12px;
  color: #888;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.2px;
}

.bullet-shot {
  background: var(--ink);
  color: white;
}
.bullet-shot .bullet-tag {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: var(--highlight);
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 12px;
}
.bullet-shot .bullet-text {
  font-size: 15px;
  line-height: 1.55;
}
.bullet-shot .bullet-anno {
  font-family: 'Caveat', cursive;
  font-size: 20px;
  color: var(--highlight);
  margin-top: 14px;
  font-weight: 700;
}

.receipt {
  background: white;
  font-family: 'DM Mono', monospace;
  padding: 24px 22px;
}
.receipt .r-head {
  text-align: center;
  margin-bottom: 14px;
  border-bottom: 1px dashed #bbb;
  padding-bottom: 14px;
}
.receipt .r-head .biz {
  font-family: 'Archivo Black', sans-serif;
  font-size: 18px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.receipt .r-head .addr {
  font-size: 9px;
  margin-top: 5px;
  color: #555;
  line-height: 1.5;
  letter-spacing: 0.5px;
}
.receipt .r-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 5px 0;
  letter-spacing: 0.3px;
}
.receipt .r-row.dim { color: #777; }
.receipt .r-divider {
  border-top: 1px dashed #bbb;
  margin: 9px 0;
}
.receipt .r-row.total {
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
  text-transform: uppercase;
  margin-top: 4px;
  letter-spacing: 1px;
}
.receipt .r-row.brb-total {
  background: var(--highlight);
  margin: 10px -22px -10px;
  padding: 12px 22px;
  font-family: 'Archivo Black', sans-serif;
  letter-spacing: 1px;
  font-size: 14px;
}
.receipt .r-foot {
  text-align: center;
  font-size: 9px;
  color: #777;
  margin-top: 12px;
  letter-spacing: 1.5px;
}

.how {
  background: white;
  font-family: 'DM Mono', monospace;
  padding: 22px 22px 24px;
}
.how .how-tag {
  font-size: 10px;
  letter-spacing: 1.8px;
  text-transform: uppercase;
  color: var(--hot);
  font-weight: 500;
  margin-bottom: 12px;
}
.how .how-title {
  font-family: 'Archivo Black', sans-serif;
  font-size: clamp(32px, 9vw, 42px);
  line-height: 0.95;
  letter-spacing: -1.5px;
  text-transform: lowercase;
  margin-bottom: 18px;
  color: var(--ink);
}
.how .how-title .how-em {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-weight: 700;
  letter-spacing: -1px;
  color: var(--highlight);
}
.how .how-points {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 4px;
}
.how .how-pt {
  font-size: 13px;
  letter-spacing: 0.2px;
  color: var(--ink);
  position: relative;
  padding-left: 22px;
  line-height: 1.5;
}
.how .how-pt::before {
  content: "✗";
  position: absolute;
  left: 0;
  top: 0;
  color: var(--hot);
  font-weight: 700;
  font-size: 14px;
}
.how .how-line {
  border-top: 1px dashed #ddd;
  margin: 16px 0;
}
.how .how-steps {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.how .how-step {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  line-height: 1.35;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Inter", Arial, sans-serif;
  color: var(--ink);
}
.how .how-step .how-num {
  font-family: 'Archivo Black', sans-serif;
  font-size: 12px;
  background: var(--ink);
  color: white;
  padding: 4px 8px;
  border-radius: 6px;
  flex-shrink: 0;
  letter-spacing: 0.5px;
}
.how .how-scribble {
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 22px;
  color: var(--hot);
  margin-top: 18px;
  margin-left: auto;
  margin-right: 4px;
  transform: rotate(1.5deg);
  display: block;
  width: fit-content;
}

.brb-card {
  background: linear-gradient(to bottom right, #9333ea, #6b21a8);
  color: white;
  font-family: 'DM Mono', monospace;
  padding: 24px 22px;
  border: 2px solid var(--ink);
  box-shadow: 7px 7px 0 var(--ink);
}
.brb-card .brb-head {
  text-align: center;
  margin-bottom: 14px;
  border-bottom: 1px dashed rgba(255,255,255,0.32);
  padding-bottom: 14px;
}
.brb-card .brb-name {
  font-family: Georgia, serif;
  font-style: normal;
  font-size: 84px;
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 0.95;
  text-transform: lowercase;
}
.brb-card .brb-sub {
  font-family: 'DM Sans', sans-serif;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0;
  text-transform: none;
  margin-top: 4px;
  color: rgba(255,255,255,0.6);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-content: center;
}
.brb-card .brb-sub .hp-inline-logo {
  height: 16px;
  width: auto;
  display: inline-block;
  vertical-align: middle;
  opacity: 0.85;
}
.brb-card .brb-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 5px 0;
  letter-spacing: 0.3px;
}
.brb-card .brb-divider {
  border-top: 1px dashed rgba(255,255,255,0.32);
  margin: 9px 0;
}
.brb-card .brb-row.total {
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
  text-transform: uppercase;
  margin-top: 4px;
  letter-spacing: 1px;
}
.brb-card .brb-row.vibe {
  color: rgba(255,255,255,0.55);
}
.brb-card .brb-foot {
  text-align: center;
  font-size: 9px;
  color: rgba(255,255,255,0.5);
  margin-top: 14px;
  letter-spacing: 1.5px;
}

.blank-doc {
  background: #d4d4d4;
  padding: 0;
  overflow: hidden;
}
.blank-doc .doc-bar {
  background: #ededed;
  border-bottom: 1px solid #c8c8c8;
  padding: 9px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.blank-doc .doc-dots {
  display: flex;
  gap: 5px;
}
.blank-doc .doc-dots span {
  width: 11px; height: 11px; border-radius: 50%;
  background: #ccc;
}
.blank-doc .doc-dots span:nth-child(1) { background: #ff5f57; }
.blank-doc .doc-dots span:nth-child(2) { background: #ffbd2e; }
.blank-doc .doc-dots span:nth-child(3) { background: #28c940; }
.blank-doc .doc-name {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: #888;
  letter-spacing: 0.4px;
  margin-left: auto;
  margin-right: auto;
  padding-right: 36px;
}
.blank-doc .doc-page {
  background: white;
  margin: 18px 22px 16px;
  border: 1px solid #c0c0c0;
  box-shadow: 0 1px 0 rgba(0,0,0,0.08);
  padding: 56px 36px 24px;
  min-height: 230px;
  position: relative;
  border-radius: 1px;
}
.blank-doc .doc-cursor {
  display: inline-block;
  width: 1.5px;
  height: 16px;
  background: var(--ink);
  vertical-align: middle;
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  0%, 50% { opacity: 1; }
  50.01%, 100% { opacity: 0; }
}
.blank-doc .doc-status {
  background: #ededed;
  border-top: 1px solid #c8c8c8;
  padding: 7px 16px;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: #888;
  letter-spacing: 0.5px;
  display: flex;
  justify-content: space-between;
}

.reframe {
  background: var(--ink);
  color: white;
  border-radius: 22px;
  padding: 38px 26px 36px;
  margin-bottom: 22px;
  position: relative;
  box-shadow: 0 12px 28px rgba(0,0,0,0.18);
}
.reframe .r-eyebrow {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--hot);
  margin-bottom: 14px;
}
.reframe h3 {
  font-family: 'Archivo Black', sans-serif;
  font-size: clamp(40px, 12vw, 54px);
  line-height: 0.95;
  letter-spacing: -2px;
  text-transform: lowercase;
  margin-bottom: 18px;
}
.reframe h3 .liar {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-weight: 700;
  letter-spacing: -1.5px;
  color: var(--highlight);
}
.reframe p {
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Inter", Arial, sans-serif;
  font-size: 16px;
  line-height: 1.55;
  color: rgba(255,255,255,0.78);
  margin-bottom: 12px;
}
.reframe p strong {
  color: white;
  font-weight: 700;
}
.reframe .thats-us {
  font-family: 'Archivo Black', sans-serif;
  font-size: 28px;
  margin-top: 16px;
  letter-spacing: -1px;
  text-transform: lowercase;
  color: var(--hot);
}

.intro-prose {
  margin: 4px 12px 14px;
}
.intro-prose .h {
  font-family: 'Archivo Black', sans-serif;
  font-size: clamp(26px, 7.5vw, 32px);
  line-height: 1;
  letter-spacing: -1.2px;
  color: var(--ink);
  margin-bottom: 12px;
}
.intro-prose .h .yel {
  background: var(--highlight);
  color: var(--ink);
  padding: 0 7px;
  display: inline-block;
  transform: skew(-3deg);
}
.intro-prose p {
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Inter", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.55;
  color: rgba(0,0,0,0.7);
  margin-bottom: 8px;
}

.phone-chat {
  background: #14111c;
  padding: 18px 16px 20px;
}
.phone-chat .ph-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.phone-chat .ph-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--highlight);
  box-shadow: 0 0 8px rgba(168,85,247,0.6);
}
.phone-chat .ph-title {
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.6px;
  text-transform: uppercase;
}
.phone-chat .ph-chat {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.phone-chat .pb {
  max-width: 86%;
  padding: 11px 14px;
  border-radius: 14px;
  font-size: 13.5px;
  line-height: 1.5;
}
.phone-chat .pb.coach {
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.82);
  align-self: flex-start;
  border-bottom-left-radius: 4px;
  position: relative;
  margin-top: 14px;
}
.phone-chat .pb.coach::before {
  content: "COACH";
  position: absolute;
  top: -14px;
  left: 2px;
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  color: var(--hot);
  font-weight: 500;
  letter-spacing: 1.4px;
}
.phone-chat .pb.coach:first-child {
  margin-top: 0;
}
.phone-chat .pb.you {
  background: var(--highlight);
  color: white;
  align-self: flex-end;
  border-bottom-right-radius: 4px;
  position: relative;
  margin-top: 14px;
}
.phone-chat .pb.you::before {
  content: "YOU";
  position: absolute;
  top: -14px;
  right: 2px;
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  color: var(--hot);
  font-weight: 500;
  letter-spacing: 1.4px;
}
.phone-chat .ph-typing {
  align-self: flex-start;
  padding: 13px 16px;
  background: rgba(255,255,255,0.06);
  border-radius: 14px;
  border-bottom-left-radius: 4px;
  display: flex;
  gap: 4px;
  margin-top: 6px;
}
.phone-chat .ph-typing span {
  width: 6px; height: 6px;
  background: rgba(255,255,255,0.45);
  border-radius: 50%;
  animation: dotpulse 1.2s infinite;
}
.phone-chat .ph-typing span:nth-child(2) { animation-delay: 0.18s; }
.phone-chat .ph-typing span:nth-child(3) { animation-delay: 0.36s; }
@keyframes dotpulse {
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-2px); }
}

.mini-resume {
  background: white;
  padding: 22px 22px 18px;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Inter", Arial, sans-serif;
}
.mini-resume .mr-head {
  text-align: center;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid #ddd;
}
.mini-resume .mr-name {
  font-family: 'Archivo Black', sans-serif;
  font-size: 18px;
  letter-spacing: -0.3px;
  text-transform: uppercase;
  color: var(--ink);
}
.mini-resume .mr-contact {
  font-size: 9.5px;
  color: #888;
  margin-top: 4px;
  letter-spacing: 0.2px;
}
.mini-resume .mr-section {
  margin-bottom: 14px;
}
.mini-resume .mr-section-h {
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  letter-spacing: 1.6px;
  text-transform: uppercase;
  color: var(--highlight);
  font-weight: 500;
  margin-bottom: 6px;
  border-bottom: 1px solid #eee;
  padding-bottom: 3px;
}
.mini-resume .mr-job-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 5px;
}
.mini-resume .mr-bullet {
  font-size: 11.5px;
  line-height: 1.45;
  color: rgba(0,0,0,0.78);
  padding-left: 12px;
  position: relative;
  margin-bottom: 5px;
}
.mini-resume .mr-bullet::before {
  content: "•";
  position: absolute;
  left: 2px;
  color: var(--highlight);
  font-weight: 700;
}
.mini-resume .mr-line {
  font-size: 11px;
  color: rgba(0,0,0,0.7);
  padding-left: 0;
}
.mini-resume .mr-fade {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px dashed #ddd;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Inter", Arial, sans-serif;
  font-size: 11.5px;
  font-style: italic;
  color: rgba(0,0,0,0.42);
  text-align: center;
  letter-spacing: 0.2px;
}
.mini-resume .mr-anno {
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 19px;
  color: var(--hot);
  margin-top: 10px;
  margin-left: auto;
  margin-right: 4px;
  transform: rotate(1.5deg);
  display: block;
  width: fit-content;
}

.section-h {
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 30px;
  line-height: 1;
  margin: 4px 0 14px 10px;
  display: inline-block;
  position: relative;
  z-index: 1;
}
.section-h::after {
  content: "";
  position: absolute;
  left: -4px; right: -4px; bottom: 0;
  height: 9px;
  background: var(--highlight);
  z-index: -1;
  transform: skew(-12deg);
}

.stat-shout {
  font-family: 'Archivo Black', sans-serif;
  font-size: clamp(64px, 20vw, 92px);
  line-height: 0.9;
  letter-spacing: -3px;
  text-align: center;
  text-transform: uppercase;
  margin: 24px 0 8px;
}
.stat-shout .yel {
  background: var(--highlight);
  padding: 0 8px;
  display: inline-block;
  transform: skew(-3deg);
}
.stat-shout small {
  display: block;
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  letter-spacing: 2px;
  color: rgba(0,0,0,0.6);
  margin-top: 14px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.best-part {
  text-align: center;
  padding: 14px 16px 40px;
  margin-bottom: 14px;
}
.best-part .bp-line {
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: rgba(0,0,0,0.6);
  font-weight: 400;
  margin-bottom: 6px;
}
.best-part .bp-line em {
  font-style: normal;
  color: var(--highlight);
  font-weight: 500;
}

.final {
  background: #e9d5ff;
  color: var(--ink);
  border-radius: 24px;
  padding: 42px 26px;
  text-align: center;
  margin-bottom: 18px;
  box-shadow: 7px 7px 0 var(--ink);
  border: 2px solid var(--ink);
}
.final h2 {
  font-family: 'Archivo Black', sans-serif;
  font-size: clamp(40px, 11.5vw, 52px);
  line-height: 1.05;
  letter-spacing: -2.2px;
  margin-bottom: 16px;
}
.final h2 .yel {
  background: var(--highlight);
  color: var(--ink);
  padding: 0 10px;
  display: inline-block;
  transform: skew(-3deg);
}
.final h2 .frax-i {
  font-family: 'Fraunces', serif;
  font-style: italic;
  font-weight: 700;
  letter-spacing: -1.8px;
  color: var(--highlight);
}
.final p {
  font-family: 'DM Mono', monospace;
  font-size: 13px;
  margin-bottom: 24px;
  letter-spacing: 0.3px;
  line-height: 1.55;
}
.final .cta-final {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(to bottom right, #9333ea, #6b21a8);
  color: white;
  padding: 14px 28px;
  border-radius: 100px;
  text-decoration: none;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-weight: 700;
  font-size: 17px;
  letter-spacing: 0.4px;
}
.final .cta-final::after {
  content: "→";
  font-size: 19px;
}

.foot {
  text-align: center;
  font-family: 'DM Mono', monospace;
  font-size: 10px;
  letter-spacing: 1.2px;
  color: rgba(0,0,0,0.55);
  padding: 18px 0 8px;
  text-transform: uppercase;
}
.foot a { color: rgba(0,0,0,0.55); margin: 0 6px; text-decoration: underline; }
.foot .esc {
  display: block;
  margin-top: 10px;
  text-transform: none;
  letter-spacing: 0;
  font-size: 13px;
  font-family: 'Caveat', cursive;
  font-weight: 500;
}
.foot .esc a {
  font-family: inherit;
  text-decoration: underline;
  color: var(--ink);
}
.foot .frax {
  font-family: Georgia, serif;
  font-style: normal;
  font-size: 14px;
  text-transform: lowercase;
  letter-spacing: -0.03em;
  font-weight: 700;
}

/* ============================================
   DESKTOP ADAPTATION (>= 1024px)
   ============================================ */

/* mobile defaults — hide desktop-only elements */
.section-h-desktop { display: none; }
.rr-pullout { display: none; }
.rr-handwriting { display: none; }
.hero-meta-top { display: none; }

@media (min-width: 1024px) {
  body {
    background-image:
      radial-gradient(circle at 15% 20%, rgba(168,85,247,0.06) 0%, transparent 40%),
      radial-gradient(circle at 85% 80%, rgba(192,132,252,0.05) 0%, transparent 40%),
      radial-gradient(circle at 50% 50%, rgba(255,255,255,0.5) 0%, transparent 70%);
  }

  .shell {
    max-width: 1100px;
    padding: 32px 32px 64px;
  }
  .top {
    padding: 6px 4px 28px;
  }

  /* ---- HERO: text-left on light bg, contained phone-artifact on right ---- */
  .hero-a {
    background: transparent;
    color: var(--ink);
    box-shadow: none;
    padding: 24px 0 40px;
    border-radius: 0;
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 64px;
    align-items: center;
    overflow: visible;
  }
  .hero-a::before { display: none; }

  .hero-a .below {
    grid-column: 1;
    grid-row: 1;
    text-align: left;
    margin-top: 0;
  }

  /* hero-meta as eyebrow above pitch on desktop */
  .hero-meta-bottom { display: none; }
  .hero-meta-top {
    display: flex;
    justify-content: flex-start;
    padding: 0 0 20px 0;
    margin-top: 0;
  }

  .hero-a .below .pitch {
    color: var(--ink);
    margin-bottom: 28px;
  }
  .hero-a .below .pitch .hook {
    color: var(--ink);
    font-size: 108px;
    line-height: 0.92;
    letter-spacing: -3px;
    margin-bottom: 4px;
    white-space: nowrap;
  }
  .hero-a .below .pitch .line {
    display: block;
    color: var(--ink);
    font-size: 56px;
    line-height: 1.05;
    letter-spacing: -1.4px;
    font-weight: 400;
    margin-bottom: 0;
  }
  .hero-a .below .pitch .punch {
    display: block;
    color: #9333ea;
    font-size: 56px;
    line-height: 1.05;
    letter-spacing: -1.4px;
    font-weight: 700;
  }
  .hero-a .below .cta {
    padding: 14px 36px;
    font-size: 18px;
  }
  .hero-a .below .trust {
    color: rgba(0,0,0,0.5);
    margin-top: 22px;
    font-size: 11px;
    text-align: left;
  }

  /* Phone-shaped dark artifact, fits above the fold */
  .hero-a .hero-phone {
    grid-column: 2;
    grid-row: 1;
    background: linear-gradient(168deg, #1c1430 0%, #161616 55%, #0e0e14 100%);
    border-radius: 36px;
    padding: 24px 20px 36px;
    position: relative;
    overflow: hidden;
    min-height: 560px;
    display: flex;
    flex-direction: column;
    box-shadow:
      0 30px 60px rgba(20, 8, 40, 0.32),
      0 0 0 1px rgba(0,0,0,0.05),
      inset 0 0 0 1px rgba(255,255,255,0.04);
  }
  .hero-a .hero-phone::before {
    content: "";
    position: absolute; inset: 0;
    background:
      radial-gradient(circle at 20% 80%, rgba(168,85,247,0.32) 0%, transparent 55%),
      radial-gradient(circle at 85% 12%, rgba(192,132,252,0.22) 0%, transparent 55%);
    pointer-events: none;
    border-radius: 36px;
  }
  .hero-a .hero-phone > * {
    position: relative;
    z-index: 1;
  }
  .hero-a .hero-phone .ls-time {
    font-size: 86px;
    letter-spacing: -4.5px;
    margin-top: 14px;
  }
  .hero-a .hero-phone .notif-stack {
    margin-top: 22px;
  }

  /* ---- ROW: 2-col grid with right-side stagger ---- */
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    align-items: start;
    margin-bottom: 36px;
  }
  .row > .col {
    max-width: 460px;
    width: 100%;
    justify-self: center;
    display: block;
  }
  .row > .col:nth-child(2) {
    margin-top: 36px;
  }
  .row.row-match > .col:nth-child(2) {
    margin-top: 0;
  }

  .row .col .shot.skew-left { transform: rotate(-1.2deg); }
  .row .col .shot.skew-right { transform: rotate(1deg); }
  .row .col .shot.skew-more { transform: rotate(-1.4deg); }
  .row .col .shot { margin-top: 6px !important; }

  /* ---- ROW MATCH ---- */
  .row.row-match { align-items: stretch; }
  .row.row-match .col {
    display: flex;
    flex-direction: column;
  }
  .row.row-match .col > .section-h {
    align-self: flex-start;
    flex: 0 0 auto;
  }
  .row.row-match .col > .shot,
  .row.row-match .col > .reframe {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .row.row-match .col > .shot.blank-doc .doc-page {
    flex: 1;
  }

  /* ---- ROW RESUME: 3-col layout, resume centered ---- */
  .row.row-resume {
    display: grid;
    grid-template-columns: 1fr 460px 1fr;
    grid-template-rows: auto 1fr;
    align-items: start;
    column-gap: 32px;
    row-gap: 24px;
    margin: 56px 0 72px;
  }
  .row.row-resume > * { margin-top: 0; }
  .row.row-resume .rr-pullout {
    display: block;
    grid-column: 1;
    grid-row: 1;
    align-self: start;
    text-align: right;
    padding: 24px 8px 0 0;
  }
  .row.row-resume .rr-resume {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
  .row.row-resume .rr-resume .section-h {
    display: none;
  }
  .row.row-resume .rr-resume .mr-anno {
    display: none;
  }
  .row.row-resume .rr-handwriting {
    display: block;
    grid-column: 3;
    grid-row: 2;
    align-self: end;
    justify-self: start;
    padding: 0 16px 16px 16px;
    font-family: 'Caveat', cursive;
    font-weight: 700;
    font-size: 38px;
    color: var(--hot);
    line-height: 1.05;
    transform: rotate(-2deg);
    max-width: 300px;
  }

  .pullout-eyebrow {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    letter-spacing: 2.4px;
    text-transform: uppercase;
    color: var(--highlight);
    margin-bottom: 18px;
  }
  .pullout-text {
    font-family: 'Archivo Black', sans-serif;
    font-size: 56px;
    line-height: 0.95;
    letter-spacing: -1.8px;
    text-transform: lowercase;
    color: var(--ink);
  }
  .pullout-text em {
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-weight: 700;
    letter-spacing: -1.4px;
    color: var(--highlight);
  }
  .pullout-scribble {
    font-family: 'Caveat', cursive;
    font-weight: 700;
    font-size: 26px;
    color: var(--hot);
    margin-top: 20px;
    transform: rotate(-1.5deg);
    display: inline-block;
    line-height: 1.1;
  }

  .section-h-desktop {
    display: inline-block;
  }

  /* ---- ROW CLOSE: 28:14/best-part on left + 30/30 final on right ---- */
  .row.row-close {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 64px;
    align-items: center;
    margin: 80px 0 40px;
  }
  .row.row-close > * { margin-top: 0; }
  .row.row-close .col-stat {
    text-align: center;
    padding: 16px 0;
  }
  .row.row-close .col-stat .stat-shout {
    margin: 0 0 14px;
    font-size: 124px;
    line-height: 0.9;
  }
  .row.row-close .col-stat .best-part {
    padding: 0;
    margin: 0;
  }
  .row.row-close .col-stat .best-part .bp-line {
    font-size: 13px;
    margin-bottom: 8px;
  }
  .row.row-close .col-final .final {
    margin: 0;
    max-width: none;
  }

  .foot {
    padding: 40px 0 24px;
  }
}

/* =========================================
   SIGNUP MODAL
   ========================================= */
.modal-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(15, 8, 30, 0.62);
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow-y: auto;
  -webkit-tap-highlight-color: transparent;
}
.modal-overlay.active {
  display: flex;
}
.modal-card {
  background: #fff;
  width: 100%;
  max-width: 500px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(20, 8, 40, 0.4);
  font-family: 'DM Sans', system-ui, sans-serif;
  position: relative;
  animation: modal-in 0.18s ease-out;
}
@keyframes modal-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.modal-header {
  background: linear-gradient(to bottom right, #667eea, #764ba2);
  padding: 14px 22px 12px;
  position: relative;
  color: #fff;
}
.modal-close {
  position: absolute;
  top: 6px;
  right: 10px;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.85);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 10px;
  font-weight: 300;
  transition: color 0.12s;
  z-index: 2;
}
.modal-close:hover { color: #fff; }
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-right: 24px;
}
.modal-mark {
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 700;
  font-size: 38px;
  line-height: 0.9;
  color: #fff;
  letter-spacing: -1.2px;
  margin: 0;
  flex-shrink: 0;
}
.header-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  text-align: right;
  min-width: 0;
}
.modal-tag {
  font-family: 'DM Mono', 'Courier New', monospace;
  font-size: 10.5px;
  letter-spacing: 1.4px;
  color: rgba(255,255,255,0.92);
  margin: 0;
  line-height: 1.2;
}
.modal-pwr {
  font-family: 'DM Mono', 'Courier New', monospace;
  font-size: 9px;
  letter-spacing: 1.5px;
  color: rgba(255,255,255,0.65);
  margin: 0;
  text-transform: uppercase;
  line-height: 1.2;
}
.modal-body {
  padding: 12px 22px 14px;
  background: #f1ecf7;
}
.transparency {
  background: #fff;
  border: 1px solid rgba(168, 85, 247, 0.18);
  border-radius: 10px;
  padding: 10px 13px;
  font-size: 12px;
  line-height: 1.5;
  color: #161616;
  margin-bottom: 12px;
  transform: rotate(-0.4deg);
  box-shadow: 0 4px 12px rgba(20, 8, 40, 0.05);
}
.transparency .tx-label {
  font-style: italic;
  color: #6b21a8;
  font-weight: 600;
}
.transparency strong {
  color: #6b21a8;
}
.features-label {
  font-family: 'Caveat', cursive;
  font-weight: 700;
  font-size: 26px;
  color: #6b21a8;
  letter-spacing: 0;
  text-transform: none;
  margin: 0 0 0 4px;
  line-height: 1;
  display: inline-block;
}
.features {
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
}
.features li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 1px 0;
  font-size: 12px;
  color: #2a2a2a;
  line-height: 1.4;
}
.features li::before {
  content: "→";
  font-family: 'Caveat', cursive;
  color: #a855f7;
  font-weight: 700;
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
  transform: translateY(-2px);
}
.signup-form { margin: 0; }
.signup-form .field { margin-bottom: 6px; }
.signup-form label {
  display: block;
  font-family: 'DM Mono', 'Courier New', monospace;
  font-size: 10px;
  font-weight: 700;
  color: #555;
  margin-bottom: 4px;
  letter-spacing: 1px;
  text-transform: lowercase;
}
.signup-form input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d4d4d8;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  background: #fff;
  color: #161616;
  box-sizing: border-box;
}
.signup-form input:focus {
  border-color: #a855f7;
  box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15);
}
.cancel-line {
  font-family: 'DM Mono', 'Courier New', monospace;
  font-size: 10.5px;
  color: #777;
  text-align: center;
  margin: 8px 0 8px;
  line-height: 1.5;
  letter-spacing: 0.3px;
}
.cta-submit {
  display: block;
  margin: 0 auto;
  padding: 11px 36px;
  width: auto;
  border: none;
  border-radius: 10px;
  background: linear-gradient(to right, #667eea, #764ba2);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.4px;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
  font-family: inherit;
  box-shadow: 0 6px 18px rgba(118, 75, 162, 0.4);
}
.cta-submit:hover { opacity: 0.92; transform: translateY(-1px); }
.cta-submit:disabled { opacity: 0.55; cursor: not-allowed; }
.terms-line {
  font-size: 10px;
  color: #888;
  text-align: center;
  line-height: 1.5;
  margin: 8px 0 2px;
}
.terms-line a {
  color: #6b21a8;
  text-decoration: underline;
}
.login-line {
  font-size: 11.5px;
  color: #6b7280;
  text-align: center;
  margin: 4px 0 0;
}
.login-line a {
  color: #6b21a8;
  font-weight: 600;
  text-decoration: none;
}
.login-line a:hover { text-decoration: underline; }
@media (max-width: 480px) {
  .modal-overlay { padding: 8px; }
  .modal-card { border-radius: 14px; }
  .modal-header { padding: 10px 18px 8px; }
  .modal-body { padding: 8px 18px 10px; }
  .header-row { padding-right: 22px; gap: 12px; }
  .modal-mark { font-size: 28px; }
  .modal-tag { font-size: 10px; }
  .modal-pwr { font-size: 8.5px; }
  .transparency {
    font-size: 11.5px;
    padding: 8px 12px;
    margin-bottom: 8px;
  }
  .features-label {
    font-size: 22px;
  }
  .features {
    margin-bottom: 8px;
  }
  .features li {
    font-size: 11.5px;
    padding: 0;
    gap: 8px;
  }
  .features li::before {
    font-size: 16px;
  }
  .signup-form .field { margin-bottom: 4px; }
  .signup-form label { font-size: 9.5px; margin-bottom: 3px; }
  .signup-form input { padding: 7px 12px; font-size: 13px; }
  .cancel-line { font-size: 9.5px; margin: 6px 0 6px; }
  .cta-submit { padding: 10px 28px; font-size: 13px; }
  .terms-line { font-size: 9.5px; margin: 6px 0 2px; }
  .login-line { font-size: 11px; margin: 4px 0 0; }
}


        /* ============== modal extras for React (success/info/error states) ============== */
        .success-state {
          text-align: center;
          padding: 24px 8px;
        }
        .success-icon {
          font-size: 36px;
          margin-bottom: 10px;
        }
        .success-text {
          font-weight: 700;
          color: #161616;
          margin: 0;
        }
        .msg-box {
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          margin-bottom: 10px;
        }
        .msg-box.info {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1e40af;
        }
        .msg-box.err {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }
        .link-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
          font: inherit;
          color: #6b21a8;
          font-weight: 600;
          text-decoration: underline;
        }
        .login-line .link-btn {
          text-decoration: none;
        }
        .login-line .link-btn:hover {
          text-decoration: underline;
        }
      `}</style>
    </>
  )
}
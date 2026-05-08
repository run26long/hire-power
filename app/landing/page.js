'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import MainNav from '../components/MainNav';
import Footer from '../components/Footer';
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function LandingPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState(null);
const [showSignupModal, setShowSignupModal] = useState(false);
const [signupAsPro, setSignupAsPro] = useState(false);
const [signupFirstName, setSignupFirstName] = useState('');
const [signupLastName, setSignupLastName] = useState('');
const [signupEmail, setSignupEmail] = useState('');
const [signupPassword, setSignupPassword] = useState('');
const [signupLoading, setSignupLoading] = useState(false);
const [signupError, setSignupError] = useState('');
const [signupSuccess, setSignupSuccess] = useState(false);
const [signupAccountExists, setSignupAccountExists] = useState(false);
const [mobilePricingOpen, setMobilePricingOpen] = useState('pro');
const [showSignupPassword, setShowSignupPassword] = useState(false);

const supabase = createClient();

  // Password strength: returns { score: 0-3, label, color, width }
  const getPasswordStrength = (password) => {
    if (!password) return null;
    const len = password.length;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);
    const variety = [hasLetter, hasNumber, hasSymbol].filter(Boolean).length;

    if (len < 8) return { score: 0, label: 'Too short', color: '#ef4444', width: '25%' };
    if (len >= 12 || (len >= 10 && variety >= 2)) return { score: 3, label: 'Strong', color: '#10b981', width: '100%' };
    if (len >= 10 || (len >= 8 && variety >= 2)) return { score: 2, label: 'Good', color: '#f59e0b', width: '66%' };
    return { score: 1, label: 'Weak', color: '#f59e0b', width: '40%' };
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupLoading(true);
    setSignupError('');
    setSignupSuccess(false);
    setSignupAccountExists(false);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: {
          first_name: signupFirstName.trim(),
          last_name: signupLastName.trim(),
        }
      }
    });

    setSignupLoading(false);

    if (signUpError) {
      const errorMsg = signUpError.message.toLowerCase();
      if (errorMsg.includes('already registered') ||
          errorMsg.includes('already exists') ||
          errorMsg.includes('user already registered')) {
        setSignupAccountExists(true);
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        setSignupError(signUpError.message);
      }
      return;
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setSignupAccountExists(true);
     setTimeout(() => router.push('/dashboard'), 2000);
      return;
    }

    if (data.user) {
      setSignupSuccess(true);
      // Loops sync deferred to dashboard load after email confirmation.
      // We don't sync unconfirmed signups to keep Loops clean.
    }
  };

 useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signup') === 'true') {
      setShowSignupModal(true);
      window.history.replaceState({}, '', '/landing');
    }
  }, []);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setUserProfile(profile);
      }
    }
    loadUser();
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,700;0,900;1,300;1,700&family=DM+Sans:wght@300;400;500;600&display=swap');

        :root {
          --purple: #9333ea;
          --purple-dark: #7e22ce;
          --purple-light: #f5f3ff;
          --purple-mid: #ede9fe;
          --black: #0D0D0D;
          --dark: #1a1033;
          --gray: #6B7280;
          --light: #F8F8FC;
          --white: #FFFFFF;
          --green: #10B981;
          --red: #EF4444;
          --amber: #F59E0B;
        }

        html { scroll-behavior: smooth; }
        .landing-page * { margin: 0; padding: 0; box-sizing: border-box; }
        .landing-page { font-family: 'DM Sans', sans-serif; color: var(--black); background: var(--white); overflow-x: hidden; }

        .btn-primary-lg {
          display: inline-flex; align-items: center; gap: 10px;
          background: var(--purple); color: white; padding: 16px 32px;
          border-radius: 10px; font-size: 17px; font-weight: 600; text-decoration: none;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 24px rgba(108,99,255,0.35);
        }
        .btn-primary-lg:hover { background: var(--purple-dark); transform: translateY(-2px); box-shadow: 0 8px 32px rgba(108,99,255,0.45); }

        .btn-white {
          display: inline-flex; align-items: center; gap: 10px;
          background: white; color: var(--black); padding: 16px 32px;
          border-radius: 10px; font-size: 17px; font-weight: 600; text-decoration: none;
          transition: all 0.2s; box-shadow: 0 4px 24px rgba(0,0,0,0.2);
        }
        .btn-white:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.3); }

        .hero {
          min-height: 100vh; display: grid; grid-template-columns: 1fr 1.1fr;
          align-items: center; padding: 20px 48px 48px 96px; gap: 24px;
          background: var(--white); position: relative; overflow: hidden;
        }
        .hero::before {
          content: ''; position: absolute; top: -200px; right: -200px;
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(147,51,234,0.06) 0%, transparent 70%);
          pointer-events: none;
        }
        .hero h1 { font-family: 'Fraunces', serif; font-weight: 900; font-size: clamp(40px,4.2vw,62px); line-height: 1.0; letter-spacing: -2px; color: var(--black); margin-bottom: 10px; }
        .hero h1 em { font-style: italic; color: var(--purple); }
        .hero-sub { font-size: 16px; color: #444; line-height: 1.6; margin-bottom: 28px; max-width: 460px; }
        .hero-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
        .hero-trust { display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--gray); }
        .hero-trust svg { color: var(--green); flex-shrink: 0; }

        .container { max-width: 1200px; margin: 0 auto; padding: 0 48px; }
        .section-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--purple); margin-bottom: 16px; }
        .section-title { font-family: 'Fraunces', serif; font-weight: 900; font-size: clamp(36px,4vw,56px); line-height: 1.05; letter-spacing: -1.5px; color: var(--black); margin-bottom: 20px; }
        .section-title em { font-style: italic; color: var(--purple); }
        .section-sub { font-size: 18px; color: var(--gray); line-height: 1.6; max-width: 600px; }

        .problem { padding: 120px 0; background: var(--dark); overflow: hidden; }
        .problem .section-eyebrow { color: rgba(255,255,255,0.4); }
        .problem .section-title { color: white; }
        .problem .section-sub { color: rgba(255,255,255,0.6); }
        .problem-truth { margin-top: 56px; text-align: center; padding: 48px; background: rgba(108,99,255,0.12); border: 1px solid rgba(108,99,255,0.2); border-radius: 20px; }
        .problem-truth p { font-family: 'Fraunces', serif; font-size: clamp(20px,2.5vw,30px); font-weight: 700; color: white; line-height: 1.4; font-style: italic; }
        .problem-truth strong { color: #A5B4FC; font-style: normal; }

        .interview-moment { padding: 80px 0; background: var(--purple-light); border-top: 1px solid rgba(108,99,255,0.1); border-bottom: 1px solid rgba(108,99,255,0.1); }
        .interview-moment-inner { max-width: 800px; margin: 0 auto; text-align: center; padding: 0 48px; }
        .interview-moment-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--purple); margin-bottom: 20px; }
        .interview-moment p { font-family: 'Fraunces', serif; font-size: clamp(20px,2.8vw,32px); font-weight: 700; line-height: 1.4; color: var(--black); }
        .interview-moment p em { color: var(--purple); font-style: italic; }

        .how { padding: 120px 0; background: var(--white); }
        .how-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; margin-top: 80px; }
        .how-steps { display: flex; flex-direction: column; gap: 32px; }
        .how-step { display: flex; gap: 20px; align-items: flex-start; }
        .step-num { width: 40px; height: 40px; background: var(--purple-light); color: var(--purple); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-family: 'Fraunces', serif; font-size: 18px; font-weight: 900; flex-shrink: 0; }
        .step-content h4 { font-size: 17px; font-weight: 600; color: var(--black); margin-bottom: 6px; }
        .step-content p { font-size: 15px; color: var(--gray); line-height: 1.6; }
        .how-visual { background: var(--light); border-radius: 20px; padding: 32px; border: 1px solid rgba(0,0,0,0.06); }
        .coaches-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
        .coach-pill { background: white; border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; padding: 16px; text-align: center; }
        .coach-pill-icon { font-size: 24px; margin-bottom: 8px; }
        .coach-pill h5 { font-size: 13px; font-weight: 600; color: var(--black); margin-bottom: 4px; }
        .coach-pill p { font-size: 12px; color: var(--gray); line-height: 1.4; }
        .context-arrow { text-align: center; font-size: 11px; color: var(--gray); margin: 12px 0; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .context-arrow::before, .context-arrow::after { content: ''; height: 1px; flex: 1; background: rgba(0,0,0,0.08); }
        .power-score-visual { margin-top: 16px; background: white; border-radius: 12px; padding: 20px; border: 1px solid rgba(0,0,0,0.08); }
        .power-score-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gray); margin-bottom: 12px; }
        .score-bar-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .score-bar-name { font-size: 13px; color: var(--black); width: 80px; flex-shrink: 0; }
        .score-bar-track { flex: 1; height: 6px; background: #E5E7EB; border-radius: 100px; overflow: hidden; }
        .score-bar-fill { height: 100%; border-radius: 100px; }
        .score-bar-val { font-size: 13px; font-weight: 600; color: var(--black); width: 36px; text-align: right; flex-shrink: 0; }

        .manifesto { padding: 100px 48px; background: var(--dark); text-align: center; position: relative; overflow: hidden; }
        .manifesto::before { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 700px; height: 300px; background: radial-gradient(ellipse, rgba(147,51,234,0.15) 0%, transparent 70%); pointer-events: none; }
        .manifesto-inner { max-width: 760px; margin: 0 auto; position: relative; }
        .manifesto-eyebrow { font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #a78bfa; margin-bottom: 32px; }
        .manifesto p { font-family: 'DM Sans', sans-serif; font-size: clamp(20px,2.5vw,28px); font-weight: 400; line-height: 1.65; color: rgba(255,255,255,0.75); }
        .manifesto p strong { font-weight: 700; color: white; }
        .manifesto p em { font-style: normal; color: #c4b5fd; }

        .vault { padding: 120px 0; background: var(--dark); overflow: hidden; }
        .vault-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
        .vault .section-eyebrow { color: rgba(255,255,255,0.4); }
        .vault .section-title { color: white; }
        .vault-body { font-size: 17px; color: rgba(255,255,255,0.65); line-height: 1.7; margin-bottom: 32px; }
        .vault-body strong { color: white; }
        .vault-quote { padding: 24px; background: rgba(108,99,255,0.15); border: 1px solid rgba(108,99,255,0.25); border-radius: 16px; font-family: 'Fraunces', serif; font-size: 20px; font-style: italic; color: #C7D2FE; line-height: 1.5; }
        .vault-visual { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 32px; }
        .vault-timeline { display: flex; flex-direction: column; gap: 0; }
        .vault-event { display: flex; gap: 16px; align-items: flex-start; position: relative; }
        .vault-event:not(:last-child)::after { content: ''; position: absolute; left: 15px; top: 32px; bottom: -16px; width: 2px; background: rgba(255,255,255,0.08); }
        .vault-event + .vault-event { margin-top: 24px; }
        .vault-dot { width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 15px; }
        .vault-event-content { flex: 1; padding-bottom: 8px; }
        .vault-event-content h5 { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.9); margin-bottom: 4px; }
        .vault-event-content p { font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.5; }
        .vault-event-date { font-size: 12px; color: rgba(255,255,255,0.3); flex-shrink: 0; margin-top: 2px; }

        .pricing { padding: 120px 0; background: var(--white); }
        .pricing-header { text-align: center; margin-bottom: 20px; }
        .pricing-os-line { text-align: center; font-size: 15px; color: var(--gray); margin-bottom: 64px; font-style: italic; }
        .pricing-os-line strong { color: var(--black); font-style: normal; }
        .pricing-tiers { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; align-items: stretch; }
        .tier-card { border-radius: 20px; padding: 36px 32px; border: 1.5px solid rgba(0,0,0,0.08); background: white; display: flex; flex-direction: column; transition: border-color 0.2s, box-shadow 0.2s; }
        .tier-card:hover { border-color: rgba(108,99,255,0.3); box-shadow: 0 8px 32px rgba(108,99,255,0.08); }
        .tier-card.featured { background: var(--dark); border-color: var(--purple); box-shadow: 0 16px 48px rgba(108,99,255,0.25); position: relative; }
        .featured-badge { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: var(--purple); color: white; font-size: 12px; font-weight: 700; padding: 4px 16px; border-radius: 100px; white-space: nowrap; letter-spacing: 0.04em; }
        .tier-os-tag { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--purple); margin-bottom: 20px; }
        .tier-card.featured .tier-os-tag { color: rgba(165,180,252,0.8); }
        .tier-name { font-family: 'Fraunces', serif; font-size: 32px; font-weight: 900; color: var(--black); margin-bottom: 4px; }
        .tier-card.featured .tier-name { color: white; }
        .tier-price { font-size: 42px; font-weight: 700; color: var(--black); line-height: 1; margin-bottom: 4px; }
        .tier-card.featured .tier-price { color: white; }
        .tier-price span { font-size: 16px; font-weight: 400; color: var(--gray); }
        .tier-card.featured .tier-price span { color: rgba(255,255,255,0.5); }
        .tier-desc { font-size: 14px; color: var(--gray); line-height: 1.5; margin: 16px 0 28px; padding-bottom: 24px; border-bottom: 1px solid rgba(0,0,0,0.06); }
        .tier-card.featured .tier-desc { color: rgba(255,255,255,0.5); border-bottom-color: rgba(255,255,255,0.08); }
        .tier-features { list-style: none; display: flex; flex-direction: column; gap: 12px; flex: 1; }
        .tier-features li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: #374151; line-height: 1.4; }
        .tier-card.featured .tier-features li { color: rgba(255,255,255,0.75); }
        .tier-features .check { color: var(--green); flex-shrink: 0; margin-top: 1px; font-size: 16px; }
        .tier-cta { margin-top: 32px; }
        .tier-btn { display: block; text-align: center; padding: 14px; border-radius: 10px; font-size: 15px; font-weight: 600; text-decoration: none; transition: all 0.2s; }
        .tier-btn.ghost { border: 1.5px solid rgba(0,0,0,0.12); color: var(--black); }
        .tier-btn.ghost:hover { border-color: var(--purple); color: var(--purple); }
        .tier-btn.solid { background: var(--purple); color: white; box-shadow: 0 4px 16px rgba(108,99,255,0.35); }
        .tier-btn.solid:hover { background: var(--purple-dark); transform: translateY(-1px); }
        .pricing-note { text-align: center; margin-top: 40px; font-size: 14px; color: var(--gray); }

        .final-cta { padding: 120px 48px; background: var(--dark); text-align: center; position: relative; overflow: hidden; }
        .final-cta::before { content: ''; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 800px; height: 400px; background: radial-gradient(ellipse, rgba(108,99,255,0.2) 0%, transparent 70%); pointer-events: none; }
        .final-cta h2 { font-family: 'Fraunces', serif; font-weight: 900; font-size: clamp(40px,5vw,64px); color: white; line-height: 1.05; letter-spacing: -1.5px; margin-bottom: 20px; position: relative; }
        .final-cta h2 em { font-style: italic; color: #A5B4FC; }
        .final-cta p { font-size: 18px; color: rgba(255,255,255,0.55); max-width: 500px; margin: 0 auto 48px; line-height: 1.6; position: relative; }
        .final-cta-actions { display: flex; align-items: center; justify-content: center; gap: 16px; position: relative; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes panelFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

       @media (max-width: 768px) {
          .hero { grid-template-columns: 1fr !important; padding: 32px 24px 48px !important; min-height: auto !important; }
          .hero-visual { display: none !important; }
          .hero h1 { font-size: 38px !important; letter-spacing: -1px !important; }
          .hero-inner-pad { margin-left: 0 !important; }
          .hero-actions { flex-direction: column !important; align-items: flex-start !important; }

          /* Mobile readability bumps — eyebrows, microcopy, buttons all to min 14px */
          .landing-page .section-eyebrow { font-size: 14px !important; }
          .landing-page .interview-moment-eyebrow { font-size: 14px !important; }
          .landing-page .manifesto-eyebrow { font-size: 14px !important; }
          .landing-page .hero-trust { font-size: 14px !important; }
          .landing-page .pricing-os-line { font-size: 14px !important; }
          .landing-page .pricing-note { font-size: 14px !important; }
          .landing-page .step-content h4 { font-size: 16px !important; }
          .landing-page .step-content p { font-size: 14px !important; }
          .landing-page .coach-pill h5 { font-size: 14px !important; }
          .landing-page .coach-pill p { font-size: 14px !important; }
          .landing-page .context-arrow { font-size: 14px !important; }
          .landing-page .power-score-label { font-size: 14px !important; }
          .landing-page .score-bar-name { font-size: 14px !important; }
          .landing-page .score-bar-val { font-size: 14px !important; }
          .landing-page .vault-event-content h5 { font-size: 14px !important; }
          .landing-page .vault-event-content p { font-size: 14px !important; }
          .landing-page .vault-event-date { font-size: 14px !important; }
          .landing-page .tier-os-tag { font-size: 14px !important; }
          .landing-page .tier-desc { font-size: 14px !important; }
          .landing-page .tier-features li { font-size: 14px !important; }
          .landing-page .tier-btn { font-size: 14px !important; }
          .landing-page button { font-size: 14px !important; }
          .landing-page a.btn-primary-lg,
          .landing-page a.btn-white { font-size: 14px !important; }

          .container { padding: 0 24px !important; }

          .problem { padding: 48px 0 !important; }
          .how { padding: 48px 0 !important; }
          .manifesto { padding: 48px 24px !important; }
          .vault { padding: 48px 0 !important; }
          .pricing { padding: 48px 0 !important; }
          .final-cta { padding: 48px 24px !important; }
          .interview-moment { padding: 40px 0 !important; }
          .problem-comparison-grid { grid-template-columns: 1fr !important; }
          .problem-chat-grid { grid-template-columns: 1fr !important; }
          .problem-chat-grid-chat { display: none !important; }
          .problem-truth { padding: 28px 20px !important; }

          .interview-moment-inner { padding: 0 24px !important; }

          .how-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .how-grid .how-visual { order: 2; }
          .how-grid .how-steps { order: 1; }
          .coaches-row { grid-template-columns: 1fr 1fr 1fr !important; }

          .manifesto { padding: 60px 24px !important; }

          .never-start-section { padding: 60px 24px !important; }
          .build-with-coach-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .build-with-coach-visual { order: 2; }
          .build-with-coach-grid button { display: block !important; margin-left: auto !important; margin-right: auto !important; }

          .vault { padding: 60px 0 !important; }
          .vault-grid { grid-template-columns: 1fr !important; gap: 40px !important; }

          .pricing { padding: 60px 0 !important; }
          .pricing-tiers { display: none !important; }
          .pricing-mobile { display: flex !important; flex-direction: column !important; gap: 12px !important; }

          .final-cta { padding: 60px 24px !important; }
          .final-cta-actions { flex-direction: column !important; align-items: center !important; }

          .landing-page { width: 100% !important; }
          .hero h1 br, .final-cta h2 br { display: none !important; }
          .section-title { font-size: 32px !important; letter-spacing: -1px !important; }
          .never-start-heading { font-size: 42px !important; letter-spacing: -1px !important; }
          .never-start-section { padding: 48px 24px !important; }
          .mobile-reduce-top { margin-top: 24px !important; }
          .finish-line-section { padding: 40px 0 !important; }
          .finish-line-callout { padding: 0 24px 40px !important; }
          .pricing-os-line { display: none !important; }
          .pricing-header { margin-bottom: 8px !important; }
          .pricing-note-upgrade { display: none !important; }
          .pricing-note { margin-top: 12px !important; margin-bottom: 16px !important; }
          .pricing-header { margin-bottom: 4px !important; }
          .pricing .section-title { margin-bottom: 8px !important; }
          .hide-on-mobile { display: none !important; }
          .never-start-heading br { display: none !important; }
          .hero h1 { font-size: 42px !important; }
          .final-cta h2 { font-size: 36px !important; }
          .manifesto p { font-size: 18px !important; }
          .we-just-asked-gap { margin-bottom: 24px !important; }
          .editorial-headline { font-size: 16px !important; }
          .editorial-body { font-size: 15px !important; }
          .editorial-quote { font-size: 17px !important; }
          .desktop-break { display: none !important; }
          .mobile-break { display: inline !important; }
          .mobile-nav { display: flex !important; }
          .desktop-nav { display: none !important; }
        }
        .hero-left > * { animation: fadeUp 0.7s ease both; }
        .hero-eyebrow { animation-delay: 0.1s; }
        .hero h1 { animation-delay: 0.2s; }
        .hero-sub { animation-delay: 0.4s; }
        .hero-actions { animation-delay: 0.5s; }
        .hero-trust { animation-delay: 0.6s; }
        .hero-visual { animation: fadeIn 0.9s ease 0.3s both; }
      `}</style>

{/* SIGNUP MODAL */}
      {showSignupModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{backgroundColor:'rgba(0,0,0,0.5)'}}
          onMouseDown={(e) => { e.currentTarget.dataset.downTarget = e.target === e.currentTarget ? 'backdrop' : 'inside'; }}
          onMouseUp={(e) => {
            if (e.target === e.currentTarget && e.currentTarget.dataset.downTarget === 'backdrop') {
              setShowSignupModal(false);
              setSignupAsPro(false);
            }
          }}
        >
          <div
            className="bg-white shadow-2xl w-full overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
            style={{maxWidth:'420px',borderRadius:'12px'}}
          >
            {/* Header */}
            <div
              style={{background:'linear-gradient(to bottom right, #667eea, #764ba2)'}}
              className="px-6 py-5 relative"
            >
              <button
                onClick={() => { setShowSignupModal(false); setSignupAsPro(false); }}
                className="absolute top-4 right-4 text-white hover:text-gray-200 text-3xl leading-none font-light"
              >×</button>
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {signupAsPro ? 'Start with Pro' : 'Start your free account'}
                  </h2>
                  <p className="text-purple-100 text-xs">
                    {signupAsPro
                      ? 'Free tells you what\'s wrong. Pro fixes it for you.'
                      : 'No credit card required. Free forever plan.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              {signupSuccess ? (
                <div className="text-center py-4">
                  <div className="text-4xl mb-3">
                    {signupAsPro ? '⚡' : '📧'}
                  </div>
                  <p className="font-semibold text-gray-900 mb-2">
                    {signupAsPro ? 'Account created! Taking you to checkout...' : 'Check your email!'}
                  </p>
                  {!signupAsPro && (
                    <p className="text-sm text-gray-600">Click the confirmation link and you'll be signed in automatically and taken straight to your account.</p>
                  )}
                </div>
              ) : (
                <>
                  {signupAccountExists && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded text-sm mb-4">
                      Account already exists. <button onClick={() => router.push('/dashboard')} className="underline font-medium bg-transparent border-none cursor-pointer text-blue-700 p-0">Log in instead</button>
                    </div>
                  )}
                  {signupError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">
                      {signupError}
                    </div>
                  )}
                  <form onSubmit={async (e) => {
                    e.preventDefault()
                    if (signupAsPro) {
                      // Pro path: auto-confirm + Stripe
                      setSignupLoading(true)
                      setSignupError(null)
                      try {
                        const res = await fetch('/api/auth/signup-pro', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            email: signupEmail,
                            password: signupPassword,
                            firstName: signupFirstName,
                            lastName: signupLastName
                          })
                        })
                        const data = await res.json()
                        if (!res.ok) {
                          if (data.error === 'ACCOUNT_EXISTS') {
                            setSignupAccountExists(true)
                          } else {
                            setSignupError(data.error || 'Something went wrong. Please try again.')
                          }
                          return
                        }
                        // Sign them in client-side
                        const { createClient } = await import('@/utils/supabase/client')
                        const supabase = createClient()
                        await supabase.auth.signInWithPassword({ email: signupEmail, password: signupPassword })
                        setSignupSuccess(true)
                        // Redirect to Stripe
                        setTimeout(() => { window.location.href = data.checkoutUrl }, 800)
                      } catch (err) {
                        setSignupError('Something went wrong. Please try again.')
                      } finally {
                        setSignupLoading(false)
                      }
                    } else {
                      // Free path: normal signup
                      handleSignup(e)
                    }
                  }} className="space-y-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                        <input
                          type="text"
                          required
                          value={signupFirstName}
                          onChange={(e) => setSignupFirstName(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                          placeholder="First"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                        <input
                          type="text"
                          required
                          value={signupLastName}
                          onChange={(e) => setSignupLastName(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                          placeholder="Last"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                      <input
                        type="email"
                        required
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                        placeholder="you@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <input
                          type={showSignupPassword ? "text" : "password"}
                          required
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 pr-10"
                          placeholder="Min. 8 characters"
                          minLength={8}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showSignupPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {signupPassword && (() => {
                        const s = getPasswordStrength(signupPassword);
                        return (
                          <div className="mt-1.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full transition-all duration-200" style={{ width: s.width, background: s.color }} />
                              </div>
                              <span className="text-[10px] font-medium" style={{ color: s.color }}>{s.label}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Pro checkbox */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={signupAsPro}
                        onChange={(e) => setSignupAsPro(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 flex-shrink-0"
                      />
                      <span className="text-sm text-gray-700 leading-snug">
                        Your best resume from day one. Start with Pro today.
                      </span>
                    </label>

                    {/* Pro callout — only when checked */}
                    {signupAsPro && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 space-y-1">
                        {[
                          'Coaching conversation that rewrites your resume for you',
                          'Unlimited job-specific resumes and cover letters',
                          'Unlimited coaching before every interview',
                        ].map((item) => (
                          <div key={item} className="flex items-start gap-2 text-xs text-purple-900">
                            <span className="text-purple-500 flex-shrink-0 mt-0.5">✓</span>
                            <span>{item}</span>
                          </div>
                        ))}
                        <p className="text-[10px] text-purple-600 font-semibold pt-1">$29.99/mo. Cancel anytime.</p>
                      </div>
                    )}

                    <p className="text-[11px] text-gray-400 text-center leading-tight">
                      By creating a Hire Power account, you agree to our<br/> <a href="/terms" target="_blank" className="text-purple-600 hover:underline">Terms of Service</a> and <a href="/privacy" target="_blank" className="text-purple-600 hover:underline">Privacy Policy</a>.
                    </p>
                    <button
                      type="submit"
                      disabled={signupLoading}
                      className="block mx-auto py-2 px-8 rounded-md text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(to right, #667eea, #764ba2)' }}
                    >
                      {signupLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>
                          {signupAsPro ? 'Creating account...' : 'Creating account...'}
                        </span>
                      ) : signupAsPro ? 'Create account and go Pro. $29.99/mo' : 'Create free account'}
                    </button>
                  </form>
                  <p className="text-center text-xs text-gray-400 mt-3">
                    Already have an account?{' '}
                    <button onClick={() => router.push('/dashboard')} className="text-purple-600 hover:underline font-medium bg-transparent border-none cursor-pointer p-0">Log in</button>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <div className="desktop-nav">
        <MainNav currentPage="landing" userProfile={userProfile} />
      </div>
      <div className="mobile-nav" style={{display:'none',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',background:'white',borderBottom:'1px solid rgba(0,0,0,0.06)',position:'sticky',top:0,zIndex:40}}>
        <div style={{display:'flex',alignItems:'center'}}>
          <img src="/images/HirePower_logo.png" alt="Hire Power" style={{height:'32px',width:'auto'}} />
        </div>
        <button onClick={() => { setSignupAsPro(false); setShowSignupModal(true); }} style={{background:'linear-gradient(to right,#667eea,#764ba2)',color:'white',padding:'8px 16px',borderRadius:'8px',fontSize:'13px',fontWeight:600,border:'none',cursor:'pointer'}}>
          Get started
        </button>
      </div>

      <div className="landing-page">
      {/* HERO */}
      <section className="hero">
        <div className="hero-left">
          <div className="hero-inner-pad" style={{marginLeft:'48px'}}>
          <p style={{fontFamily:"'Fraunces',serif",fontSize:'22px',fontWeight:400,fontStyle:'italic',color:'#9ca3af',letterSpacing:'-0.5px',marginBottom:'8px'}}>One 20-minute conversation now.</p>
          <h1>Never write your<br/> resume <em>again.</em></h1>
          <p className="hero-sub">AI knows how to write a great resume. The problem is, it doesn&apos;t know you. Hire Power interviews you like a professional resume writer would. And we don&apos;t just tell you how to improve your resume. We actually do it for you. Then we keep building it in the background as your career grows.</p>
         
         <div style={{display:'flex',alignItems:'center',gap:'24px',margin:'0 0 24px',flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={{width:'3px',height:'36px',background:'var(--purple)',borderRadius:'2px',flexShrink:0}}/>
              <p style={{fontFamily:"'Fraunces',serif",fontSize:'18px',fontWeight:700,fontStyle:'italic',color:'#1a1033',lineHeight:1.3,margin:0}}>Job hunting is small talk.<br/>Your career deserves a conversation.</p>
            </div>
           <button onClick={() => setShowSignupModal(true)} style={{display:'inline-flex',alignItems:'center',background:'linear-gradient(to right, #667eea, #764ba2)',color:'white',padding:'10px 24px',borderRadius:'8px',fontSize:'13px',fontWeight:600,border:'none',cursor:'pointer',boxShadow:'0 4px 24px rgba(108,99,255,0.35)',transition:'opacity 0.2s',flexShrink:0}}>Start now for free</button>
          </div>
          </div>
          <div className="hero-trust">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L9.854 5.757L15 6.292L11.25 9.773L12.382 15L8 12.35L3.618 15L4.75 9.773L1 6.292L6.146 5.757L8 1Z" fill="currentColor"/></svg>
            No credit card required &nbsp;·&nbsp; Free forever plan <span className="hide-on-mobile">&nbsp;·&nbsp; Built by a professional resume writer</span>
          </div>
        </div>

        <div className="hero-visual" style={{display:'flex',alignItems:'center',position:'relative'}}>
          {/* Chat card */}
          <div style={{background:'white',borderRadius:'20px',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.11), 0 4px 16px rgba(0,0,0,0.06)',border:'1px solid rgba(0,0,0,0.07)',width:'360px',flexShrink:0,position:'relative',zIndex:1}}>
            <div style={{background:'linear-gradient(to right,#667eea,#764ba2)',padding:'11px 14px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:'7px'}}>
                <div style={{width:'24px',height:'24px',background:'rgba(255,255,255,0.2)',borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M8 2L3 8h4.5L5.5 12l5.5-6H6.5L8 2z" fill="white"/></svg>
                </div>
                <div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:'11px',fontWeight:700,color:'white'}}>Resume Coach</div>
                  <div style={{fontSize:'9px',color:'rgba(255,255,255,0.65)'}}>Core Resume | Coaching step</div>
                </div>
              </div>
              <div style={{display:'flex',gap:'4px'}}>
                {[0,1,2].map(i=><div key={i} style={{width:'7px',height:'7px',borderRadius:'50%',background:'rgba(255,255,255,0.25)'}}/>)}
              </div>
            </div>
            {/* Progress strip */}
            <div style={{background:'#f9fafb',borderBottom:'1px solid #e5e7eb',padding:'7px 14px 4px'}}>
              <div style={{display:'flex',alignItems:'center'}}>
                {['Review','Assess','Coach','Improve','Format','Save'].map((step,i)=>(
                  <React.Fragment key={step}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}}>
                      {i < 2 ? (
                        <div style={{width:'15px',height:'15px',borderRadius:'50%',background:'#9333ea',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l1.5 1.5 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      ) : i === 2 ? (
                        <div style={{width:'15px',height:'15px',borderRadius:'50%',background:'#9333ea',border:'2px solid #9333ea',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <div style={{width:'5px',height:'5px',borderRadius:'50%',background:'white'}}/>
                        </div>
                      ) : (
                        <div style={{width:'15px',height:'15px',borderRadius:'50%',background:'white',border:'1.5px solid #d1d5db'}}/>
                      )}
                      <span style={{fontSize:'7.5px',color:i<=2?'#9333ea':'#9ca3af',fontWeight:i<=2?600:400}}>{step}</span>
                    </div>
                    {i < 5 && <div style={{height:'1.5px',flex:1,background:i<2?'#9333ea':'#e5e7eb',marginBottom:'11px'}}/>}
                  </React.Fragment>
                ))}
              </div>
            </div>
            {/* Chat messages */}
            <div style={{padding:'9px 12px 0',background:'#fafafa',display:'flex',flexDirection:'column',gap:'5px'}}>
              <div style={{background:'#f5f3ff',border:'1px solid #e9d5ff',borderRadius:'3px 9px 9px 9px',padding:'8px 10px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'4px',marginBottom:'3px'}}>
                  <span style={{fontSize:'10px'}}>🎓</span>
                  <span style={{fontSize:'8.5px',fontWeight:600,color:'#7c3aed'}}>Resume Coach</span>
                </div>
                <p style={{fontSize:'11.5px',color:'#1f2937',lineHeight:1.5,margin:0}}>When inventory counts were off, who usually figured out why?</p>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end'}}>
                <div style={{background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:'9px 3px 9px 9px',padding:'8px 10px',maxWidth:'84%'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'3px',marginBottom:'3px'}}>
                    <div style={{width:'11px',height:'11px',borderRadius:'50%',background:'#e9d5ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'6.5px',fontWeight:700,color:'#9333ea'}}>M</div>
                    <span style={{fontSize:'8.5px',fontWeight:600,color:'#6b7280'}}>You</span>
                  </div>
                  <p style={{fontSize:'11.5px',color:'#1f2937',lineHeight:1.5,margin:0}}>Me. I cross-checked the system against the floor every week. My manager trusted my counts more than the software.</p>
                </div>
              </div>
              <div style={{background:'#f5f3ff',border:'1px solid #e9d5ff',borderRadius:'3px 9px 9px 9px',padding:'8px 10px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'4px',marginBottom:'3px'}}>
                  <span style={{fontSize:'10px'}}>🎓</span>
                  <span style={{fontSize:'8.5px',fontWeight:600,color:'#7c3aed'}}>Resume Coach</span>
                </div>
                <p style={{fontSize:'11.5px',color:'#1f2937',lineHeight:1.5,margin:0}}>Did that ever actually catch something?</p>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end'}}>
                <div style={{background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:'9px 3px 9px 9px',padding:'8px 10px',maxWidth:'84%'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'3px',marginBottom:'3px'}}>
                    <div style={{width:'11px',height:'11px',borderRadius:'50%',background:'#e9d5ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'6.5px',fontWeight:700,color:'#9333ea'}}>M</div>
                    <span style={{fontSize:'8.5px',fontWeight:600,color:'#6b7280'}}>You</span>
                  </div>
                  <p style={{fontSize:'11.5px',color:'#1f2937',lineHeight:1.5,margin:0}}>Yeah, a vendor had been short-shipping us for months. Probably $8–10K worth.</p>
                </div>
              </div>
            </div>
            {/* Coached bullet */}
            <div style={{margin:'7px 12px 10px',background:'white',border:'1px solid #e5e7eb',borderRadius:'9px',padding:'8px 12px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'4px',marginBottom:'5px'}}>
                <div style={{width:'14px',height:'14px',borderRadius:'50%',background:'#10b981',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l1.5 1.5 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span style={{fontSize:'8.5px',fontWeight:700,color:'#10b981',textTransform:'uppercase',letterSpacing:'0.07em'}}>Coached Bullet</span>
              </div>
              <p style={{fontSize:'11.5px',color:'#111827',lineHeight:1.55,margin:0}}>Identified systematic vendor short-shipment through independent weekly audits, recovering an estimated $8–10K in merchandise and exposing a gap in the receiving process.</p>
            </div>
          </div>

          {/* Improvement Complete card */}
          <div style={{width:'210px',flexShrink:0,marginLeft:'-16px',background:'white',borderRadius:'16px',overflow:'hidden',boxShadow:'0 20px 60px rgba(147,51,234,0.22), 0 4px 20px rgba(0,0,0,0.1)',border:'1px solid rgba(147,51,234,0.1)',position:'relative',zIndex:2}}>
            <div style={{background:'linear-gradient(to bottom right, #667eea, #764ba2)',padding:'18px 16px 14px',textAlign:'center'}}>
              <div style={{width:'36px',height:'36px',background:'rgba(255,255,255,0.2)',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 8px'}}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M10.5 2L4 10h5.5L7.5 16l7-8h-5.5L10.5 2z" fill="white"/></svg>
              </div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:'15px',fontWeight:800,color:'white',letterSpacing:'-0.3px'}}>Improvement Complete.</div>
            </div>
            <div style={{padding:'16px',textAlign:'center'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'12px',marginBottom:'10px'}}>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:'10px',color:'#9ca3af',fontWeight:500,marginBottom:'3px'}}>Before</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:'32px',fontWeight:800,color:'#d1d5db',lineHeight:1}}>66</div>
                </div>
                <div style={{color:'#9333ea',fontSize:'18px',fontWeight:300,paddingTop:'14px'}}>→</div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:'10px',color:'#9ca3af',fontWeight:500,marginBottom:'3px'}}>After</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:'32px',fontWeight:800,color:'#9333ea',lineHeight:1}}>88</div>
                </div>
              </div>
              <div style={{background:'#f0fdf4',borderRadius:'8px',padding:'8px 12px',marginBottom:'12px'}}>
                <div style={{fontSize:'13px',fontWeight:700,color:'#10b981'}}>+22 points</div>
                <div style={{fontSize:'11px',color:'#6b7280',marginTop:'1px'}}>12 bullets improved</div>
                <div style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>7 new skills identified</div>
              </div>
              <div style={{background:'linear-gradient(to right, #667eea, #764ba2)',borderRadius:'8px',padding:'10px',textAlign:'center'}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:'12px',fontWeight:700,color:'white'}}>Format My Resume →</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM / DIRTY SECRET */}
      <section className="problem" id="problem">
        <div className="container">
          <div className="section-eyebrow">The Dirty Secret</div>
          <h2 className="section-title">AI tools are <em> making up </em><br/>your resume.</h2>
          <p className="section-sub" style={{maxWidth:'760px'}}>
            A VP of Business Development with 20+ years selling to aerospace and defense. Tried two resume tools, theirs and ours. Here&apos;s a sample bullet from his resume and what each tool did with it:{' '}
            <strong><em style={{color:'rgba(255,255,255,0.92)'}}>&quot;Built strategic relationships with high-profile commercial customers including Boeing, managing long-cycle sales for complex technology packages.&quot;</em></strong>
          </p>

          {/* Side-by-side comparison */}
          <div className="problem-comparison-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',marginTop:'24px',marginBottom:'64px'}}>
            <div style={{background:'white',borderRadius:'16px',overflow:'hidden',boxShadow:'0 8px 40px rgba(0,0,0,0.25)'}}>
              <div style={{background:'#374151',padding:'16px 22px',display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontSize:'16px'}}>⚠️</span>
                <span style={{fontFamily:"'Fraunces',serif",fontSize:'14px',fontWeight:700,color:'rgba(255,255,255,0.9)',fontStyle:'italic'}}>They saw Boeing and made the rest up.</span>
              </div>
              <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:'18px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{flex:1,height:'1px',background:'#f3f4f6'}}/>
                  <div style={{fontSize:'11px',fontWeight:700,color:'#ef4444',textTransform:'uppercase',letterSpacing:'0.08em'}}>Other AI Suggestion</div>
                  <div style={{flex:1,height:'1px',background:'#f3f4f6'}}/>
                </div>
                <p style={{fontSize:'13.5px',color:'#374151',lineHeight:1.75,margin:0,fontStyle:'italic',paddingLeft:'14px',borderLeft:'3px solid #fca5a5'}}>&quot;Coordinated with customers on airline services, communicating flight controls to 50+ customers; addressed queries of on board passengers, securing selection as 1 of 3 Boeing Global Services Spotlight interns.&quot;</p>
              </div>
            </div>

            <div style={{background:'white',borderRadius:'16px',overflow:'hidden',boxShadow:'0 8px 40px rgba(0,0,0,0.25)'}}>
              <div style={{background:'linear-gradient(to right,#667eea,#764ba2)',padding:'16px 22px',display:'flex',alignItems:'center',gap:'8px'}}>
                <div style={{width:'20px',height:'20px',background:'rgba(255,255,255,0.2)',borderRadius:'5px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M8 2L3 8h4.5L5.5 12l5.5-6H6.5L8 2z" fill="white"/></svg>
                </div>
                <span style={{fontFamily:"'Fraunces',serif",fontSize:'14px',fontWeight:700,color:'white',fontStyle:'italic'}}>We saw Boeing and discovered the real story.</span>
              </div>
              <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:'18px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{flex:1,height:'1px',background:'#f3f4f6'}}/>
                  <div style={{fontSize:'11px',fontWeight:700,color:'#10b981',textTransform:'uppercase',letterSpacing:'0.08em'}}>Hire Power AI Suggestion</div>
                  <div style={{flex:1,height:'1px',background:'#f3f4f6'}}/>
                </div>
                <p style={{fontSize:'13.5px',color:'#111827',lineHeight:1.75,margin:0,fontStyle:'italic',paddingLeft:'14px',borderLeft:'3px solid #a78bfa'}}>&quot;Secured company&apos;s first-ever enterprise engagement with Boeing&apos;s aerospace division, a $10M contract for eight advanced technology packages built over two years of strategic pursuit.&quot;</p>
              </div>
            </div>
          </div>

          {/* Transition */}
          <div className="we-just-asked-gap" style={{textAlign:'center',marginBottom:'56px'}}>
            <p style={{fontFamily:"'Fraunces',serif",fontSize:'clamp(22px,2.8vw,36px)',fontWeight:700,color:'white',lineHeight:1.3,fontStyle:'italic'}}>
              How did we get all that information?<span style={{color:'#a78bfa'}}> We just asked.</span>
            </p>
          </div>

          {/* Chat + Editorial panel */}
          <div className="problem-chat-grid" style={{display:'grid',gridTemplateColumns:'520px 1fr',gap:'36px',alignItems:'start'}}>

            {/* Chat card */}
            <div className="problem-chat-grid-chat" style={{background:'white',borderRadius:'16px',overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,0.3),0 4px 16px rgba(0,0,0,0.15)',border:'1px solid rgba(0,0,0,0.06)'}}>
              {/* Header */}
              <div style={{background:'linear-gradient(to right,#667eea,#764ba2)',padding:'8px 12px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                  <div style={{width:'20px',height:'20px',background:'rgba(255,255,255,0.2)',borderRadius:'5px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M8 2L3 8h4.5L5.5 12l5.5-6H6.5L8 2z" fill="white"/></svg>
                  </div>
                  <div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:'10px',fontWeight:700,color:'white'}}>Resume Coach</div>
                    <div style={{fontSize:'8px',color:'rgba(255,255,255,0.65)'}}>Robert&apos;s Core Resume | Coaching step</div>
                  </div>
                </div>
                <div style={{display:'flex',gap:'4px'}}>
                  {[0,1,2].map(i=><div key={i} style={{width:'6px',height:'6px',borderRadius:'50%',background:'rgba(255,255,255,0.25)'}}/>)}
                </div>
              </div>

              {/* Progress strip */}
              <div style={{background:'#f9fafb',borderBottom:'1px solid #e5e7eb',padding:'5px 12px 3px'}}>
                <div style={{display:'flex',alignItems:'center'}}>
                  {['Review','Assess','Coach','Improve','Format','Save'].map((step,i)=>(
                    <React.Fragment key={step}>
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'1px'}}>
                        {i < 2 ? (
                          <div style={{width:'13px',height:'13px',borderRadius:'50%',background:'#9333ea',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <svg width="6" height="6" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l1.5 1.5 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        ) : i === 2 ? (
                          <div style={{width:'13px',height:'13px',borderRadius:'50%',background:'#9333ea',border:'2px solid #9333ea',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <div style={{width:'4px',height:'4px',borderRadius:'50%',background:'white'}}/>
                          </div>
                        ) : (
                          <div style={{width:'13px',height:'13px',borderRadius:'50%',background:'white',border:'1.5px solid #d1d5db'}}/>
                        )}
                        <span style={{fontSize:'7px',color:i<=2?'#9333ea':'#9ca3af',fontWeight:i<=2?600:400}}>{step}</span>
                      </div>
                      {i < 5 && <div style={{height:'1.5px',flex:1,background:i<2?'#9333ea':'#e5e7eb',marginBottom:'9px'}}/>}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div style={{padding:'8px 10px 0',background:'#fafafa',display:'flex',flexDirection:'column',gap:'5px'}}>
                {[
                  {role:'coach', text:"I can see you're VP of Business Development. You listed Boeing as a key customer. Tell me about that relationship and what they were buying from you."},
                  {role:'robert', text:"Boeing was a brand new client. They'd never ordered from us before. We engineered technology packages for their aerospace division."},
                  {role:'coach', text:"You landed Boeing Aerospace as a first-ever client for your company. That's a career-defining deal! Walk me through how it developed. Was it a one-time order, or were they a repeat customer?"},
                  {role:'robert', text:"Two packages initially, then six more over the next two years."},
                  {role:'coach', text:"What was the total contract value? Can you give me a dollar range on those packages?"},
                  {role:'robert', text:"They ranged from $400K to $1.6M each. Total was over $10M."},
                ].map((msg,i)=> msg.role === 'coach' ? (
                  <div key={i} style={{background:'#f5f3ff',border:'1px solid #e9d5ff',borderRadius:'3px 9px 9px 9px',padding:'6px 10px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'4px',marginBottom:'2px'}}>
                      <span style={{fontSize:'9px'}}>🎓</span>
                      <span style={{fontSize:'8px',fontWeight:600,color:'#7c3aed'}}>Resume Coach</span>
                    </div>
                    <p style={{fontSize:'11px',color:'#1f2937',lineHeight:1.45,margin:0}}>{msg.text}</p>
                  </div>
                ) : (
                  <div key={i} style={{display:'flex',justifyContent:'flex-end',alignItems:'flex-end',gap:'5px'}}>
                    <div style={{background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:'9px 3px 9px 9px',padding:'6px 10px',maxWidth:'84%'}}>
                      <p style={{fontSize:'11px',color:'#1f2937',lineHeight:1.45,margin:0}}>{msg.text}</p>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px',flexShrink:0}}>
                      <div style={{width:'18px',height:'18px',borderRadius:'50%',background:'#dbeafe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'7px',fontWeight:700,color:'#2563eb'}}>R</div>
                      <span style={{fontSize:'7px',fontWeight:600,color:'#9ca3af'}}>Robert</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coached bullet */}
              <div style={{margin:'6px 10px 10px',background:'white',border:'1px solid #e5e7eb',borderRadius:'9px',padding:'6px 10px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'4px',marginBottom:'4px'}}>
                  <div style={{width:'12px',height:'12px',borderRadius:'50%',background:'#10b981',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <svg width="6" height="6" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l1.5 1.5 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <span style={{fontSize:'8px',fontWeight:700,color:'#10b981',textTransform:'uppercase',letterSpacing:'0.07em'}}>Coached Bullet</span>
                </div>
                <p style={{fontSize:'11px',color:'#111827',lineHeight:1.5,margin:0}}>Secured company&apos;s first-ever enterprise engagement with Boeing&apos;s aerospace division, a $10M contract for eight advanced technology packages built over two years of strategic pursuit.</p>
              </div>
            </div>

            {/* Editorial panel */}
            <div style={{paddingTop:'8px'}}>
              <p className="editorial-headline" style={{fontFamily:"'Fraunces',serif",fontSize:'clamp(14px,1.4vw,17px)',fontWeight:700,color:'#a78bfa',lineHeight:1.35,margin:'0 0 20px',fontStyle:'italic'}}>
                Hire Power is the AI that interviews you like a professional resume writer would.{' '}
                <span style={{color:'white'}}>Because your resume needs facts, not fiction.</span>
              </p>
              <p className="editorial-body" style={{fontSize:'14px',color:'rgba(255,255,255,0.7)',lineHeight:1.5,margin:'0 0 10px'}}>We recognized a VP who landed a $10M deal with Boeing Aerospace.</p>
              <p className="editorial-body" style={{fontSize:'14px',color:'rgba(255,255,255,0.5)',lineHeight:1.5,margin:'0 0 20px',fontStyle:'italic'}}>The competitor saw &quot;Boeing&quot; and turned him into an intern (or a flight attendant; we can&apos;t quite tell!)</p>
              <div style={{height:'1px',background:'rgba(255,255,255,0.1)',marginBottom:'18px'}}/>
              <p style={{fontSize:'13px',color:'rgba(255,255,255,0.5)',lineHeight:1.6,margin:'0 0 14px',fontWeight:600}}>After working with Hire Power, Robert landed:</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'24px'}}>
                <div style={{borderLeft:'3px solid #9333ea',paddingLeft:'14px'}}>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:'56px',fontWeight:900,color:'white',lineHeight:1,letterSpacing:'-2px'}}>3</div>
                  <div style={{fontSize:'12px',fontWeight:600,color:'rgba(255,255,255,0.6)',lineHeight:1.4,marginTop:'4px'}}>interviews<br/>within a week</div>
                </div>
                <div style={{borderLeft:'3px solid #a78bfa',paddingLeft:'14px'}}>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:'56px',fontWeight:900,color:'white',lineHeight:1,letterSpacing:'-2px'}}>1</div>
                  <div style={{fontSize:'12px',fontWeight:600,color:'rgba(255,255,255,0.6)',lineHeight:1.4,marginTop:'4px'}}>offer<br/>within the month</div>
                </div>
              </div>
              <p className="editorial-quote" style={{fontFamily:"'Fraunces',serif",fontSize:'clamp(15px,1.6vw,18px)',fontWeight:700,fontStyle:'italic',color:'#a78bfa',lineHeight:1.3,margin:'0 0 28px'}}>
                Same candidate. Two tools. One wrote fiction.<br className="desktop-break"/> <span style={{color:'white'}}>The other got him hired.</span>
              </p>
              <button onClick={() => setShowSignupModal(true)} style={{display:'inline-block',background:'linear-gradient(to right,#667eea,#764ba2)',color:'white',fontFamily:"'DM Sans',sans-serif",fontSize:'14px',fontWeight:700,padding:'12px 24px',borderRadius:'10px',border:'none',cursor:'pointer',letterSpacing:'-0.01em',boxShadow:'0 4px 20px rgba(102,126,234,0.4)'}}>
                Start for free & reveal your best resume →
              </button>
            </div>
          </div>

          <div className="problem-truth mobile-reduce-top" style={{marginTop:'56px'}}>
            <p>&quot;Every number is real. Every word is defensible. Because when an interviewer asks you to back it up - and <strong>they will</strong> - <em>&apos;the AI wrote that&apos; isn&apos;t an answer.</em>&quot;</p>
          </div>
        </div>
      </section>

      {/* FINISH LINE SECTION */}
      <FinishLineSection />

      {/* INTERVIEW MOMENT */}
      <section className="interview-moment">
        <div className="interview-moment-inner">
          <div className="interview-moment-eyebrow">Interview Coach</div>
          <p>Interviewer asks: &quot;Tell me about your project management experience.&quot; You don&apos;t think you have any. <em>Hire Power already found three examples in your resume you didn&apos;t know counted.</em></p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how" id="how">
        <div className="container">
          <div className="section-eyebrow">How It Works</div>
          <h2 className="section-title">Three conversations.<br/> One complete picture.</h2>
          <p className="section-sub">Career Coach, Resume Coach, and Interview Coach share context and build on each other, so nothing falls through the cracks.</p>
          <div className="how-grid" style={{marginTop: '36px'}}>
            <div className="how-steps" style={{gap: '4px', paddingTop: '0px'}}>
              {[
                {n:'1',title:'Career Coach sets the direction',body:"Before we touch your resume, we talk about where you're going. Same field, career change, or figuring it out. It only takes five minutes, and your answer shapes everything that comes next. The best five-minute investment in your career."},
                {n:'2',title:'Resume Coach extracts what\'s real',body:"We ask the questions a $500 resume writer would ask. You discover achievements you'd forgotten, skills you didn't realize counted, and numbers you actually have. No fabrication. No guessing. Your resume should be fact, not fiction."},
                {n:'3',title:'Interview Coach prepares you to explain it',body:"For each job, we identify your Core Power, Hidden Power, and Power Gaps and coach you on the most effective ways to address each in your interview. Then we practice with AI-spoken questions that simulate a real interview."},
                {n:'4',title:'Career Vault keeps it running',body:"When the job search is over, Hire Power runs in the background, like the operating system for your career. Log wins as they happen, so you never have to start from scratch again. We'll be building your next resume while you're building your career."},
              ].map(step=>(
                <div key={step.n} className="how-step" style={{marginBottom: '8px'}}>
                  <div className="step-num">{step.n}</div>
                  <div className="step-content">
                   <h4 style={{marginBottom: '4px'}}>{step.title}</h4>
                    <p style={{lineHeight: '1.4'}}>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="how-visual">
              <div className="coaches-row">
                {[{icon:'🧭',name:'Career Coach',desc:'Direction & goals'},{icon:'📄',name:'Resume Coach',desc:'Your full story'},{icon:'🎯',name:'Interview Coach',desc:'Practice & power'}].map(c=>(
                  <div key={c.name} className="coach-pill">
                    <div className="coach-pill-icon">{c.icon}</div>
                    <h5>{c.name}</h5>
                    <p>{c.desc}</p>
                  </div>
                ))}
              </div>
              <div className="context-arrow">Shared context flows between all three coaches</div>
              <div className="power-score-visual">
                <div className="power-score-label">Your Power Analysis</div>
                {[
                  {label:'Core Power',pct:'88%',val:'88%',color:'var(--green)'},
                  {label:'Hidden Power',pct:'65%',val:'65%',color:'var(--amber)'},
                  {label:'Power Gaps',pct:'30%',val:'3',color:'var(--red)'},
                ].map(row=>(
                  <div key={row.label} className="score-bar-row">
                    <div className="score-bar-name" style={{color:row.color,fontSize:'12px',fontWeight:600}}>{row.label}</div>
                    <div className="score-bar-track"><div className="score-bar-fill" style={{width:row.pct,background:row.color}}/></div>
                    <div className="score-bar-val">{row.val}</div>
                  </div>
                ))}
                <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid #E5E7EB'}}>
                  <div style={{fontSize:'12px',color:'var(--gray)',marginBottom:'8px'}}>💡 Hidden Power discovered:</div>
                  <div style={{fontSize:'13px',color:'var(--black)',lineHeight:1.5}}>&quot;You&apos;ve been doing project management this whole time. You just haven&apos;t been calling it that.&quot;</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MANIFESTO */}
      <section className="manifesto">
        <div className="manifesto-inner">
          <div className="manifesto-eyebrow">Our Belief</div>
          <p><strong>Most tools help you find a job.</strong> Ours helps you build a career. Hire Power is your <em>lifelong career coach</em>, turning career management from a crisis into an ongoing conversation. Through AI-powered coaching, we help you bulletproof your resume, level up your interviews, and build a career archive that grows with you. <strong>From entry-level to executive suite, we help you power through the&nbsp;entire&nbsp;journey.</strong></p>
        </div>
      </section>

      {/* BUILD WITH COACH */}
      <section style={{background:'var(--purple-light)',padding:'80px 0',borderTop:'1px solid rgba(108,99,255,0.1)',borderBottom:'1px solid rgba(108,99,255,0.1)'}}>
        <div className="container">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'64px',alignItems:'center'}} className="build-with-coach-grid">
            {/* Copy side */}
            <div>
              <div style={{fontSize:'13px',fontWeight:700,letterSpacing:'0.04em',color:'var(--purple)',marginBottom:'20px'}}>
                brb · best resume builder
              </div>
              <h2 style={{fontFamily:"'Fraunces',serif",fontWeight:900,fontSize:'clamp(36px,4vw,56px)',lineHeight:1.05,letterSpacing:'-1.5px',color:'var(--black)',marginBottom:'24px'}}>
                Zero to applied in<br className="mobile-break" style={{display:'none'}}/> <em style={{fontStyle:'italic',color:'var(--purple)'}}>30 minutes.</em>
              </h2>
              <p style={{fontSize:'17px',color:'#374151',lineHeight:1.65,marginBottom:'12px'}}>
                No resume? No problem. Build one in minutes - right from your phone! Coach asks. You answer. Talk it out, type it in, or switch between both. Your resume builds in real time while you walk the dog, watch a show, or sit at Starbucks.
              </p>
              <p style={{fontSize:'15px',color:'var(--purple)',fontStyle:'italic',fontWeight:500,marginBottom:'16px'}}>
                No computer. No blank page. Just talk.
              </p>
              <button
                onClick={() => { setSignupAsPro(true); setShowSignupModal(true); }}
                style={{display:'inline-flex',alignItems:'center',background:'linear-gradient(to right,#667eea,#764ba2)',color:'white',padding:'14px 28px',borderRadius:'10px',fontSize:'15px',fontWeight:600,border:'none',cursor:'pointer',boxShadow:'0 4px 24px rgba(108,99,255,0.35)',transition:'opacity 0.2s',marginTop:'12px'}}
              >
                Start Talking →
              </button>
            </div>

            {/* Visual side - mobile chat mock */}
            <div style={{display:'flex',justifyContent:'center',alignItems:'center'}} className="build-with-coach-visual">
              <div style={{width:'280px',background:'white',borderRadius:'24px',overflow:'hidden',boxShadow:'0 20px 60px rgba(108,99,255,0.18), 0 4px 16px rgba(0,0,0,0.06)',border:'1px solid rgba(0,0,0,0.05)'}}>
                {/* Phone-like header */}
                <div style={{background:'linear-gradient(to right,#667eea,#764ba2)',padding:'12px 16px',display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{width:'24px',height:'24px',background:'rgba(255,255,255,0.2)',borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M8 2L3 8h4.5L5.5 12l5.5-6H6.5L8 2z" fill="white"/></svg>
                  </div>
                  <div>
                    <div style={{fontSize:'11px',fontWeight:700,color:'white'}}>brb · best resume builder</div>
                    <div style={{fontSize:'9px',color:'rgba(255,255,255,0.7)'}}>Mobile · Talk or type</div>
                  </div>
                </div>
                {/* Chat */}
                <div style={{padding:'12px',background:'#fafafa',display:'flex',flexDirection:'column',gap:'8px'}}>
                  <div style={{background:'#f5f3ff',border:'1px solid #e9d5ff',borderRadius:'4px 12px 12px 12px',padding:'9px 12px'}}>
                    <p style={{fontSize:'12px',color:'#1f2937',lineHeight:1.5,margin:0}}>What do you want to do for work?</p>
                  </div>
                  <div style={{display:'flex',justifyContent:'flex-end'}}>
                    <div style={{background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:'12px 4px 12px 12px',padding:'9px 12px',maxWidth:'85%'}}>
                      <p style={{fontSize:'12px',color:'#1f2937',lineHeight:1.5,margin:0}}>Marketing internships, ideally something with social media</p>
                    </div>
                  </div>
                  <div style={{background:'#f5f3ff',border:'1px solid #e9d5ff',borderRadius:'4px 12px 12px 12px',padding:'9px 12px'}}>
                    <p style={{fontSize:'12px',color:'#1f2937',lineHeight:1.5,margin:0}}>Have you run any social accounts, even for a club or side thing?</p>
                  </div>
                  <div style={{display:'flex',justifyContent:'flex-end'}}>
                    <div style={{background:'#f3f4f6',border:'1px solid #e5e7eb',borderRadius:'12px 4px 12px 12px',padding:'9px 12px',maxWidth:'85%'}}>
                      <p style={{fontSize:'12px',color:'#1f2937',lineHeight:1.5,margin:0}}>Yeah, I run my sorority's TikTok. We went from 200 to 4K followers this semester</p>
                    </div>
                  </div>
                  <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:'12px',padding:'9px 12px',marginTop:'4px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'5px',marginBottom:'5px'}}>
                      <div style={{width:'13px',height:'13px',borderRadius:'50%',background:'#10b981',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <svg width="6" height="6" viewBox="0 0 8 8" fill="none"><path d="M1.5 4l1.5 1.5 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <span style={{fontSize:'8px',fontWeight:700,color:'#10b981',textTransform:'uppercase',letterSpacing:'0.07em'}}>Added to your resume</span>
                    </div>
                    <p style={{fontSize:'11.5px',color:'#111827',lineHeight:1.5,margin:0}}>Grew sorority TikTok account from 200 to 4,000 followers in one semester through original short-form content strategy.</p>
                  </div>
                </div>
                {/* Mic input bar */}
                <div style={{padding:'10px 12px',background:'white',borderTop:'1px solid #f3f4f6',display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{flex:1,height:'30px',background:'#f9fafb',borderRadius:'15px',display:'flex',alignItems:'center',padding:'0 12px',fontSize:'11px',color:'#9ca3af'}}>
                    Type or tap mic to talk...
                  </div>
                  <div style={{width:'30px',height:'30px',background:'linear-gradient(to right,#667eea,#764ba2)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" fill="white"/><path d="M19 11a7 7 0 01-14 0M12 18v3" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NEVER START OVER */}
      <section className="never-start-section" style={{background:'white',padding:'100px 80px',textAlign:'center',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'800px',height:'800px',background:'radial-gradient(circle, rgba(147,51,234,0.05) 0%, transparent 70%)',pointerEvents:'none'}}/>
        <div style={{position:'relative',maxWidth:'900px',margin:'0 auto'}}>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:'11px',fontWeight:700,letterSpacing:'0.15em',textTransform:'uppercase',color:'#9333ea',marginBottom:'32px'}}>The part nobody talks about</div>
          <h2 className="never-start-heading" style={{fontFamily:"'Fraunces',serif",fontSize:'clamp(56px,7vw,100px)',fontWeight:900,lineHeight:1.0,letterSpacing:'-3px',color:'#0f0f0f',margin:0}}>Never start from <em style={{fontStyle:'italic',color:'#9333ea'}}>scratch</em> again.</h2>
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:'18px',color:'#6b7280',lineHeight:1.65,maxWidth:'560px',margin:'32px auto 0'}}>Three years from now, you won&apos;t remember what you accomplished today. Hire Power will.</p>
        </div>
      </section>

      {/* VAULT */}
      <section className="vault" id="vault">
        <div className="container">
          <div className="vault-grid">
            <div>
              <div className="section-eyebrow">Hire Power Vault · $4.99/mo</div>
              <h2 className="section-title">The OS that keeps<br/> running between<br/><em> job searches.</em></h2>
              <p className="vault-body">Once your job search is complete, most people go dark - until the next scramble. By then, they can&apos;t remember what they accomplished two years ago. <strong>Career Vault keeps your career story developing in between.</strong> Log a win in 30 seconds. Note a new skill. Save a glowing email from your manager. When you&apos;re ready to move, your resume is basically already written.</p>
              <div className="vault-quote">&quot;Get hired. Log your wins along the way. We build your next resume while you build your career. Be ready for any opportunity. And never start from scratch again.&quot;</div>
              <p className="hide-on-mobile" style={{marginTop:'20px',fontSize:'14px',color:'rgba(255,255,255,0.35)'}}>Nobody turns off their operating system. They just use it more intensively at certain times. Hire Power keeps running in the background between job searches so you're always prepared and never panicked.</p>
            </div>
            <div className="vault-visual">
              <div style={{fontSize:'12px',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'rgba(255,255,255,0.35)',marginBottom:'24px'}}>Career  · Live</div>
              <div className="vault-timeline">
                {[
                  {dot:'🏆',bg:'rgba(16,185,129,0.15)',title:'Led Q3 product launch',desc:'Coordinated 4 teams, delivered 2 weeks ahead of schedule',date:'Mar 10'},
                  {dot:'📚',bg:'rgba(108,99,255,0.15)',title:'Completed PMP certification',desc:'Project Management Professional · PMI',date:'Feb 22'},
                  {dot:'💬',bg:'rgba(245,158,11,0.15)',title:'Manager kudos saved',desc:'"Your stakeholder work on this was exceptional"',date:'Feb 8'},
                  {dot:'📈',bg:'rgba(16,185,129,0.15)',title:'Reduced onboarding time 40%',desc:'New documentation system, measured over 3 cohorts',date:'Jan 15'},
                ].map(e=>(
                  <div key={e.title} className="vault-event">
                    <div className="vault-dot" style={{background:e.bg}}>{e.dot}</div>
                    <div className="vault-event-content">
                      <h5>{e.title}</h5>
                      <p>{e.desc}</p>
                    </div>
                    <div className="vault-event-date">{e.date}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:'24px',padding:'16px',background:'rgba(108,99,255,0.1)',borderRadius:'12px',border:'1px solid rgba(108,99,255,0.2)'}}>
                <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',marginBottom:'4px'}}>When you&apos;re ready to search again...</div>
                <div style={{fontSize:'14px',color:'rgba(255,255,255,0.8)',fontWeight:500}}>Your resume is 80% written already. ✓</div>
              </div>
            </div>
          </div>
        </div>
      </section>

{/* PRICING */}
      <section className="pricing" id="pricing">
        <div className="container">
          <div className="pricing-header">
            <div className="section-eyebrow" style={{textAlign:'center'}}>Pricing</div>
            <h2 className="section-title" style={{textAlign:'center'}}>One platform.<br/><em>Your whole career.</em></h2>
          </div>
          <p className="pricing-os-line"><strong>Free</strong>: Try the OS &nbsp;·&nbsp; <strong>Pro</strong>: Run the OS at full power &nbsp;·&nbsp; <strong>Vault</strong>: Keep the OS running between searches</p>
          <div className="pricing-tiers">

            {/* FREE */}
            <div className="tier-card">
              <div className="tier-os-tag">Try the OS</div>
              <div className="tier-name">Free</div>
              <div className="tier-price">$0</div>
              <p className="tier-desc">Get a real feel for conversation-based coaching. No credit card. No expiration.</p>
              <ul className="tier-features">
                <li><span className="check">✓</span> Career Coach - one session</li>
                <li style={{marginTop:'8px',paddingTop:'8px',borderTop:'1px solid rgba(0,0,0,0.06)',fontWeight:600,color:'var(--black)'}}>Resume Coach</li>
                <li><span className="check">✓</span> Core resume with AI analysis</li>
                <li><span className="check">✓</span> Resume Power Score</li>
                <li>
                  <span className="check">✓</span>
                  <span>Improvement Action Plan
                    <span style={{display:'block',fontSize:'12px',color:'#9ca3af',fontWeight:400,marginTop:'2px'}}>You apply the changes</span>
                  </span>
                </li>
               <li><span className="check">✓</span> Resume coaching trial</li>
                <li><span className="check">✓</span> ATS-optimized templates</li>
                <li><span className="check">✓</span> Unlimited downloads</li>
                <li><span className="check">✓</span> 3 job match scores</li>
                <li><span className="check">✓</span> 3 custom cover letters</li>
                <li><span className="check">✓</span> Job application tracking</li>
                <li style={{marginTop:'8px',paddingTop:'8px',borderTop:'1px solid rgba(0,0,0,0.06)',fontWeight:600,color:'var(--black)'}}>Interview Coach</li>
                <li><span className="check">✓</span> AI-spoken interview practice that mimics a real interview</li>
                <li><span className="check">✓</span> Unlimited with general questions</li>
                <li><span className="check">✓</span> 1 session with job-specific questions</li>
                <li><span className="check">✓</span> 1 Power Analysis reveal after your job-specific session: see what Pro prepares you with before each interview</li>
              </ul>
              <div className="tier-cta">
                <button onClick={() => setShowSignupModal(true)} className="tier-btn ghost" style={{width:'100%',cursor:'pointer',border:'1.5px solid rgba(0,0,0,0.12)'}}>Get started free</button>
              </div>
            </div>

            {/* PRO */}
            <div className="tier-card featured">
              <div className="featured-badge">MOST POPULAR</div>
              <div className="tier-os-tag">Full Power</div>
              <div className="tier-name">Pro</div>
              <div className="tier-price">$29.99<span>/mo</span></div>
              <p className="tier-desc">The complete Career OS. Every coach, every conversation, fully unlocked.</p>
              <ul className="tier-features">
                <li><span className="check">✓</span> Everything included in Free Tier PLUS:</li>
                <li style={{marginTop:'8px',paddingTop:'8px',borderTop:'1px solid rgba(255,255,255,0.1)',fontWeight:600,color:'white'}}>Resume Coach</li>
                <li><span className="check">✓</span> Core resume with AI analysis + coaching</li>
                 <li><span className="check">✓</span> Resume Power Score</li>
                <li>
                  <span className="check">✓</span>
                  <span>Improvement Action Plan
                    <span style={{display:'block',fontSize:'12px',color:'rgba(255,255,255,0.4)',fontWeight:400,marginTop:'2px'}}>Applied automatically in under a minute</span>
                  </span>
                </li>
                <li><span className="check">✓</span> Tailored resume for every application</li>
               <li><span className="check">✓</span> ATS-optimized templates</li>
                <li><span className="check">✓</span> Unlimited downloads</li>
                <li><span className="check">✓</span> Unlimited job match scores</li>
                <li><span className="check">✓</span> Custom cover letter for each application</li>
                <li><span className="check">✓</span> Job application tracking</li>
                <li><span className="check">✓</span> Career Vault: log wins between searches</li>
                <li style={{marginTop:'8px',paddingTop:'8px',borderTop:'1px solid rgba(255,255,255,0.1)',fontWeight:600,color:'white'}}>Interview Coach</li>
                <li><span className="check">✓</span> AI-spoken interview practice that mimics a real interview</li>
                <li><span className="check">✓</span> Power Analysis and Interview Coaching: Learn how to best present your experience for each specific role</li>
                <li><span className="check">✓</span> Unlimited coaching + practice</li>
                <li><span className="check">✓</span> Post-practice performance feedback</li>
                <li><span className="check">✓</span> Company research integration</li>
                <li><span className="check">✓</span> Level up before your interview with gamified practice progression</li>
              </ul>
              <div className="tier-cta">
                <button onClick={() => { setSignupAsPro(true); setShowSignupModal(true); }} className="tier-btn solid" style={{width:'100%',cursor:'pointer',border:'none',background:'linear-gradient(to right, #667eea, #764ba2)'}}>Go Pro: $29.99/mo</button>
              </div>
            </div>

            {/* VAULT */}
            <div className="tier-card">
              <div className="tier-os-tag">Keep the OS Running</div>
              <div className="tier-name">Vault</div>
              <div className="tier-price">$4.99<span>/mo</span></div>
              <p className="tier-desc">Stay ready between searches. Your career doesn&apos;t pause. Neither should your OS.</p>
               <ul className="tier-features">
                <li><span className="check">✓</span> Everything included in Free Tier PLUS:</li>
               <li style={{marginTop:'8px',paddingTop:'8px',borderTop:'1px solid rgba(0,0,0,0.1)',fontWeight:600,color:'var(--dark)'}}>Vault</li>
                <li><span className="check">✓</span> Save job description from the role you landed as the foundation of your next resume</li>
                <li><span className="check">✓</span> Track achievements as they happen</li>
                <li><span className="check">✓</span> Add new training, education, and skills in real time</li>
                <li><span className="check">✓</span> Performance review preperation</li>
                <li><span className="check">✓</span> Complete career archive access</li>
                <li><span className="check">✓</span> Unlimited resume downloads</li>  
              </ul>
              <div style={{marginTop:'auto',paddingTop:'24px',fontSize:'13px',color:'var(--gray)',fontStyle:'italic',lineHeight:1.5}}>
                Available after your job search, so you never have to start from scratch again.
              </div>
            </div>

          </div>
          <p className="pricing-note">
           No credit card required &nbsp;·&nbsp; Free forever <span className="pricing-note-upgrade">&nbsp;·&nbsp; Upgrade or downgrade anytime</span>
          </p>

          {/* MOBILE PRICING ACCORDION */}
          <div className="pricing-mobile" style={{display:'none'}}>
            {[
              {
                id: 'free',
                name: 'Free',
                price: '$0',
                tag: 'Try the OS',
                desc: 'Get a real feel for conversation-based coaching. No credit card. No expiration.',
                cta: 'Get started free',
                ctaStyle: {border:'1.5px solid rgba(0,0,0,0.12)',background:'white',color:'#0D0D0D'},
                onCta: () => setShowSignupModal(true),
                featured: false,
                features: [
                  'Career Coach: full access, unlimited',
                  'Core resume with AI analysis',
                  'Resume Power Score',
                  'Improvement Action Plan (you apply the changes)',
                  'Resume coaching trial',
                  'ATS-optimized templates',
                  'Unlimited downloads',
                  '3 job match scores',
                  '3 custom cover letters',
                  'Job application tracking',
                  'AI-spoken interview practice',
                  '1 job-specific interview session',
                  '1 Power Analysis reveal',
                ]
              },
              {
                id: 'pro',
                name: 'Pro',
                price: '$29.99',
                priceSuffix: '/mo',
                tag: 'Full Power',
                desc: 'The complete Career OS. Every coach, every conversation, fully unlocked.',
                cta: 'Go Pro: $29.99/mo',
                ctaStyle: {background:'linear-gradient(to right, #667eea, #764ba2)',color:'white',border:'none'},
                onCta: () => { setSignupAsPro(true); setShowSignupModal(true); },
                featured: true,
                features: [
                  'Everything in Free, plus:',
                  'Full resume coaching conversation',
                  'Improvements applied automatically',
                  'Unlimited job-specific resumes',
                  'Unlimited job match scores',
                  'Unlimited cover letters',
                  'Career Vault: log wins between searches',
                  'Power Analysis before every interview',
                  'Unlimited interview coaching and practice',
                  'Post-practice performance feedback',
                  'Company research integration',
                  'Gamified practice progression',
                ]
              },
              {
                id: 'vault',
                name: 'Vault',
                price: '$4.99',
                priceSuffix: '/mo',
                tag: 'Keep the OS Running',
                desc: 'Stay ready between searches. Available after your job search ends.',
                cta: null,
                ctaStyle: {},
                onCta: null,
                featured: false,
                features: [
                  'Everything in Free, plus:',
                  'Save job description from your hired role',
                  'Track achievements as they happen',
                  'Add training, education, skills in real time',
                  'Complete career archive access',
                  'Unlimited resume downloads',
                  '5 premium templates',
                ]
              }
            ].map(tier => {
              const isOpen = mobilePricingOpen === tier.id;
              return (
                <div
                  key={tier.id}
                  style={{
                    borderRadius: '16px',
                    border: tier.featured ? '2px solid #9333ea' : '1.5px solid rgba(0,0,0,0.08)',
                    background: tier.featured ? '#1a1033' : 'white',
                    overflow: 'hidden',
                    boxShadow: tier.featured ? '0 8px 32px rgba(108,99,255,0.2)' : 'none',
                    position: 'relative',
                  }}
                >
                  {tier.featured && (
                    <div style={{background:'#9333ea',color:'white',fontSize:'11px',fontWeight:700,textAlign:'center',padding:'6px',letterSpacing:'0.05em'}}>
                      MOST POPULAR
                    </div>
                  )}
                  {/* Always-visible header */}
                  <div style={{padding:'20px 20px 16px'}}>
                    <div style={{fontSize:'11px',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:tier.featured?'rgba(165,180,252,0.8)':'#9333ea',marginBottom:'6px'}}>{tier.tag}</div>
                    <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:'6px'}}>
                      <div>
                        <div style={{fontFamily:"'Fraunces',serif",fontSize:'28px',fontWeight:900,color:tier.featured?'white':'#0D0D0D',lineHeight:1}}>{tier.name}</div>
                        <div style={{fontSize:'28px',fontWeight:700,color:tier.featured?'white':'#0D0D0D',lineHeight:1,marginTop:'4px'}}>
                          {tier.price}{tier.priceSuffix && <span style={{fontSize:'14px',fontWeight:400,color:tier.featured?'rgba(255,255,255,0.5)':'#6B7280'}}>{tier.priceSuffix}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => setMobilePricingOpen(isOpen ? null : tier.id)}
                        style={{width:'32px',height:'32px',borderRadius:'50%',background:tier.featured?'rgba(255,255,255,0.15)':'#f5f3ff',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}
                      >
                        <span style={{fontSize:'20px',color:tier.featured?'white':'#9333ea',fontWeight:300,lineHeight:1}}>{isOpen ? '−' : '+'}</span>
                      </button>
                    </div>
                    <p style={{fontSize:'13px',color:tier.featured?'rgba(255,255,255,0.5)':'#6B7280',lineHeight:1.4,margin:'0 0 14px'}}>{tier.desc}</p>
                    {/* CTA always visible */}
                    {tier.cta && (
                      <button
                        onClick={tier.onCta}
                        style={{width:'100%',padding:'12px',borderRadius:'10px',fontSize:'14px',fontWeight:600,cursor:'pointer',textAlign:'center',...tier.ctaStyle}}
                      >
                        {tier.cta}
                      </button>
                    )}
                  </div>

                  {/* Expandable feature list */}
                  {isOpen && (
                    <div style={{padding:'0 20px 20px',borderTop:tier.featured?'1px solid rgba(255,255,255,0.1)':'1px solid rgba(0,0,0,0.06)',paddingTop:'16px'}}>
                      <ul style={{listStyle:'none',display:'flex',flexDirection:'column',gap:'10px'}}>
                        {tier.features.map((f,i) => (
                          <li key={i} style={{display:'flex',alignItems:'flex-start',gap:'8px',fontSize:'13px',color:tier.featured?'rgba(255,255,255,0.75)':'#374151',lineHeight:1.4}}>
                            <span style={{color:'#10b981',flexShrink:0,marginTop:'1px'}}>✓</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final-cta">
        <h2>Your career deserves <br/>a <em>real conversation.</em></h2>
        <p>Start with Career Coach - free, unlimited, and the most valuable five minutes of your job search.</p>
        <div className="final-cta-actions">
          <button onClick={() => { setSignupAsPro(false); setShowSignupModal(true); }} style={{display:'inline-flex',alignItems:'center',background:'white',color:'#0D0D0D',padding:'10px 24px',borderRadius:'8px',fontSize:'13px',fontWeight:600,border:'none',cursor:'pointer',boxShadow:'0 4px 24px rgba(0,0,0,0.2)',transition:'all 0.2s'}}>Start now for free</button>
        </div>
      </section>

      </div>
      <Footer />
    </>
  );
}
function FinishLineSection() {
  const [openIndex, setOpenIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const problems = [
    {
      label: 'No Clear Process',
      hook: 'Features scattered everywhere. Spent an hour just finding everything. No clear workflow. Never knew if we\'d tried everything or when we were actually done.',
      solution: 'Hire Power delivers a guided, 6-step journey - Review, Assess, Coach, Improve, Format, Save. You always know exactly where you are, what comes next, and when you\'re done.',
    },
    {
      label: 'Broken Scoring',
      hook: 'Most tools don\'t consider who you are. A strong student resume tanks because it\'s graded like a senior executive\'s because every resume is held to the same standard. That\'s not a score. That\'s a broken system.',
      solution: 'Hire Power uses adaptive scoring calibrated to Career Length, Job Level, and Job Type. Each candidate is judged by the right standard for where they are and where they\'re going in their career.',
    },
    {
      label: 'Suggestion Overload',
      hook: 'Other tools gave us 50+ suggestions per resume - so many that it became impossible to figure out how to make them all. We spent an hour reviewing and left with the same resume we started with.',
      solution: 'We don\'t give suggestions. We do the rewriting for you. One 20-minute conversation - finished resume in 2 minutes. You review and approve, but you never have to figure out how to implement 50 separate changes.',
    },
    {
      label: 'AI Fiction',
      hook: 'Other AI resume tools made things up. Created accomplishments we never achieved. Added metrics we never provided. The resume looked impressive but was complete fiction.',
      solution: 'We ask questions. We extract your story through conversation. Every number, every achievement, every skill on your resume is something you actually said. Nothing invented.',
    },
    {
      label: 'No Results',
      hook: 'Other tools only work with what\'s already on the page. If your best achievements never made it, other tools can\'t help much. They just polish what you wrote, which might not be your strongest material.',
      solution: 'We go beyond what\'s already there. Through conversation, we find wins you forgot and skills you didn\'t think mattered. We\'re not improving your resume. We\'re building a better one from your whole story.',
    },
  ];

  const gridTemplate = isMobile
    ? '1fr'
    : openIndex !== null
    ? problems.map((_, i) => i === openIndex ? '3fr' : '0.6fr').join(' ')
    : 'repeat(5, 1fr)';

  return (
    <>
    <section className="finish-line-section" style={{
      background: '#ffffff',
      padding: '80px 0',
      borderTop: '1px solid rgba(0,0,0,0.06)',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Radial glow */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '900px', height: '600px',
        background: 'radial-gradient(ellipse, rgba(147,51,234,0.045) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 48px', position: 'relative' }}>

        {/* Headline */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#9333ea', marginBottom: '16px'
          }}>
            Why We Built This
          </div>
         <h2 style={{
            fontFamily: "'Fraunces', serif",
            fontWeight: 400,
            fontSize: 'clamp(20px,2vw,26px)',
            color: '#9ca3af',
            letterSpacing: '-0.5px',
            margin: '0 0 6px',
          }}>
            Most tools give you features.
          </h2>
          <h2 style={{
            fontFamily: "'Fraunces', serif",
            fontWeight: 900,
            fontSize: 'clamp(36px,4.5vw,60px)',
            color: '#0D0D0D',
            letterSpacing: '-2px',
            lineHeight: 1.0,
            margin: '0 0 24px',
          }}>
            We give you a <br className="mobile-break" style={{display:'none'}}/><span style={{ color: '#9333ea', fontStyle: 'italic' }}>finish line.</span>
          </h2>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '17px', color: '#6B7280',
            lineHeight: 1.6, maxWidth: '800px', margin: '0 auto',
          }}>
            Ever spent an hour reviewing AI suggestions and walked away with the exact same resume you started with? We built Hire Power after living through every one of these. Here&apos;s what we fixed.
          </p>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          gap: '12px',
          alignItems: 'stretch',
          marginBottom: '-24px',
        }}>
          {problems.map((p, i) => {
            const isOpen = openIndex === i;
            const isHovered = hoveredIndex === i;
            const isCollapsed = openIndex !== null && !isOpen;

            return (
              <button
                key={i}
                onClick={() => setOpenIndex(isOpen ? null : i)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  background: isOpen
                    ? '#ffffff'
                    : isHovered
                    ? '#f0e9ff'
                    : 'linear-gradient(135deg, #faf5ff 0%, #f5f0ff 100%)',
                  borderTop: `1.5px solid ${isOpen ? '#c4b5fd' : isHovered ? '#9333ea' : '#e9d5ff'}`,
                  borderRight: `1.5px solid ${isOpen ? '#c4b5fd' : isHovered ? '#9333ea' : '#e9d5ff'}`,
                  borderBottom: `1.5px solid ${isOpen ? '#c4b5fd' : isHovered ? '#9333ea' : '#e9d5ff'}`,
                  borderLeft: `3px solid ${isOpen ? '#9333ea' : isHovered ? '#9333ea' : '#c4b5fd'}`,
                  borderRadius: '14px',
                  padding: isOpen ? '28px 32px' : '28px 18px',
                  cursor: 'pointer',
                  textAlign: isOpen ? 'left' : 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isOpen ? 'flex-start' : 'center',
                  justifyContent: isOpen ? 'flex-start' : 'center',
                  gap: isOpen ? '0' : '10px',
                  boxShadow: isOpen
                    ? '0 4px 24px rgba(147,51,234,0.10)'
                    : isHovered
                    ? '0 4px 20px rgba(147,51,234,0.12)'
                    : '0 1px 4px rgba(147,51,234,0.06)',
                  opacity: isCollapsed && !isMobile ? 0.5 : 1,
                  overflow: 'hidden',
                  minHeight: '180px',
                }}
              >
                {isOpen ? (
                  <div style={{ animation: 'panelFadeUp 0.25s ease both', width: '100%' }}>
                    {/* Header row */}
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', marginBottom: '16px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                          fontFamily: "'Fraunces', serif",
                          fontSize: '48px', fontWeight: 900,
                          color: '#c4b5fd',
                          lineHeight: 1,
                          letterSpacing: '-2px',
                          flexShrink: 0,
                        }}>
                          {String(i + 1).padStart(2, '0')}
                        </div>
                        <div style={{
                          fontFamily: "'Fraunces', serif",
                          fontSize: '20px', fontWeight: 700,
                          color: '#1a1033', lineHeight: 1.2,
                          letterSpacing: '-0.3px',
                        }}>
                          {p.label}
                        </div>
                      </div>
                      {/* Close button */}
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: '#ede9fe',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, marginLeft: '16px',
                      }}>
                        <span style={{ fontSize: '18px', color: '#7c3aed', fontWeight: 300, lineHeight: 1, marginTop: '-1px' }}>−</span>
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ height: '1px', background: '#c4b5fd', marginBottom: '20px' }} />

                    {/* Two column content */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '20px' : '32px' }}>
                      <div>
                        <div style={{
                          fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
                          textTransform: 'uppercase', marginBottom: '10px',
                          display: 'flex', alignItems: 'center', gap: '6px',
                          color: '#e57373',
                        }}>
                          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#e57373', flexShrink: 0 }} />
                          The Problem
                        </div>
                        <p style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '14px', fontWeight: 500,
                          color: '#374151',
                          lineHeight: 1.5, margin: 0,
                        }}>
                          {p.hook}
                        </p>
                      </div>
                      <div>
                        <div style={{
                          fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
                          textTransform: 'uppercase', marginBottom: '10px',
                          display: 'flex', alignItems: 'center', gap: '6px',
                          color: '#81c784',
                        }}>
                          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#81c784', flexShrink: 0 }} />
                          How Hire Power Fixes It
                        </div>
                        <p style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '14px', fontWeight: 500,
                          color: '#374151',
                          lineHeight: 1.5, margin: 0,
                        }}>
                          {p.solution}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                   <div style={{
                      fontFamily: "'Fraunces', serif",
                      fontSize: isCollapsed ? '28px' : '36px',
                      fontWeight: 900, lineHeight: 1,
                      color: isHovered ? '#7c3aed' : '#9333ea',
                      letterSpacing: '-1px', transition: 'color 0.2s, font-size 0.2s',
                    }}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div style={{
                      fontFamily: "'Fraunces', serif",
                      fontSize: isCollapsed ? '12px' : '15px',
                      fontWeight: 700,
                      color: isHovered ? '#7c3aed' : '#1a1033',
                      lineHeight: 1.25, letterSpacing: '-0.2px',
                      transition: 'color 0.2s, font-size 0.2s',
                      overflow: 'hidden',
                      width: '100%',
                      textAlign: 'center',
                      minHeight: '2.5em',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {p.label}
                    </div>
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: isHovered ? '#9333ea' : '#e9d5ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s', flexShrink: 0, marginTop: '4px',
                    }}>
                      <span style={{
                        fontSize: '16px', fontWeight: 300,
                        color: isHovered ? 'white' : '#9333ea',
                        lineHeight: 1, marginTop: '-1px',
                      }}>+</span>
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>

     </div>
    </section>

    {/* Transition callout */}
    <div className="finish-line-callout" style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 48px 80px',
      marginTop: '-4px',
      textAlign: 'center',
    }}>
      <div style={{
        display: 'flex',
        gap: '0',
        justifyContent: 'center',
      }}>
       
        {/* Text */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1px',
          maxWidth: '900px',
        }}>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '18px',
            fontWeight: 400,
            color: '#9ca3af',
            lineHeight: 1.4,
            margin: 0,
          }}>
            Each of these costs you interviews. We fixed them so you can focus on what comes next.
          </p>
          
          <p style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 'clamp(24px,2.5vw,32px)',
            fontWeight: 900,
            color: '#9333ea',
            fontStyle: 'italic',
            lineHeight: 1.1,
            letterSpacing: '-0.5px',
            margin: 0,
          }}>
            Because your resume is only half the conversation.
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
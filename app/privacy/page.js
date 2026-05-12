'use client';

import { useState, useEffect } from 'react';

export default function PrivacyPolicy() {
  const [backHref, setBackHref] = useState('/landing');
  const [backLabel, setBackLabel] = useState('Hire Power');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname;
    if (host === 'brbresume.com' || host === 'www.brbresume.com') {
      setBackHref('/');
      setBackLabel('brb');
    }
  }, []);

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",maxWidth:'760px',margin:'0 auto',padding:'80px 32px',color:'#1a1a1a',lineHeight:1.7}}>
      <div style={{marginBottom:'48px'}}>
        <a href={backHref} style={{fontSize:'14px',color:'#9333ea',textDecoration:'none',fontWeight:600}}>← {backLabel}</a>
      </div>
      <h1 style={{fontFamily:"'DM Sans',sans-serif",fontSize:'40px',fontWeight:900,letterSpacing:'-1.5px',marginBottom:'8px'}}>Privacy Policy</h1>
      <p style={{fontSize:'14px',color:'#6b7280',marginBottom:'48px'}}>Last updated: May 2026</p>

      <p style={{fontSize:'16px',marginBottom:'16px'}}>Hire Power AI LLC (&quot;Hire Power,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This policy explains what information we collect, how we use it, who we share it with, how long we keep it, and the rights you have over your data.</p>
      <p style={{fontSize:'16px',marginBottom:'32px'}}>If you have any questions about this policy, email us at <a href="mailto:hired@hirepowerai.com" style={{color:'#9333ea'}}>hired@hirepowerai.com</a>.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>What We Collect</h2>
      <p style={{marginBottom:'12px'}}><strong>Account information.</strong> When you create an account, we collect your email address, a hashed password, and any name or profile information you choose to provide.</p>
      <p style={{marginBottom:'12px'}}><strong>Resume and career data.</strong> We store the resume content, career history, achievements, performance review notes, coaching conversations, job descriptions, job tracker entries, cover letters, and any other career-related information you create or upload while using the platform.</p>
      <p style={{marginBottom:'12px'}}><strong>Voice and biometric information (Interview Coach only).</strong> If you choose to use voice-based interview practice, we process audio recordings of your spoken responses. We describe this in detail in the Voice and Biometric Information section below.</p>
      <p style={{marginBottom:'12px'}}><strong>Payment information.</strong> Subscriptions are processed by Stripe directly through their secure checkout. We do not store credit card numbers, billing addresses, or payment details. We receive only your subscription status from Stripe (active, cancelled, payment failed).</p>
      <p style={{marginBottom:'12px'}}><strong>Usage data.</strong> We collect information about how you interact with the platform, including features used, session activity, error events, and aggregate engagement patterns, to improve the product and identify problems. This is processed through PostHog, our analytics provider.</p>
      <p style={{marginBottom:'12px'}}><strong>Communications.</strong> When you contact support or interact with our email system, we keep a record of those communications so we can serve you better.</p>
      <p style={{marginBottom:'32px'}}><strong>We do not collect</strong> financial account information beyond what Stripe handles, precise location data, government identification numbers, or health information.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Why We Collect It</h2>
      <p style={{marginBottom:'12px'}}>We use your information to:</p>
      <ul style={{paddingLeft:'24px',marginBottom:'16px',display:'flex',flexDirection:'column',gap:'8px'}}>
        <li>Provide, maintain, and improve the Hire Power platform</li>
        <li>Deliver AI-powered coaching, resume analysis, interview preparation, and career management features</li>
        <li>Process payments and manage your subscription</li>
        <li>Send transactional emails related to your account (welcome, password reset, billing, important platform updates)</li>
        <li>Respond to support requests</li>
        <li>Detect and prevent fraud, abuse, and security incidents</li>
        <li>Comply with legal obligations</li>
      </ul>
      <p style={{marginBottom:'32px'}}>We do not use your data to train AI models, sell it to third parties, or share it for advertising purposes.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Who We Share It With</h2>
      <p style={{marginBottom:'12px'}}>We use the following third-party services to operate the platform. Each has its own privacy and security practices, and each has signed a data processing agreement with us.</p>
      <ul style={{paddingLeft:'24px',marginBottom:'16px',display:'flex',flexDirection:'column',gap:'8px'}}>
        <li><strong>Supabase</strong> — database, authentication, file storage</li>
        <li><strong>Anthropic (Claude API)</strong> — AI coaching, resume analysis, conversational features</li>
        <li><strong>OpenAI</strong> — speech-to-text and text-to-speech for voice interview practice</li>
        <li><strong>Stripe</strong> — payment processing and subscription management</li>
        <li><strong>Vercel</strong> — hosting and infrastructure</li>
        <li><strong>Loops</strong> — transactional and product email delivery</li>
        <li><strong>PostHog</strong> — product analytics and usage tracking</li>
      </ul>
      <p style={{marginBottom:'32px'}}>We do not sell or rent your personal information to anyone. We may disclose information if required by law, valid legal process, or to protect the safety, rights, or property of Hire Power, our users, or the public.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>How Long We Keep It</h2>
      <p style={{marginBottom:'12px'}}><strong>Account and resume data.</strong> Retained for as long as your account is active. When you delete your account, your personal data is deleted immediately, with no waiting period or grace window. The only exception is records we are legally required to retain (for example, payment records required under tax law), which are kept only for the period the law requires.</p>
      <p style={{marginBottom:'12px'}}><strong>Coaching conversations and AI-generated content.</strong> Retained alongside your account data. Deleted immediately when you delete your account.</p>
      <p style={{marginBottom:'12px'}}><strong>Career Vault data.</strong> Achievements, performance review notes, and stored job descriptions are retained as long as you maintain any active subscription. This data is the foundation of the lifetime value Vault provides, and is preserved across subscription changes.</p>
      <p style={{marginBottom:'12px'}}><strong>Voice recordings.</strong> Retention depends on the voice mode you select. See Voice and Biometric Information below.</p>
      <p style={{marginBottom:'12px'}}><strong>Usage and analytics data.</strong> Retained in aggregate for product improvement purposes. Individual-level data is deleted when you delete your account.</p>
      <p style={{marginBottom:'32px'}}><strong>Communications with support.</strong> Retained for two years from the date of last contact.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Voice and Biometric Information</h2>
      <p style={{marginBottom:'16px'}}>This section applies only if you use voice-based interview practice in Interview Coach. If you do not use voice features, none of this applies to you, and no voice data is ever processed.</p>
      <p style={{marginBottom:'24px'}}>Voice recordings are biometric information and are treated as a sensitive category of data. We process voice carefully, transparently, and only for the purposes described below.</p>

      <h3 style={{fontSize:'18px',fontWeight:700,marginBottom:'12px',marginTop:'24px'}}>The three voice modes</h3>
      <p style={{marginBottom:'12px'}}>Hire Power offers interview practice in three modes. Before any voice mode is used, you will see a clear consent screen describing what happens to your audio, and you must affirmatively opt in. You may decline voice entirely and use text-only mode at any time.</p>
      <p style={{marginBottom:'12px'}}><strong>Mode 1: Voice with recording (opt-in only).</strong> Your microphone captures your spoken responses. Audio is sent to OpenAI for transcription using their gpt-4o-mini-transcribe API. The audio file is stored in our secure storage so you can replay your practice sessions. Audio is also analyzed for delivery metrics (speaking pace, filler word frequency, pause patterns), and the numerical results of that analysis are saved. You can delete any recording at any time from settings.</p>
      <p style={{marginBottom:'12px'}}><strong>Mode 2: Voice without recording (default for Pro users).</strong> Your microphone captures your spoken responses. Audio is transmitted to our transcription provider and processed in memory only, and is analyzed in memory for delivery metrics. Hire Power does not write your audio to persistent storage at any point. Audio is discarded once transcription and delivery analysis are complete. The transcript and the numerical delivery scores are retained as part of your practice session history. No playback is available.</p>
      <p style={{marginBottom:'24px'}}><strong>Mode 3: Text only.</strong> Your microphone is never activated. You type your responses. No voice or biometric data is collected at all. Optionally, the AI may speak interview questions aloud through your device speakers using text-to-speech. This is system-generated audio output, not user audio capture.</p>

      <h3 style={{fontSize:'18px',fontWeight:700,marginBottom:'12px',marginTop:'24px'}}>What we collect when you use voice modes</h3>
      <ul style={{paddingLeft:'24px',marginBottom:'24px',display:'flex',flexDirection:'column',gap:'8px'}}>
        <li>Audio recordings of your spoken responses (Mode 1 only, stored; Mode 2, in-memory only)</li>
        <li>Voice characteristics necessary to perform speech-to-text transcription and delivery analysis, including pace, pause patterns, and filler word frequency</li>
        <li>The transcribed text of what you said (Modes 1 and 2)</li>
        <li>Numerical delivery analysis scores (Modes 1 and 2)</li>
        <li>Your selected voice mode, the time you selected it, the IP address used to confirm consent, and the version of the consent terms you accepted</li>
      </ul>

      <h3 style={{fontSize:'18px',fontWeight:700,marginBottom:'12px',marginTop:'24px'}}>What we do not do with your voice</h3>
      <ul style={{paddingLeft:'24px',marginBottom:'24px',display:'flex',flexDirection:'column',gap:'8px'}}>
        <li>We do not use your voice to identify or authenticate you</li>
        <li>We do not create voiceprints</li>
        <li>We do not use your voice data to train AI models, ours or anyone else&apos;s</li>
        <li>We do not sell, share, or otherwise transfer your voice data for any purpose beyond delivering the Interview Coach service</li>
      </ul>

      <h3 style={{fontSize:'18px',fontWeight:700,marginBottom:'12px',marginTop:'24px'}}>Who we share it with</h3>
      <p style={{marginBottom:'12px'}}>Audio is processed by OpenAI for speech-to-text transcription (Modes 1 and 2) and for text-to-speech generation of interview questions (all modes). Under OpenAI&apos;s standard API terms, audio is not used for training and is retained for up to 30 days for abuse monitoring before being deleted from their systems. We will use OpenAI&apos;s Zero Data Retention configuration where available to eliminate even that retention window.</p>
      <p style={{marginBottom:'12px'}}>Transcripts and coaching content are processed by Anthropic (Claude API) for analysis and feedback generation. Anthropic does not use customer data for training under their standard API terms.</p>
      <p style={{marginBottom:'24px'}}>Both providers operate under data processing agreements with us.</p>

      <h3 style={{fontSize:'18px',fontWeight:700,marginBottom:'12px',marginTop:'24px'}}>How long we keep it</h3>
      <p style={{marginBottom:'12px'}}><strong>Mode 1 audio recordings:</strong> until you delete them or your account.</p>
      <p style={{marginBottom:'12px'}}><strong>Mode 2 audio:</strong> not stored.</p>
      <p style={{marginBottom:'12px'}}><strong>Transcripts and delivery scores (Modes 1 and 2):</strong> until you delete them or your account.</p>
      <p style={{marginBottom:'12px'}}><strong>Consent records:</strong> retained as a record of your consent.</p>
      <p style={{marginBottom:'24px'}}>Account deletion is immediate, and all voice-related data is deleted at the same time as the rest of your account data, with no waiting period.</p>

      <h3 style={{fontSize:'18px',fontWeight:700,marginBottom:'12px',marginTop:'24px'}}>Your control</h3>
      <ul style={{paddingLeft:'24px',marginBottom:'24px',display:'flex',flexDirection:'column',gap:'8px'}}>
        <li>You can change your voice mode at any time in account settings</li>
        <li>You can delete individual recordings, entire practice sessions, or all voice data at any time</li>
        <li>You can switch to text-only mode without losing any other account data</li>
        <li>You can withdraw consent for voice processing at any time</li>
      </ul>

      <h3 style={{fontSize:'18px',fontWeight:700,marginBottom:'12px',marginTop:'24px'}}>Your right to decline</h3>
      <p style={{marginBottom:'12px'}}>You are never required to use voice features. All Interview Coach functionality is available in text-only mode. Declining voice does not limit any other part of the Hire Power platform, change your pricing, or affect your account in any way.</p>
      <p style={{marginBottom:'32px'}}>If you live in a jurisdiction with specific biometric privacy laws (for example, Illinois), the consent screen presented before you enable Modes 1 or 2 contains additional disclosures specific to those laws, including explicit information about what is collected, the purpose, the retention period, and your right to decline.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Interview Coach Data</h2>
      <p style={{marginBottom:'12px'}}>In addition to voice processing described above, Interview Coach generates and stores several types of data tied to your account and your job applications.</p>
      <p style={{marginBottom:'12px'}}><strong>Power Analysis.</strong> When you connect a resume to a job description, we generate an analysis of your strengths, transferable skills, and gaps relative to that role. This analysis is stored on the corresponding job card and persists for the life of the job card unless you delete the job card or your account.</p>
      <p style={{marginBottom:'12px'}}><strong>Interview practice sessions.</strong> Questions asked, your answers (as transcripts in voice modes or text in Mode 3), and your performance scores are stored as part of your practice history. This data is tied to job cards and your career data archive, and is retained while your account is active. It is deleted immediately when you delete the related job card or your account.</p>
      <p style={{marginBottom:'12px'}}><strong>Skill mastery and Interview Readiness Score.</strong> We track your practice performance across skills and job cards to generate mastery indicators and a Readiness Score. This is derived data based on your practice sessions, used only to personalize your experience and surface areas to focus on.</p>
      <p style={{marginBottom:'32px'}}><strong>Company research.</strong> Interview Coach generates company research summaries pulled from public web sources. To keep this efficient and cost-effective, research is cached and may be shared across users who interview at the same company. When we generate or refresh company research, no information identifying you personally is sent to web search providers. Cached research is refreshed approximately every 90 days.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Your Rights</h2>
      <p style={{marginBottom:'12px'}}>You have the right to:</p>
      <ul style={{paddingLeft:'24px',marginBottom:'16px',display:'flex',flexDirection:'column',gap:'8px'}}>
        <li><strong>Access</strong> the personal information we hold about you</li>
        <li><strong>Correct</strong> any information that is inaccurate or incomplete</li>
        <li><strong>Delete</strong> your account and personal data</li>
        <li><strong>Export</strong> your resume, achievements, and other career data in a portable format</li>
        <li><strong>Restrict or object</strong> to certain processing of your data</li>
        <li><strong>Withdraw consent</strong> for voice processing at any time without affecting your access to other features</li>
      </ul>
      <p style={{marginBottom:'16px'}}>To exercise any of these rights, visit the privacy controls in your account settings (Profile → Privacy &amp; Data) or email us at <a href="mailto:hired@hirepowerai.com" style={{color:'#9333ea'}}>hired@hirepowerai.com</a>. Account deletion happens immediately when you request it through your account settings. Other requests are typically handled within five business days.</p>
      <p style={{marginBottom:'32px'}}>We will not discriminate against you for exercising any of these rights. Your access to the platform, pricing, and features will not be affected by any privacy choice you make.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Your California Privacy Rights</h2>
      <p style={{marginBottom:'12px'}}>If you are a California resident, the rights described above apply to you, and you also have:</p>
      <ul style={{paddingLeft:'24px',marginBottom:'16px',display:'flex',flexDirection:'column',gap:'8px'}}>
        <li>The right to know what categories of personal information we collect, the sources of that information, the purposes for which we use it, and the categories of third parties with whom we share it (all disclosed in the sections above)</li>
        <li>The right to opt out of the sale or sharing of personal information (we do not sell or share personal information, so this right does not currently affect you)</li>
        <li>The right to limit the use of sensitive personal information</li>
        <li>The right to non-discrimination for exercising your privacy rights</li>
      </ul>
      <p style={{marginBottom:'32px'}}>To exercise any of these rights, use the privacy controls in your account settings or email <a href="mailto:hired@hirepowerai.com" style={{color:'#9333ea'}}>hired@hirepowerai.com</a>. We may need to verify your identity before fulfilling certain requests.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>How We Protect Your Data</h2>
      <p style={{marginBottom:'16px'}}>We use industry-standard security practices, including encryption of data in transit (TLS) and at rest, access controls limiting who on our team can access user data, regular security review of our infrastructure, and signed data processing agreements with every third-party provider that touches your data.</p>
      <p style={{marginBottom:'32px'}}>No system is perfectly secure. If we discover a breach that affects your personal information, we will notify you and applicable authorities within the timeframes required by law.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>International Users and Data Transfers</h2>
      <p style={{marginBottom:'16px'}}>Hire Power is operated from the United States, and our infrastructure providers store data on servers located in the United States. By using the platform, you understand that your data will be processed in the United States.</p>
      <p style={{marginBottom:'32px'}}>If you are located outside the United States, the privacy protections in your jurisdiction may differ from those in the United States. We aim to handle all user data to a single high standard regardless of where you are located.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Cookies and Tracking</h2>
      <p style={{marginBottom:'32px'}}>We use only essential cookies necessary to maintain your login session and remember your preferences. We do not use advertising cookies, cross-site tracking, or third-party trackers for marketing purposes. Our analytics provider (PostHog) is configured for first-party analytics only.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Children&apos;s Privacy</h2>
      <p style={{marginBottom:'16px'}}>Hire Power is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided personal information to Hire Power, contact us at <a href="mailto:hired@hirepowerai.com" style={{color:'#9333ea'}}>hired@hirepowerai.com</a> and we will delete it.</p>
      <p style={{marginBottom:'32px'}}>Users between 13 and 18 may use the platform with the involvement of a parent or guardian where required by local law.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Changes to This Policy</h2>
      <p style={{marginBottom:'16px'}}>We may update this policy from time to time. When we make material changes, we will notify active users by email and post a notice on the platform at least 30 days before the changes take effect. The &quot;Last updated&quot; date at the top of this policy will always reflect the most recent revision.</p>
      <p style={{marginBottom:'32px'}}>If you continue to use Hire Power after a policy update takes effect, you are agreeing to the updated policy. If you do not agree to a change, you may delete your account before the effective date.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Contact</h2>
      <p style={{marginBottom:'8px'}}>Questions, concerns, or requests related to this policy? Reach us at:</p>
      <p style={{marginBottom:'4px'}}><strong>Hire Power AI LLC</strong></p>
      <p style={{marginBottom:'16px'}}><a href="mailto:hired@hirepowerai.com" style={{color:'#9333ea'}}>hired@hirepowerai.com</a></p>
      <p>We aim to respond to all privacy inquiries within five business days.</p>
    </div>
  );
}
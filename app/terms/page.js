'use client';

import { useState, useEffect } from 'react';

export default function TermsOfService() {
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
      <h1 style={{fontFamily:"'DM Sans',sans-serif",fontSize:'40px',fontWeight:900,letterSpacing:'-1.5px',marginBottom:'8px'}}>Terms of Service</h1>
      <p style={{fontSize:'14px',color:'#6b7280',marginBottom:'48px'}}>Last updated: May 2026</p>

      <p style={{fontSize:'16px',marginBottom:'16px'}}>These Terms of Service (&quot;Terms&quot;) govern your use of the Hire Power platform, operated by Hire Power AI LLC (&quot;Hire Power,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By creating an account or using the platform, you agree to these Terms.</p>
      <p style={{fontSize:'16px',marginBottom:'32px'}}>If you do not agree to these Terms, do not use the platform.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Use of the Platform</h2>
      <p style={{marginBottom:'12px'}}>Hire Power provides AI-powered career management tools including resume coaching, cover letter generation, job tracking, interview preparation, performance review support, and a career achievement archive. You may use the platform only for lawful purposes and in accordance with these Terms.</p>
      <p style={{marginBottom:'12px'}}>You agree not to:</p>
      <ul style={{paddingLeft:'24px',marginBottom:'32px',display:'flex',flexDirection:'column',gap:'8px'}}>
        <li>Misuse, abuse, or interfere with the platform&apos;s operation</li>
        <li>Attempt to reverse-engineer, scrape, or extract the platform&apos;s underlying code, prompts, or systems</li>
        <li>Use the platform to generate misleading, fraudulent, or fabricated resume content</li>
        <li>Use the platform to harass, harm, or violate the rights of others</li>
        <li>Use the platform to compete with Hire Power or to build a competing product</li>
        <li>Share your account with others or attempt to access another user&apos;s account</li>
      </ul>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Your Account</h2>
      <p style={{marginBottom:'12px'}}>You are responsible for maintaining the confidentiality of your account credentials. You must be at least 13 years old to create an account. Users between 13 and 18 may use the platform with the involvement of a parent or guardian where required by local law.</p>
      <p style={{marginBottom:'32px'}}>You are responsible for all activity that occurs under your account. If you believe your account has been compromised, contact us immediately at <a href="mailto:hired@hirepowerai.com" style={{color:'#9333ea'}}>hired@hirepowerai.com</a>.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Your Content</h2>
      <p style={{marginBottom:'12px'}}>You retain ownership of the resume content, career history, achievements, and other information you provide to Hire Power. By using the platform, you grant us a limited, non-exclusive license to process, store, and analyze that content for the sole purpose of delivering the service to you.</p>
      <p style={{marginBottom:'32px'}}>You are responsible for ensuring that the information you provide is accurate and truthful. Hire Power coaching is designed to help you articulate and present your real experience. It is not intended to help you fabricate credentials, invent qualifications you do not have, or misrepresent your background to employers. Misuse of the platform to deceive employers is a violation of these Terms and may result in account termination.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Subscriptions and Billing</h2>
      <p style={{marginBottom:'12px'}}>Hire Power offers a free tier and paid subscription plans (Pro and Vault). Paid subscriptions are billed monthly and renew automatically until cancelled.</p>
      <p style={{marginBottom:'12px'}}>You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of your current billing period, and you will retain access to paid features until that date. We do not offer refunds for partial billing periods.</p>
      <p style={{marginBottom:'32px'}}>We reserve the right to change pricing with at least 30 days notice to active subscribers. Existing subscribers will be notified by email before any price change takes effect.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>AI-Generated Content and Career Guidance</h2>
      <p style={{marginBottom:'12px'}}>Hire Power uses artificial intelligence to assist with resume coaching, cover letters, interview preparation, performance review preparation, and other career-related tasks. AI-generated content and coaching feedback are provided for informational and educational purposes.</p>
      <p style={{marginBottom:'12px'}}><strong>Hire Power is not a substitute for licensed legal, financial, accounting, tax, immigration, or human resources advice.</strong> The platform is a career management tool. It does not provide legal counsel, financial planning, tax preparation, employment law guidance, or professional career counseling within the meaning of any licensure framework. If you are facing a legal employment matter, a financial decision tied to compensation or benefits, an immigration question related to employment, or any other matter requiring professional licensure, you should consult a qualified, licensed professional in the relevant field.</p>
      <p style={{marginBottom:'32px'}}>You are responsible for reviewing all AI-generated content before using it, including before submitting it to employers, sharing it with third parties, or relying on it for any decision. We do not guarantee that any resume, cover letter, interview answer, or coaching output will result in employment, a particular salary, a promotion, or any other specific outcome. Career outcomes depend on many factors outside the platform&apos;s control, including the labor market, employer decisions, your individual qualifications, and your own actions.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Disclaimer of Warranties</h2>
      <p style={{marginBottom:'32px'}}>Hire Power is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, non-infringement, or uninterrupted service. We do not warrant that the platform will be error-free, that defects will be corrected, or that any particular outcome will result from your use of the platform.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Limitation of Liability</h2>
      <p style={{marginBottom:'12px'}}>To the fullest extent permitted by law, Hire Power AI LLC, its officers, directors, employees, and contractors shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from or related to your use of the platform, including but not limited to lost wages, lost employment opportunities, missed promotions, failed interviews, or any other career-related outcomes.</p>
      <p style={{marginBottom:'12px'}}>Our total cumulative liability to you for any and all claims arising from or related to these Terms or your use of the platform shall not exceed the amount you paid us in the 12 months preceding the claim, or one hundred U.S. dollars ($100), whichever is greater.</p>
      <p style={{marginBottom:'32px'}}>Some jurisdictions do not allow certain limitations of liability, and the limitations above apply only to the extent permitted by applicable law.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Indemnification</h2>
      <p style={{marginBottom:'32px'}}>You agree to indemnify and hold harmless Hire Power AI LLC and its officers, directors, employees, and contractors from any claims, damages, losses, or expenses (including reasonable attorneys&apos; fees) arising from your violation of these Terms, your misuse of the platform, or your violation of any third-party rights.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Termination</h2>
      <p style={{marginBottom:'16px'}}>We reserve the right to suspend or terminate your account at our discretion if you violate these Terms, misuse the platform, or use it in a manner that harms other users, employers, or the integrity of the service. We will make reasonable efforts to notify you before termination except in cases of serious violations.</p>
      <p style={{marginBottom:'32px'}}>You may delete your account at any time through your account settings. Upon account deletion, your personal data will be handled according to our Privacy Policy.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Changes to These Terms</h2>
      <p style={{marginBottom:'32px'}}>We may update these Terms from time to time. When we make material changes, we will notify active users by email at least 30 days before the changes take effect. Continued use of the platform after the effective date constitutes acceptance of the updated Terms. If you do not agree to a change, you may delete your account before the effective date.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Governing Law and Disputes</h2>
      <p style={{marginBottom:'16px'}}>These Terms are governed by the laws of the State of Florida, without regard to its conflict of law provisions. Any dispute arising from these Terms or your use of the platform shall be resolved in the state or federal courts located in Orange County, Florida, and you consent to the jurisdiction of those courts.</p>
      <p style={{marginBottom:'32px'}}>If any provision of these Terms is found unenforceable, the remaining provisions will continue in full force and effect.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Contact</h2>
      <p style={{marginBottom:'8px'}}>Questions about these Terms? Reach us at:</p>
      <p style={{marginBottom:'4px'}}><strong>Hire Power AI LLC</strong></p>
      <p><a href="mailto:hired@hirepowerai.com" style={{color:'#9333ea'}}>hired@hirepowerai.com</a></p>
    </div>
  );
}
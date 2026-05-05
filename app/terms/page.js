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
      <p style={{fontSize:'14px',color:'#6b7280',marginBottom:'48px'}}>Last updated: April 2026</p>

      <p style={{fontSize:'16px',marginBottom:'32px'}}>These Terms of Service (&quot;Terms&quot;) govern your use of the Hire Power platform, operated by Hire Power LLC (&quot;Hire Power,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By creating an account or using the platform, you agree to these Terms.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Use of the Platform</h2>
      <p style={{marginBottom:'12px'}}>Hire Power provides AI-powered career coaching tools including resume analysis, coaching conversations, and interview preparation. You may use the platform only for lawful purposes and in accordance with these Terms.</p>
      <p style={{marginBottom:'32px'}}>You agree not to misuse the platform, attempt to reverse-engineer it, use it to generate misleading or fraudulent resume content, or interfere with its operation.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Your Account</h2>
      <p style={{marginBottom:'12px'}}>You are responsible for maintaining the confidentiality of your account credentials. You must be at least 13 years old to use Hire Power.</p>
      <p style={{marginBottom:'32px'}}>You are responsible for all activity that occurs under your account. If you believe your account has been compromised, contact us immediately at <a href="mailto:hired@hirepowerai.com" style={{color:'#9333ea'}}>hired@hirepowerai.com</a>.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Your Content</h2>
      <p style={{marginBottom:'12px'}}>You retain ownership of the resume content, career history, and other information you provide. By using the platform, you grant Hire Power a limited license to process and store that content in order to deliver the service.</p>
      <p style={{marginBottom:'32px'}}>You are responsible for ensuring that the information you provide is accurate. Hire Power coaching helps you articulate and present your real experience — it is not intended to help you fabricate credentials or misrepresent your background to employers.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Subscriptions and Billing</h2>
      <p style={{marginBottom:'12px'}}>Hire Power offers a free tier and paid subscription plans (Pro and Vault). Paid subscriptions are billed monthly and renew automatically until cancelled.</p>
      <p style={{marginBottom:'12px'}}>You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of your current billing period. We do not offer refunds for partial billing periods.</p>
      <p style={{marginBottom:'32px'}}>We reserve the right to change pricing with 30 days notice to active subscribers.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>AI-Generated Content</h2>
      <p style={{marginBottom:'32px'}}>Hire Power uses AI to assist with resume coaching and interview preparation. AI-generated suggestions are provided for informational purposes. We do not guarantee that any resume or coaching output will result in employment. You are responsible for reviewing all AI-generated content before using it.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Disclaimer of Warranties</h2>
      <p style={{marginBottom:'32px'}}>Hire Power is provided &quot;as is&quot; without warranties of any kind, express or implied. We do not warrant that the platform will be uninterrupted, error-free, or that any particular outcome (including job placement) will result from use of the platform.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Limitation of Liability</h2>
      <p style={{marginBottom:'32px'}}>To the fullest extent permitted by law, Hire Power LLC shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the platform. Our total liability to you for any claim arising from these Terms or your use of the platform shall not exceed the amount you paid us in the 12 months preceding the claim.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Termination</h2>
      <p style={{marginBottom:'32px'}}>We reserve the right to suspend or terminate your account at our discretion if you violate these Terms or use the platform in a manner that harms other users or the integrity of the service. You may delete your account at any time.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Changes to These Terms</h2>
      <p style={{marginBottom:'32px'}}>We may update these Terms from time to time. Continued use of the platform after changes are posted constitutes acceptance of the updated Terms. We will notify you of material changes by email.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Governing Law</h2>
      <p style={{marginBottom:'32px'}}>These Terms are governed by the laws of the State of Florida, without regard to its conflict of law provisions.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Contact</h2>
      <p style={{marginBottom:'8px'}}>Questions about these Terms? Reach us at:</p>
      <p style={{marginBottom:'4px'}}><strong>Hire Power LLC</strong></p>
      <p><a href="mailto:hired@hirepowerai.com" style={{color:'#9333ea'}}>hired@hirepowerai.com</a></p>
    </div>
  );
}

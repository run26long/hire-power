export default function PrivacyPolicy() {
  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",maxWidth:'760px',margin:'0 auto',padding:'80px 32px',color:'#1a1a1a',lineHeight:1.7}}>
      <div style={{marginBottom:'48px'}}>
        <a href="/landing" style={{fontSize:'14px',color:'#9333ea',textDecoration:'none',fontWeight:600}}>← Hire Power</a>
      </div>
      <h1 style={{fontFamily:"'DM Sans',sans-serif",fontSize:'40px',fontWeight:900,letterSpacing:'-1.5px',marginBottom:'8px'}}>Privacy Policy</h1>
      <p style={{fontSize:'14px',color:'#6b7280',marginBottom:'48px'}}>Last updated: April 2026</p>

      <p style={{fontSize:'16px',marginBottom:'32px'}}>Hire Power LLC (&quot;Hire Power,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This policy explains what information we collect, how we use it, and your rights regarding that information.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Information We Collect</h2>
      <p style={{marginBottom:'12px'}}><strong>Account information.</strong> When you create an account, we collect your email address and a hashed password.</p>
      <p style={{marginBottom:'12px'}}><strong>Resume and career data.</strong> We store the resume content, career history, coaching conversations, and job-related information you provide during your use of the platform.</p>
      <p style={{marginBottom:'12px'}}><strong>Payment information.</strong> Payments are processed by Stripe. We do not store your credit card number or payment details. We receive confirmation of your subscription status from Stripe.</p>
      <p style={{marginBottom:'32px'}}><strong>Usage data.</strong> We may collect information about how you interact with the platform, including features used and session activity, to improve the product.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>How We Use Your Information</h2>
      <p style={{marginBottom:'12px'}}>We use your information to:</p>
      <ul style={{paddingLeft:'24px',marginBottom:'32px',display:'flex',flexDirection:'column',gap:'8px'}}>
        <li>Provide, maintain, and improve the Hire Power platform</li>
        <li>Deliver AI-powered coaching and resume feedback</li>
        <li>Process payments and manage your subscription</li>
        <li>Send transactional emails related to your account</li>
        <li>Respond to your support requests</li>
      </ul>
      <p style={{marginBottom:'32px'}}>We do not sell your personal information to third parties.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Third-Party Services</h2>
      <p style={{marginBottom:'12px'}}>We use the following third-party services to operate the platform:</p>
      <ul style={{paddingLeft:'24px',marginBottom:'32px',display:'flex',flexDirection:'column',gap:'8px'}}>
        <li><strong>Supabase</strong> — database and authentication</li>
        <li><strong>Anthropic (Claude API)</strong> — AI coaching and resume analysis</li>
        <li><strong>Stripe</strong> — payment processing</li>
        <li><strong>Vercel</strong> — hosting and infrastructure</li>
      </ul>
      <p style={{marginBottom:'32px'}}>Each of these providers has their own privacy policy governing how they handle data.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Data Retention</h2>
      <p style={{marginBottom:'32px'}}>We retain your account and resume data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days, except where we are required to retain it for legal or financial record-keeping purposes.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Your Rights</h2>
      <p style={{marginBottom:'12px'}}>You have the right to:</p>
      <ul style={{paddingLeft:'24px',marginBottom:'32px',display:'flex',flexDirection:'column',gap:'8px'}}>
        <li>Access the personal data we hold about you</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your data</li>
        <li>Export your resume data at any time</li>
      </ul>
      <p style={{marginBottom:'32px'}}>To exercise any of these rights, contact us at <a href="mailto:hired@hirepowerai.com" style={{color:'#9333ea'}}>hired@hirepowerai.com</a>.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Cookies</h2>
      <p style={{marginBottom:'32px'}}>We use essential cookies to maintain your login session. We do not use advertising or tracking cookies.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Children&apos;s Privacy</h2>
      <p style={{marginBottom:'32px'}}>Hire Power is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Changes to This Policy</h2>
      <p style={{marginBottom:'32px'}}>We may update this policy from time to time. We will notify you of significant changes by email or by posting a notice on the platform.</p>

      <h2 style={{fontSize:'22px',fontWeight:700,marginBottom:'12px',marginTop:'40px'}}>Contact</h2>
      <p style={{marginBottom:'8px'}}>Questions about this policy? Reach us at:</p>
      <p style={{marginBottom:'4px'}}><strong>Hire Power LLC</strong></p>
      <p><a href="mailto:hired@hirepowerai.com" style={{color:'#9333ea'}}>hired@hirepowerai.com</a></p>
    </div>
  );
}

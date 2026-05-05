'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .hp-footer { flex-direction: column !important; padding: 20px 24px !important; gap: 8px !important; }
          .hp-footer-logo { display: none !important; }
          .hp-footer-links { gap: 16px !important; }
          .hp-footer-links a { font-size: 14px !important; }
          .hp-footer-copy { font-size: 14px !important; }
          .hp-footer-email-full { display: none !important; }
          .hp-footer-email-short { display: inline !important; }
        }
      `}</style>
      <footer className="hp-footer" style={{
        background: '#1a1033',
        padding: '24px 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Logo */}
        <Link href="/landing" className="hp-footer-logo" style={{display:'flex',alignItems:'center',textDecoration:'none',flexShrink:0,opacity:0.35}}>
          <img src="/images/HirePower_logo_single_color.PNG" alt="Hire Power" style={{height:'28px',width:'auto'}} />
        </Link>

        {/* Legal links */}
        <div className="hp-footer-links" style={{display:'flex',gap:'24px',alignItems:'center',flexWrap:'wrap',justifyContent:'center'}}>
          <Link href="/privacy" style={{fontSize:'12px',color:'rgba(255,255,255,0.3)',textDecoration:'none'}}>
            Privacy Policy
          </Link>
          <Link href="/terms" style={{fontSize:'12px',color:'rgba(255,255,255,0.3)',textDecoration:'none'}}>
            Terms of Service
          </Link>
          <a href="mailto:hired@hirepowerai.com" style={{fontSize:'12px',color:'rgba(255,255,255,0.3)',textDecoration:'none'}}>
            <span className="hp-footer-email-full">hired@hirepowerai.com</span>
            <span className="hp-footer-email-short" style={{display:'none'}}>Contact</span>
          </a>
        </div>

        {/* Copyright */}
        <p className="hp-footer-copy" style={{fontSize:'12px',color:'rgba(255,255,255,0.18)',margin:0,flexShrink:0}}>
          © {new Date().getFullYear()} Hire Power LLC
        </p>
      </footer>
    </>
  );
}

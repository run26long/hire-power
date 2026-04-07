'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{
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
      <Link href="/landing" style={{display:'flex',alignItems:'center',textDecoration:'none',flexShrink:0,opacity:0.35}}>
        <img src="/images/HirePower_logo_single_color.PNG" alt="Hire Power" style={{height:'28px',width:'auto'}} />
      </Link>

      {/* Legal links */}
      <div style={{display:'flex',gap:'24px',alignItems:'center',flexWrap:'wrap',justifyContent:'center'}}>
        <Link href="/privacy" style={{fontSize:'12px',color:'rgba(255,255,255,0.3)',textDecoration:'none'}}>
          Privacy Policy
        </Link>
        <Link href="/terms" style={{fontSize:'12px',color:'rgba(255,255,255,0.3)',textDecoration:'none'}}>
          Terms of Service
        </Link>
        <a href="mailto:hired@hirepowerai.com" style={{fontSize:'12px',color:'rgba(255,255,255,0.3)',textDecoration:'none'}}>
          hired@hirepowerai.com
        </a>
      </div>

      {/* Copyright */}
      <p style={{fontSize:'12px',color:'rgba(255,255,255,0.18)',margin:0,flexShrink:0}}>
        © {new Date().getFullYear()} Hire Power LLC
      </p>
    </footer>
  );
}

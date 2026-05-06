export const metadata = {
  title: 'brb · best resume builder',
  icons: {
    icon: [
      {
        url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%23667eea"/><stop offset="100%" style="stop-color:%23764ba2"/></linearGradient></defs><rect width="64" height="64" rx="12" fill="url(%23g)"/><text x="32" y="48" font-family="Georgia,serif" font-size="48" font-weight="700" fill="white" text-anchor="middle" letter-spacing="-2">b</text></svg>',
        type: 'image/svg+xml',
      },
    ],
  },
}

export default function BrbLandingLayout({ children }) {
  return <>{children}</>
}
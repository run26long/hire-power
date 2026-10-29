/** @type {import('next').NextConfig} */
const nextConfig = {
  // Loaded by Node at runtime, never put through the bundler.
  //
  // @napi-rs/canvas is the canvas pdfjs draws a PDF's first page onto, and it
  // is a native .node binary chosen at require time from eleven per-platform
  // packages. A bundler cannot follow that and cannot inline the result, so
  // bundling it produces a build that fails on the first PDF thumbnail rather
  // than at build time. sharp is already external by default; this is the same
  // arrangement for the same reason.
  serverExternalPackages: ['@napi-rs/canvas'],

  // Read from disk at render time, so they have to be in the function.
  //
  // /api/career-profile/og/[slug] draws a profile's share card with Satori,
  // which needs real font data rather than a family name. The two Lato files
  // are already in public/, which gets deployed as static assets - that is not
  // the same thing as being inside the serverless function, and a card that
  // cannot find its font falls back to the generic one without saying why.
  // Named here so the trace carries them.
  //
  // The key is a glob and `[slug]` would be read as a character class, so the
  // directory is matched instead of the route.
  outputFileTracingIncludes: {
    '/api/career-profile/og/**': ['./public/fonts/Lato-Bold.ttf', './public/fonts/Lato-Regular.ttf']
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ieunegyjhgxxhtzppvza.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
 async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/',
          has: [{ type: 'host', value: 'brbresume.com' }],
          destination: '/brb-landing',
        },
        {
          source: '/',
          has: [{ type: 'host', value: 'www.brbresume.com' }],
          destination: '/brb-landing',
        },
      ],
    }
  },
}

export default nextConfig
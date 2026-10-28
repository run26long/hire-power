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
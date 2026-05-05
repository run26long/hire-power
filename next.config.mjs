/** @type {import('next').NextConfig} */
const nextConfig = {
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
          source: '/:path*',
          has: [{ type: 'host', value: 'brbresume.com' }],
          destination: '/brb-landing/:path*',
        },
        {
          source: '/:path*',
          has: [{ type: 'host', value: 'www.brbresume.com' }],
          destination: '/brb-landing/:path*',
        },
      ],
    }
  },
}

export default nextConfig
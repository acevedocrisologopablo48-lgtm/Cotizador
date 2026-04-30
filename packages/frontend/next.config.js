/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use static export for production builds (Firebase Hosting)
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' } : {}),
  transpilePackages: ['@fym/shared'],
  images: {
    unoptimized: true,
  },
  // Rewrite requests to /api/v1 to the local backend during development
  async rewrites() {
    if (process.env.NODE_ENV !== 'production') {
      return [
        {
          source: '/api/v1/:path*',
          destination: 'http://localhost:3001/api/v1/:path*',
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;

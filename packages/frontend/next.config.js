const isProduction = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use static export for production builds (Firebase Hosting)
  ...(isProduction ? { output: 'export' } : {}),
  transpilePackages: ['@fym/shared'],
  images: {
    unoptimized: true,
  },
  ...(!isProduction
    ? {
        // Rewrite requests to /api/v1 to the local backend during development.
        async rewrites() {
          return [
            {
              source: '/api/v1/:path*',
              destination: 'http://localhost:3001/api/v1/:path*',
            },
          ];
        },
      }
    : {}),
};

module.exports = nextConfig;

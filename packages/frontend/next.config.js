/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use static export for production builds (Firebase Hosting)
  ...(process.env.NODE_ENV === 'production' ? { output: 'export' } : {}),
  transpilePackages: ['@fym/shared'],
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;

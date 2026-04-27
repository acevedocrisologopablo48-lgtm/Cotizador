/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use static export only when explicitly requested (e.g. Firebase Hosting via CI)
  // Vercel handles Next.js natively — no static export needed there.
  ...(process.env.NEXT_STATIC_EXPORT === 'true' ? { output: 'export' } : {}),
  transpilePackages: ['@fym/shared'],
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;

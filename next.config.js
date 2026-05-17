/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@anthropic-ai/sdk'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  // Forces Next.js's SWC compiler to fully transpile Firebase packages.
  // Firebase v10 uses ES private class fields (#field) which break webpack's
  // eval()-based dev source maps. transpilePackages makes SWC pre-process
  // these modules so the output is compatible with webpack's runtime.
  transpilePackages: [
    'firebase',
    '@firebase/app',
    '@firebase/auth',
    '@firebase/firestore',
    '@firebase/storage',
    '@firebase/analytics',
    '@firebase/functions',
    '@firebase/database',
    '@firebase/util',
    '@firebase/logger',
    '@firebase/component',
  ],
};

module.exports = nextConfig;

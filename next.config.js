/** @type {import('next').NextConfig} */
// Note: Vercel Authentication (Deployment Protection) is disabled for this project.
const nextConfig = {
  serverExternalPackages: ['@anthropic-ai/sdk'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            // 'unsafe-inline' required for Next.js inline styles/scripts.
            // Tighten to nonces in a future pass once CSP reporting is wired up.
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.googleapis.com https://*.anthropic.com https://*.firebaseio.com https://*.firebase.google.com wss://*.firebaseio.com https://discord.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
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

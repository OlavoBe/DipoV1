/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15+ usa serverExternalPackages (renomeado de experimental.serverComponentsExternalPackages)
  serverExternalPackages: ['playwright', 'playwright-core', '@sparticuz/chromium', '@prisma/client', 'prisma'],

  // Define o root do Turbopack para evitar aviso de workspace
  turbopack: {
    root: __dirname,
  },
};

module.exports = nextConfig;

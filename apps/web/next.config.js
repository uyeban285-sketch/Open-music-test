/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@open-music/shared', '@open-music/ui'],
};

module.exports = nextConfig;

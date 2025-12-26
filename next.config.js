/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    // Dòng này sẽ xóa toàn bộ console.log khi lên host
    removeConsole: process.env.NODE_ENV === "production",
  },
  reactStrictMode: true,
  images: {
    // Allow loading images from local Supabase storage during development
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;

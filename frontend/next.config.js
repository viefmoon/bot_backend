/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  server: {
    host: "127.0.0.1", // Forzar IPv4
    port: 3000,
  },
};

module.exports = nextConfig;

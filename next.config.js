module.exports = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "/../src/backend/src/pages/api/:path*",
      },
    ];
  },
};

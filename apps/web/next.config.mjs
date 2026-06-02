/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: false },

  // Single-origin proxy so a tunnel (ngrok / Cloudflare) or any reverse proxy
  // only needs ONE URL to share with the client. Without this, the browser
  // would need to reach both port 3000 (web) and 4000 (API) over the public
  // internet, which means two tunnel URLs and CORS pain.
  //
  // Enable by setting NEXT_PUBLIC_API_BASE_URL='' in the web env. The browser
  // then calls relative paths like /api/v1/... — Next.js receives those and
  // forwards them to the API on localhost:4000.
  //
  // Socket.IO traffic uses the same path through the rewrite — both the
  // initial polling handshake and (with newer Next.js) the WebSocket
  // upgrade pass through.
  async rewrites() {
    const apiTarget = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
    return [
      { source: '/api/:path*', destination: `${apiTarget}/api/:path*` },
      { source: '/socket.io/:path*', destination: `${apiTarget}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;

// API base URL. Two modes:
//
//   Direct mode (local dev):
//     NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
//     → fetch calls go directly to the API server.
//
//   Same-origin mode (tunnel / production):
//     NEXT_PUBLIC_API_BASE_URL='' (empty string)
//     → fetch calls become relative paths and go through Next.js,
//       which proxies them to the API via the rewrite in next.config.mjs.
//       This lets a single ngrok / Cloudflare / Vercel URL serve everything.
//
// Defaults to direct mode for backwards-compat with local .env files that
// don't set the variable.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : 'http://localhost:4000';

// WebSocket URL. In same-origin mode, leave NEXT_PUBLIC_WS_URL unset and the
// socket.io client connects to the page's origin (which is then proxied by
// Next.js to the API's socket.io path).
export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL !== undefined
    ? process.env.NEXT_PUBLIC_WS_URL
    : 'ws://localhost:4000';

export const API_PREFIX = '/api/v1';

export const apiUrl = (path: string) => `${API_BASE_URL}${API_PREFIX}${path}`;

import { io, Socket } from 'socket.io-client';
import { WS_URL } from './env';

let socket: Socket | null = null;

// Socket.IO client. In direct mode, connects to ws://localhost:4000.
// In same-origin mode (NEXT_PUBLIC_WS_URL=''), io() with no URL uses the
// page's origin — perfect for tunneling, since the Next.js rewrite at
// /socket.io forwards the upgrade to the API.
//
// transports include 'polling' as a fallback. Some tunnels don't pass the
// WebSocket upgrade handshake cleanly; polling works everywhere.
export function getSocket(): Socket {
  if (!socket) {
    const opts = {
      transports: ['websocket', 'polling'],
      path: '/socket.io',
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    };
    socket = WS_URL ? io(WS_URL, opts) : io(opts);
  }
  return socket;
}

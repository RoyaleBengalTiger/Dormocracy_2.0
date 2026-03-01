import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/auth";

/**
 * Minimal Socket.IO singleton factory.
 *
 * - Connects only if an access token exists.
 * - Provides token via handshake auth: { token }.
 * - Auto-reconnect is enabled by default in socket.io-client.
 */
let socketSingleton: Socket | null = null;

export function getSocket(): Socket | null {
  const token = getAccessToken();
  if (!token) return null;

  if (socketSingleton) return socketSingleton;

  const baseUrl = (import.meta.env.VITE_WS_BASE_URL || import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (!baseUrl) return null;

  socketSingleton = io(baseUrl, {
    transports: ["websocket"],
    autoConnect: false,
    auth: { token },
  });

  return socketSingleton;
}

export function resetSocketSingleton() {
  if (socketSingleton) {
    socketSingleton.disconnect();
    socketSingleton = null;
  }
}

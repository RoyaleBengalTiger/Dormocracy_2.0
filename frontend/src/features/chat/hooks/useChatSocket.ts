import { useEffect, useMemo, useState } from "react";
import { getSocket } from "@/lib/socket";
import type { ConnectionStatus, Message } from "../types";

type UseChatSocketOpts = {
  enabled: boolean;
  onMessage: (message: Message) => void;
};

export function useChatSocket({ enabled, onMessage }: UseChatSocketOpts) {
  const socket = useMemo(() => (enabled ? getSocket() : null), [enabled]);
  const [status, setStatus] = useState<ConnectionStatus>("offline");
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) {
      setStatus("offline");
      return;
    }

    const onConnect = () => {
      setStatus("live");
      setLastEvent("connect");
    };
    const onDisconnect = () => {
      setStatus("offline");
      setLastEvent("disconnect");
    };
    const onReconnectAttempt = () => {
      // Only show reconnecting when we are actually disconnected.
      if (!socket.connected) {
        setStatus("reconnecting");
      }
      setLastEvent("reconnect_attempt");
    };
    const onReconnect = () => {
      setStatus("live");
      setLastEvent("reconnect");
    };
    const onReconnectFailed = () => {
      if (!socket.connected) setStatus("offline");
      setLastEvent("reconnect_failed");
    };
    const onConnectError = (err: any) => {
      setStatus("offline");
      setLastEvent(`connect_error: ${String(err?.message ?? err)}`);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect", onReconnect);
    socket.io.on("reconnect_failed", onReconnectFailed);
    socket.io.on("error", onConnectError);
    socket.io.on("reconnect_error", onConnectError);
    socket.on("connect_error", onConnectError);

    socket.on("room:new_message", (m: Message) => {
      setLastEvent("room:new_message");
      onMessage(m);
    });

    if (!socket.connected) {
      setStatus("reconnecting");
      socket.connect();
    } else {
      // If we're already connected when the hook mounts (e.g. fast navigation), reflect it.
      setStatus("live");
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("room:new_message");
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect", onReconnect);
      socket.io.off("reconnect_failed", onReconnectFailed);
      socket.io.off("error", onConnectError);
      socket.io.off("reconnect_error", onConnectError);
    };
  }, [socket, onMessage]);

  return { status, lastEvent, socket };
}

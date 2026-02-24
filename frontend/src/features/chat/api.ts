import { httpClient } from "@/lib/http";
import { getSocket } from "@/lib/socket";
import type { Message, MessagesResponse, RoomChatResponse, SendResponse } from "./types";

export const chatApi = {
  getRoomChat: () => httpClient.get<RoomChatResponse>("/chat/room"),

  getRoomMessages: (params: { limit: number; cursor?: string | null }) => {
    const q = new URLSearchParams({ limit: String(params.limit) });
    if (params.cursor) q.set("cursor", params.cursor);
    return httpClient.get<MessagesResponse>(`/chat/room/messages?${q.toString()}`);
  },

  sendRoomMessageRest: (content: string) =>
    httpClient.post<SendResponse>("/chat/room/messages", { content }),

  /** Emits via Socket.IO when connected. */
  emitRoomMessage: (content: string): boolean => {
    const socket = getSocket();
    if (!socket || !socket.connected) return false;
    socket.emit("room:message", { content });
    return true;
  },

  onRoomNewMessage: (handler: (message: Message) => void) => {
    const socket = getSocket();
    if (!socket) return () => {};
    socket.on("room:new_message", handler);
    return () => socket.off("room:new_message", handler);
  },
};

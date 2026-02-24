export type RoomChatResponse = { id: string; type: "ROOM"; roomId: string };

export type Sender = { id: string; username: string; role: string };

export type Message = {
  id: string;
  content: string;
  createdAt: string;
  sender: Sender;
};

export type MessagesResponse = {
  chatRoomId: string;
  items: Message[]; // newest-first
  nextCursor: string | null;
};

export type SendResponse = { chatRoomId: string; message: Message };

export type ConnectionStatus = "live" | "reconnecting" | "offline";

export type UiMessage = Message & {
  /** local-only fields for optimistic UI */
  clientTempId?: string;
  sendState?: "sending" | "failed";
};

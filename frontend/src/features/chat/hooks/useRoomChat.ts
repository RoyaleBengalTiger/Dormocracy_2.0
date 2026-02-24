import { useQuery } from "@tanstack/react-query";
import { chatApi } from "../api";

export function useRoomChat() {
  return useQuery({
    queryKey: ["chat", "room"],
    queryFn: chatApi.getRoomChat,
  });
}

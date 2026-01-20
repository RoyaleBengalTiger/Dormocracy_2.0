import { httpClient } from "@/lib/http";

export type RoomListItem = {
  id: string;
  roomNumber: string;
  department: { id: string; name: string };
  mayor?: { id: string; username: string; email: string } | null;
  users: Array<{ id: string; username: string; email: string; role: string }>;
};

export const roomsAdminApi = {
  listRooms: () => httpClient.get<RoomListItem[]>("/rooms"),
  assignMayor: (roomId: string, userId: string) =>
    httpClient.patch<void>(`/rooms/${roomId}/mayor`, { userId }),
};

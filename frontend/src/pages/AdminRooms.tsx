import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Building2, Crown, Search, ShieldAlert } from "lucide-react";

import { roomsAdminApi, type RoomListItem } from "@/api/rooms";
import { AssignMayorModal } from "@/components/modals/AssignMayorModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

export default function AdminRooms() {
  const [search, setSearch] = useState("");
  const [noMayorOnly, setNoMayorOnly] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomListItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const {
    data: rooms = [],
    isLoading,
    refetch,
    error,
  } = useQuery({
    queryKey: ["admin", "rooms"],
    queryFn: roomsAdminApi.listRooms,
  });

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms
      .filter((r) => {
        const matchesSearch = !q
          ? true
          : r.roomNumber.toLowerCase().includes(q) || r.department?.name?.toLowerCase().includes(q);
        const matchesNoMayor = noMayorOnly ? !r.mayor : true;
        return matchesSearch && matchesNoMayor;
      })
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber));
  }, [rooms, search, noMayorOnly]);

  const openAssign = (room: RoomListItem) => {
    setSelectedRoom(room);
    setModalOpen(true);
  };

  const handleSuccess = async () => {
    await refetch();
  };

  const errorMessage = error instanceof Error ? error.message : "";
  const noPermission = /forbidden|403/i.test(errorMessage);

  return (
    <div className="min-h-screen p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-6xl space-y-6"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Assign Mayors</h1>
            <p className="text-muted-foreground">Admin-only: assign or change a room’s mayor.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              toast({ title: "Refreshing", description: "Reloading rooms list..." });
              refetch();
            }}
          >
            Refresh
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by room number or department..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant={noMayorOnly ? "default" : "outline"} onClick={() => setNoMayorOnly((v) => !v)}>
            <ShieldAlert className="mr-2 h-4 w-4" />
            No Mayor
          </Button>
        </div>

        {noPermission ? (
          <Card className="glass-card">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No permission — ADMIN role required.</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-12 text-center text-muted-foreground">No rooms found</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredRooms.map((room) => {
              const mayorName = room.mayor?.username ?? "None";
              return (
                <Card key={room.id} className="glass-card hover-lift">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3">
                      <span className="truncate">Room {room.roomNumber}</span>
                      <Building2 className="h-5 w-5 text-primary" />
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{room.department?.name}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Crown className="h-4 w-4" />
                        Current Mayor
                      </span>
                      <span className="text-sm font-medium">{mayorName}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Residents</span>
                      <span className="text-sm font-medium">{room.users?.length ?? 0}</span>
                    </div>

                    <Button className="w-full" onClick={() => openAssign(room)}>
                      Assign / Change Mayor
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <AssignMayorModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          room={selectedRoom}
          onSuccess={handleSuccess}
        />
      </motion.div>
    </div>
  );
}

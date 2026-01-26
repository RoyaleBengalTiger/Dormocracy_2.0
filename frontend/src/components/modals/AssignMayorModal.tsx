import { useEffect, useMemo, useState } from "react";

import { roomsAdminApi, type RoomListItem } from "@/api/rooms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: RoomListItem | null;
  onSuccess: () => void;
};

export function AssignMayorModal({ open, onOpenChange, room, onSuccess }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // default: blank, and avoid preselecting current mayor to reduce accidental resubmits
    setSelectedUserId("");
  }, [open, room?.id]);

  const candidates = useMemo(() => {
    const users = room?.users ?? [];
    const currentMayorId = room?.mayor?.id;
    return users.filter((u) => u.id !== currentMayorId);
  }, [room]);

  const handleSubmit = async () => {
    if (!room) return;
    if (!selectedUserId) {
      toast({ title: "Select a candidate", description: "Please choose a room resident to assign as mayor." });
      return;
    }

    try {
      setIsSubmitting(true);
      await roomsAdminApi.assignMayor(room.id, selectedUserId);
      toast({ title: "Mayor updated", description: `Room ${room.roomNumber} mayor assignment saved.` });
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to assign mayor";
      const noPermission = /forbidden|403/i.test(message);
      toast({
        title: noPermission ? "No permission" : "Update failed",
        description: noPermission
          ? "You must be an ADMIN to assign or change a mayor."
          : message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const departmentName = room?.department?.name ?? "";
  const roomNumber = room?.roomNumber ?? "";
  const currentMayor = room?.mayor?.username ?? "None";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign / Change Mayor</DialogTitle>
          <DialogDescription>
            {departmentName && roomNumber
              ? `Department ${departmentName} · Room ${roomNumber}`
              : "Select a room resident to become mayor."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>Current Mayor</Label>
            <p className="text-sm text-muted-foreground">{currentMayor}</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="candidate">Candidate</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="candidate">
                <SelectValue placeholder="Choose a room resident" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.username} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {candidates.length === 0 && (
              <p className="text-sm text-muted-foreground">No eligible residents found for this room.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !room}>
            {isSubmitting ? "Saving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

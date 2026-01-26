import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { tasksApi } from "@/api/tasks";
import type { Task } from "@/types";
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

type Candidate = {
  id: string;
  username: string;
  role: string;
};

const schema = z.object({
  assignedToId: z.string().min(1, "Please select a resident"),
});

type FormData = z.infer<typeof schema>;

type Props = {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  candidates: Candidate[];
};

export function ApproveAssignTaskModal({ task, open, onClose, candidates }: Props) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    setValue,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { assignedToId: "" } });

  useEffect(() => {
    if (!open) return;
    reset({ assignedToId: "" });
  }, [open, reset, task?.id]);

  const eligibleCandidates = useMemo(() => {
    // frontend guard: only room residents
    return candidates ?? [];
  }, [candidates]);

  const approveAssignMutation = useMutation({
    mutationFn: ({ id, assignedToId }: { id: string; assignedToId: string }) =>
      tasksApi.approveAndAssign(id, { assignedToId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Task approved", description: "Task is now active and assigned." });
      onClose();
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : "Failed to approve and assign";
      const noPermission = /forbidden|403/i.test(message);
      toast({
        title: noPermission ? "No permission" : "Update failed",
        description: noPermission ? "You must be a MAYOR to approve tasks." : message,
        variant: noPermission ? undefined : "destructive",
      });
    },
  });

  const selectedId = watch("assignedToId");

  const onSubmit = async (data: FormData) => {
    if (!task) return;
    setIsSubmitting(true);
    try {
      await approveAssignMutation.mutateAsync({ id: task.id, assignedToId: data.assignedToId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve & Assign</DialogTitle>
          <DialogDescription>
            {task ? `Task: ${task.title}` : "Select a task to approve."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="assignedTo">Assign to</Label>
            <Select value={selectedId} onValueChange={(v) => setValue("assignedToId", v, { shouldValidate: true })}>
              <SelectTrigger id="assignedTo">
                <SelectValue placeholder="Choose a room resident" />
              </SelectTrigger>
              <SelectContent>
                {eligibleCandidates.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.username} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {eligibleCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No residents available in this room.</p>
            ) : null}
            {errors.assignedToId ? (
              <p className="text-sm text-destructive">{errors.assignedToId.message}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !task || eligibleCandidates.length === 0}>
              {isSubmitting ? "Saving..." : "Approve"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

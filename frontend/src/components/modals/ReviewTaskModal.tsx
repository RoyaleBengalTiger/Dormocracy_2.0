import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Task } from "@/types";
import { tasksApi } from "@/api/tasks";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  decision: z.enum(["accept", "reject"]),
  note: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type Props = {
  task: Task | null;
  open: boolean;
  onClose: () => void;
};

export function ReviewTaskModal({ task, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    setValue,
    handleSubmit,
    reset,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { decision: "accept", note: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset({ decision: "accept", note: "" });
  }, [open, reset, task?.id]);

  const reviewMutation = useMutation({
    mutationFn: ({ id, accept, note }: { id: string; accept: boolean; note?: string }) =>
      tasksApi.reviewTask(id, { accept, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast({ title: "Review submitted", description: "Task status has been updated." });
      onClose();
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : "Failed to submit review";
      const noPermission = /forbidden|403/i.test(message);
      toast({
        title: noPermission ? "No permission" : "Update failed",
        description: noPermission ? "You must be a MAYOR to review tasks." : message,
        variant: noPermission ? undefined : "destructive",
      });
    },
  });

  const decision = watch("decision");

  const onSubmit = async (data: FormData) => {
    if (!task) return;
    setIsSubmitting(true);
    try {
      await reviewMutation.mutateAsync({
        id: task.id,
        accept: data.decision === "accept",
        note: data.note?.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review Completion</DialogTitle>
          <DialogDescription>
            {task ? `Task: ${task.title}` : "Select a task to review."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {task?.completionSummary ? (
            <div className="space-y-2">
              <Label>Completion Summary</Label>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">{task.completionSummary}</p>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Decision</Label>
            <RadioGroup value={decision} onValueChange={(v) => setValue("decision", v as any)} className="grid gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="accept" id="accept" />
                <Label htmlFor="accept">Accept (mark as completed)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="reject" id="reject" />
                <Label htmlFor="reject">Reject (send back)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Mayor note (optional)</Label>
            <Textarea id="note" rows={4} placeholder="Add a short note..." {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !task}>
              {isSubmitting ? "Submitting..." : "Submit Review"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

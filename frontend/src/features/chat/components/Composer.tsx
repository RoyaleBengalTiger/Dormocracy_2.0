import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message can't be empty")
    .max(2000, "Message too long"),
});

type FormValues = z.infer<typeof schema>;

export function Composer(props: {
  disabled: boolean;
  isSending: boolean;
  onSend: (content: string) => Promise<void>;
}) {
  const { disabled, isSending, onSend } = props;
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { content: "" } });

  const content = watch("content") ?? "";
  const count = content.length;
  const warn = count >= 1800;

  const canSend = useMemo(() => !disabled && !isSending, [disabled, isSending]);

  useEffect(() => {
    // keep textarea from growing beyond 4 lines by clipping via max-height
  }, []);

  return (
    <form
      onSubmit={handleSubmit(async ({ content }) => {
        await onSend(content.trim());
        setValue("content", "");
      })}
      className="border-t bg-background px-4 py-3"
    >
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Textarea
            aria-label="Message"
            placeholder={disabled ? "You’re offline — you can still type…" : "Message your room…"}
            className={cn("max-h-[8.5rem] resize-none", errors.content && "border-destructive")}
            rows={1}
            {...register("content")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) {
                  void handleSubmit(async ({ content }) => {
                    await onSend(content.trim());
                    setValue("content", "");
                  })();
                }
              }
            }}
          />
          <div className="mt-1 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{errors.content?.message ?? ""}</p>
            <p className={cn("text-xs", warn ? "text-primary" : "text-muted-foreground")} aria-label="Character count">
              {count}/2000
            </p>
          </div>
        </div>
        <Button type="submit" disabled={!canSend} aria-label="Send message">
          {isSending ? "Sending…" : <><Send className="h-4 w-4" /> Send</>}
        </Button>
      </div>
    </form>
  );
}

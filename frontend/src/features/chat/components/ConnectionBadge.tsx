import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "../types";

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const label = status === "live" ? "Live" : status === "reconnecting" ? "Reconnecting" : "Offline";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
        status === "live" && "border-border bg-muted",
        status === "reconnecting" && "border-border bg-muted",
        status === "offline" && "border-border bg-muted",
      )}
      aria-label={`Connection status: ${label}`}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "live" && "bg-primary",
          status === "reconnecting" && "bg-secondary",
          status === "offline" && "bg-muted-foreground",
        )}
      />
      {label}
    </span>
  );
}

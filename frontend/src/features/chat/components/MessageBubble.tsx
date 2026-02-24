import { memo } from "react";
import { cn } from "@/lib/utils";
import { RoleBadge } from "@/components/RoleBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import type { UiMessage } from "../types";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export const MessageBubble = memo(function MessageBubble(props: {
  message: UiMessage;
  isMine: boolean;
  showHeader: boolean;
}) {
  const { message, isMine, showHeader } = props;
  return (
    <div className={cn("group flex w-full gap-2", isMine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] md:max-w-[70%]", isMine && "items-end")}> 
        {showHeader && (
          <div className={cn("mb-1 flex items-center gap-2", isMine ? "justify-end" : "justify-start")}>
            <span className="text-xs text-muted-foreground">{isMine ? "You" : message.sender.username}</span>
            {!isMine && <RoleBadge role={message.sender.role} />}
          </div>
        )}

        <div className={cn("flex items-start gap-2", isMine && "flex-row-reverse")}>
          <div
            className={cn(
              "relative rounded-2xl border px-3 py-2 text-sm leading-relaxed",
              isMine ? "bg-primary text-primary-foreground" : "bg-card",
              message.sendState === "failed" && "opacity-80",
            )}
          >
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
            <div
              className={cn(
                "mt-1 flex items-center gap-2 text-[11px] opacity-0 transition-opacity group-hover:opacity-100",
                isMine ? "text-primary-foreground/80" : "text-muted-foreground",
              )}
            >
              <span>{formatTime(message.createdAt)}</span>
              {message.sendState === "sending" && <span>• sending</span>}
              {message.sendState === "failed" && <span>• failed</span>}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100",
                  isMine ? "text-primary-foreground/90" : "text-muted-foreground",
                )}
                aria-label="Message actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isMine ? "end" : "start"}>
              <DropdownMenuItem disabled>Copy (soon)</DropdownMenuItem>
              <DropdownMenuItem disabled>Reply (soon)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
});

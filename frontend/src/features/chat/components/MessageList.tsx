import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { UiMessage } from "../types";
import { MessageBubble } from "./MessageBubble";
import { Skeleton } from "@/components/ui/skeleton";

function dayKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function MessageList(props: {
  messages: UiMessage[];
  myUserId?: string;
  isLoading: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadOlder: () => void;
  isNearBottom: boolean;
  onNearBottomChange: (near: boolean) => void;
  onUserScrollUp: () => void;
  jumpToBottom?: number;
}) {
  const {
    messages,
    myUserId,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    onLoadOlder,
    isNearBottom,
    onNearBottomChange,
    onUserScrollUp,
    jumpToBottom,
  } = props;

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const preserveScrollHeightRef = useRef<number | null>(null);

  const rows = useMemo(() => {
    const out: Array<{ type: "day"; label: string } | { type: "msg"; msg: UiMessage; showHeader: boolean }> = [];
    let lastDay: string | null = null;
    let lastSender: string | null = null;

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const dk = dayKey(m.createdAt);
      if (dk !== lastDay) {
        out.push({ type: "day", label: dk });
        lastDay = dk;
        lastSender = null;
      }
      const showHeader = m.sender?.id !== lastSender;
      out.push({ type: "msg", msg: m, showHeader });
      lastSender = m.sender?.id ?? null;
    }
    return out;
  }, [messages]);

  // Maintain scroll position when older messages are prepended
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (preserveScrollHeightRef.current == null) return;
    const prev = preserveScrollHeightRef.current;
    preserveScrollHeightRef.current = null;
    const next = el.scrollHeight;
    el.scrollTop = next - prev + el.scrollTop;
  }, [messages.length]);

  // Scroll to bottom when jumpToBottom counter changes
  useEffect(() => {
    if (!jumpToBottom) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [jumpToBottom]);

  // Initial scroll to bottom on load
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  useEffect(() => {
    if (!isLoading && messages.length > 0 && !initialScrollDone && scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
      setInitialScrollDone(true);
    }
  }, [isLoading, messages.length, initialScrollDone]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollerRef}
        className="h-full overflow-y-auto px-4 py-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          const nearTop = el.scrollTop < 120;
          const nearBottomNow = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
          if (nearBottomNow !== isNearBottom) onNearBottomChange(nearBottomNow);
          if (!nearBottomNow) onUserScrollUp();
          if (nearTop && hasNextPage && !isFetchingNextPage) {
            preserveScrollHeightRef.current = el.scrollHeight;
            onLoadOlder();
          }
        }}
        aria-label="Room chat messages"
      >
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className={cn("h-10 w-[75%]", i % 2 === 0 ? "ml-auto" : "mr-auto")} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 h-14 w-14 rounded-full bg-muted" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Start the conversation…</p>
          </div>
        ) : (
          <div className="space-y-3">
            {isFetchingNextPage && (
              <div className="py-2 text-center text-xs text-muted-foreground">Loading older messages…</div>
            )}
            {rows.map((r, idx) =>
              r.type === "day" ? (
                <div key={`day-${idx}`} className="flex justify-center py-2">
                  <span className="rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">{r.label}</span>
                </div>
              ) : (
                <MessageBubble
                  key={r.msg.id}
                  message={r.msg}
                  isMine={Boolean(myUserId && r.msg.sender?.id === myUserId)}
                  showHeader={r.showHeader}
                />
              ),
            )}
            <div className="h-2" />
          </div>
        )}
      </div>
    </div>
  );
}

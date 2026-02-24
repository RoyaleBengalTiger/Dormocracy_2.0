import { ReactNode } from "react";
import { ConnectionBadge } from "./ConnectionBadge";
import type { ConnectionStatus } from "../types";

function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function ChatLayout(props: {
  title: string;
  roomLabel?: string;
  status: ConnectionStatus;
  username?: string;
  children: ReactNode;
}) {
  const { title, roomLabel, status, username, children } = props;
  return (
    <div className="flex h-[calc(100vh-0px)] flex-col overflow-hidden">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">{title}</h1>
            {roomLabel && <p className="truncate text-xs text-muted-foreground">{roomLabel}</p>}
          </div>
          <div className="flex items-center gap-3">
            <ConnectionBadge status={status} />
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted text-xs font-medium"
              aria-label="User"
              title={username}
            >
              {initials(username)}
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

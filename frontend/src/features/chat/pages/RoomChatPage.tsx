import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ChatLayout } from "../components/ChatLayout";
import { MessageList } from "../components/MessageList";
import { Composer } from "../components/Composer";
import { NewMessagesPill } from "../components/NewMessagesPill";
import { useRoomChat } from "../hooks/useRoomChat";
import { useChatSocket } from "../hooks/useChatSocket";
import { useMessages, useMessagesCache, flattenMessagesChronological } from "../hooks/useMessages";
import type { UiMessage } from "../types";
import { chatApi } from "../api";
import { getAccessToken } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function RoomChatPage() {
  const token = getAccessToken();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isNearBottom, setIsNearBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isBrowserOffline, setIsBrowserOffline] = useState<boolean>(() => !navigator.onLine);

  const { data: roomChat } = useRoomChat();
  const messagesQuery = useMessages();
  const cache = useMessagesCache();

  const allMessages = useMemo(
    () => flattenMessagesChronological(messagesQuery.data?.pages),
    [messagesQuery.data?.pages],
  );

  const roomLabel = useMemo(() => {
    const dept = user?.room?.department?.name;
    const rn = user?.room?.roomNumber;
    return dept && rn ? `${dept} • Room ${rn}` : dept ? dept : rn ? `Room ${rn}` : undefined;
  }, [user?.room]);

  const onIncoming = useCallback(
    (m: any) => {
      cache.addIncomingMessage(m, user?.id ? { reconcileMine: { senderId: user.id } } : undefined);
      if (!isNearBottom) setUnreadCount((c) => c + 1);
    },
    [cache, isNearBottom, user?.id],
  );

  const { status, lastEvent } = useChatSocket({ enabled: Boolean(token), onMessage: onIncoming });

  useEffect(() => {
    const onOnline = () => setIsBrowserOffline(false);
    const onOffline = () => setIsBrowserOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const jumpToBottomSignal = useRef(0);
  const [jumpToBottom, setJumpToBottom] = useState(0);

  const handleJumpToBottom = () => {
    setUnreadCount(0);
    jumpToBottomSignal.current++;
    setJumpToBottom(jumpToBottomSignal.current);
    setIsNearBottom(true);
  };

  // The jumpToBottom effect is now handled inside MessageList via the prop.
  // No additional effect needed here.

  if (!token) return <Navigate to="/login" replace />;

  // UX requirement: disable sending only when the *browser* is offline (but allow typing).
  // Socket may be offline while REST still works.
  const offline = isBrowserOffline;

  const sendMessage = async (content: string) => {
    const tempId = `optimistic-${Date.now()}`;
    const optimistic: UiMessage = {
      id: tempId,
      clientTempId: tempId,
      content,
      createdAt: new Date().toISOString(),
      sender: { id: user?.id ?? "me", username: user?.username ?? "You", role: user?.role ?? "CITIZEN" },
      sendState: "sending",
    };

    cache.addOptimisticMessage(optimistic);
    setTimeout(() => setJumpToBottom((n) => n + 1), 0);

    setIsSending(true);
    try {
      const sentViaSocket = chatApi.emitRoomMessage(content);
      if (!sentViaSocket) {
        const res = await chatApi.sendRoomMessageRest(content);
        cache.replaceOptimistic(tempId, res.message);
      } else {
        // Wait for server broadcast/echo to reconcile; if none arrives, we keep optimistic as-is.
      }
    } catch (e) {
      cache.markOptimisticFailed(tempId);
      toast({
        title: "Message failed",
        description: e instanceof Error ? e.message : "Could not send",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ChatLayout
      title="Room Chat"
      roomLabel={roomLabel}
      status={status}
      username={user?.username}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <NewMessagesPill count={unreadCount} onClick={handleJumpToBottom} />

        <MessageList
          messages={allMessages}
          myUserId={user?.id}
          isLoading={messagesQuery.isLoading}
          hasNextPage={messagesQuery.hasNextPage}
          isFetchingNextPage={messagesQuery.isFetchingNextPage}
          onLoadOlder={() => messagesQuery.fetchNextPage()}
          isNearBottom={isNearBottom}
          onNearBottomChange={(v) => {
            setIsNearBottom(v);
            if (v) setUnreadCount(0);
          }}
          onUserScrollUp={() => {
            // no-op placeholder; keeps unread pill behavior consistent
          }}
          jumpToBottom={jumpToBottom}
        />

        <Composer disabled={offline} isSending={isSending} onSend={sendMessage} />
      </div>

      {/* Dev hint (debug page exists) */}
      {roomChat?.id && lastEvent && (
        <div className="sr-only" aria-hidden="true">
          {roomChat.id} {lastEvent}
        </div>
      )}
    </ChatLayout>
  );
}

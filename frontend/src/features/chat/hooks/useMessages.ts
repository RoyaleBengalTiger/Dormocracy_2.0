import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import type { Message, MessagesResponse, UiMessage } from "../types";
import { chatApi } from "../api";

const PAGE_SIZE = 30;

export function useMessages() {
  return useInfiniteQuery<MessagesResponse>({
    queryKey: ["chat", "room", "messages"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      chatApi.getRoomMessages({ limit: PAGE_SIZE, cursor: (pageParam as string | null) ?? null }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 10_000,
  });
}

/**
 * Converts infinite-query pages (newest-first per page) into a single list (oldest-first).
 */
export function flattenMessagesChronological(pages?: MessagesResponse[]): UiMessage[] {
  if (!pages?.length) return [];
  const chronological: UiMessage[] = [];

  // pages are [newestPage, olderPage, ...]
  for (let p = pages.length - 1; p >= 0; p--) {
    const items = pages[p].items;
    // each page is newest-first; reverse to oldest-first
    for (let i = items.length - 1; i >= 0; i--) {
      chronological.push(items[i]);
    }
  }
  return chronological;
}

export function useMessagesCache() {
  const queryClient = useQueryClient();

  const addIncomingMessage = (message: Message, opts?: { reconcileMine?: { senderId: string } }) => {
    queryClient.setQueryData<any>(["chat", "room", "messages"], (old) => {
      if (!old?.pages?.length) {
        return {
          pageParams: [null],
          pages: [{ chatRoomId: "", items: [message], nextCursor: null } satisfies MessagesResponse],
        };
      }

      const pages: MessagesResponse[] = old.pages;
      const first = pages[0];
      const updatedFirst: MessagesResponse = {
        ...first,
        items: [message, ...first.items],
      };

      // Optional reconciliation: replace a "sending" optimistic message when the server echoes it
      if (opts?.reconcileMine) {
        const { senderId } = opts.reconcileMine;
        const optimisticIndex = updatedFirst.items.findIndex(
          (m: UiMessage) =>
            (m as UiMessage).sendState === "sending" &&
            m.sender?.id === senderId &&
            m.content === message.content,
        );
        if (optimisticIndex >= 0) {
          updatedFirst.items = updatedFirst.items.map((m: UiMessage, idx: number) =>
            idx === optimisticIndex ? message : m,
          );
        }
      }

      return { ...old, pages: [updatedFirst, ...pages.slice(1)] };
    });
  };

  const addOptimisticMessage = (optimistic: UiMessage) => {
    queryClient.setQueryData<any>(["chat", "room", "messages"], (old) => {
      if (!old?.pages?.length) {
        return {
          pageParams: [null],
          pages: [{ chatRoomId: "", items: [optimistic], nextCursor: null } satisfies MessagesResponse],
        };
      }
      const pages: MessagesResponse[] = old.pages;
      const first = pages[0];
      const updatedFirst: MessagesResponse = { ...first, items: [optimistic, ...first.items] };
      return { ...old, pages: [updatedFirst, ...pages.slice(1)] };
    });
  };

  const markOptimisticFailed = (clientTempId: string) => {
    queryClient.setQueryData<any>(["chat", "room", "messages"], (old) => {
      if (!old?.pages?.length) return old;
      const pages: MessagesResponse[] = old.pages;
      const updated = pages.map((p) => ({
        ...p,
        items: p.items.map((m: UiMessage) =>
          m.clientTempId === clientTempId ? ({ ...m, sendState: "failed" } as UiMessage) : m,
        ),
      }));
      return { ...old, pages: updated };
    });
  };

  const replaceOptimistic = (clientTempId: string, confirmed: Message) => {
    queryClient.setQueryData<any>(["chat", "room", "messages"], (old) => {
      if (!old?.pages?.length) return old;
      const pages: MessagesResponse[] = old.pages;
      const updated = pages.map((p) => ({
        ...p,
        items: p.items.map((m: UiMessage) => (m.clientTempId === clientTempId ? confirmed : m)),
      }));
      return { ...old, pages: updated };
    });
  };

  return { addIncomingMessage, addOptimisticMessage, markOptimisticFailed, replaceOptimistic };
}

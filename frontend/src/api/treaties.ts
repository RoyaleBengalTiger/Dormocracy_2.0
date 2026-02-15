import { httpClient } from '@/lib/http';
import type {
    Treaty,
    TreatyClause,
    Exchange,
    BreachCase,
    CaseChatMessage,
    TreatyType,
    ExchangeType,
} from '@/types';

export const treatiesApi = {
    // ─── Treaty CRUD + lifecycle ───────────────────────────────
    list: () => httpClient.get<Treaty[]>('/treaties'),

    get: (id: string) => httpClient.get<Treaty>(`/treaties/${id}`),

    create: (data: { title: string; type: TreatyType; endsAt: string }) =>
        httpClient.post<Treaty>('/treaties', data),

    advance: (id: string) => httpClient.post<Treaty>(`/treaties/${id}/advance`, {}),

    // ─── Participants (PM, NEGOTIATION only) ───────────────────
    addRoom: (id: string, roomId: string) =>
        httpClient.post<Treaty>(`/treaties/${id}/participants/rooms`, { roomId }),

    addUser: (id: string, userId: string) =>
        httpClient.post<Treaty>(`/treaties/${id}/participants/users`, { userId }),

    removeRoom: (id: string, roomId: string) =>
        httpClient.delete<Treaty>(`/treaties/${id}/participants/rooms/${roomId}`),

    removeUser: (id: string, userId: string) =>
        httpClient.delete<Treaty>(`/treaties/${id}/participants/users/${userId}`),

    getUserCandidates: (id: string) =>
        httpClient.get<Array<{ id: string; username: string; email: string; roomId: string }>>(`/treaties/${id}/candidates/users`),

    // ─── Leave (LOCKED only) ───────────────────────────────────
    leave: (id: string) => httpClient.post<Treaty>(`/treaties/${id}/leave`, {}),

    leaveRoom: (id: string, roomId: string) =>
        httpClient.post<Treaty>(`/treaties/${id}/leave-room`, { roomId }),

    // ─── Clauses ───────────────────────────────────────────────
    addClause: (id: string, content: string) =>
        httpClient.post<TreatyClause>(`/treaties/${id}/clauses`, { content }),

    updateClause: (id: string, clauseId: string, content: string) =>
        httpClient.patch<TreatyClause>(`/treaties/${id}/clauses/${clauseId}`, { content }),

    deleteClause: (id: string, clauseId: string) =>
        httpClient.delete(`/treaties/${id}/clauses/${clauseId}`),

    // ─── Participation (LOCKED only) ───────────────────────────
    accept: (id: string) => httpClient.post<Treaty>(`/treaties/${id}/accept`, {}),
    reject: (id: string) => httpClient.post<Treaty>(`/treaties/${id}/reject`, {}),

    // ─── Chat ──────────────────────────────────────────────────
    getChatMessages: (id: string, limit = 50, cursor?: string) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (cursor) params.set('cursor', cursor);
        return httpClient.get<{ chatRoomId: string; closed: boolean; items: CaseChatMessage[]; nextCursor: string | null }>(
            `/treaties/${id}/chat?${params}`,
        );
    },

    sendChatMessage: (id: string, content: string) =>
        httpClient.post<CaseChatMessage>(`/treaties/${id}/chat`, { content }),

    // ─── Exchanges ─────────────────────────────────────────────
    listExchanges: (id: string) =>
        httpClient.get<Exchange[]>(`/treaties/${id}/exchanges`),

    createExchange: (id: string, data: { title: string; description?: string; type: ExchangeType; bounty: number }) =>
        httpClient.post<Exchange>(`/treaties/${id}/exchanges`, data),

    acceptExchange: (id: string, eid: string) =>
        httpClient.post<Exchange>(`/treaties/${id}/exchanges/${eid}/accept`, {}),

    deliverExchange: (id: string, eid: string, deliveryNotes?: string) =>
        httpClient.post<Exchange>(`/treaties/${id}/exchanges/${eid}/deliver`, { deliveryNotes }),

    reviewExchange: (id: string, eid: string, approve: boolean) =>
        httpClient.post<Exchange>(`/treaties/${id}/exchanges/${eid}/review`, { approve }),

    // ─── Stakeholders ──────────────────────────────────────────
    listStakeholders: (id: string) =>
        httpClient.get<Array<{ id: string; username: string; email: string; roomNumber?: string | null }>>(`/treaties/${id}/stakeholders`),

    // ─── Breach Cases ──────────────────────────────────────────
    listBreaches: (id: string) =>
        httpClient.get<BreachCase[]>(`/treaties/${id}/breaches`),

    createBreach: (id: string, data: { accusedUserId: string; clauseIds: string[]; exchangeId?: string; title: string; description?: string }) =>
        httpClient.post<BreachCase>(`/treaties/${id}/breaches`, data),

    // ─── Breach Evaluation ────────────────────────────────────
    startBreachEvaluation: (id: string, bid: string) =>
        httpClient.post<BreachCase>(`/treaties/${id}/breaches/${bid}/start-evaluation`),
    addBreachChatMember: (id: string, bid: string, userId: string) =>
        httpClient.post(`/treaties/${id}/breaches/${bid}/chat-members`, { userId }),
    removeBreachChatMember: (id: string, bid: string, userId: string) =>
        httpClient.delete(`/treaties/${id}/breaches/${bid}/chat-members/${userId}`),
    ruleBreachCase: (id: string, bid: string, data: {
        rulingType: string; penaltyMode?: string;
        socialPenalty?: number; creditFine?: number; resolutionNote?: string;
    }) => httpClient.post<BreachCase>(`/treaties/${id}/breaches/${bid}/rule`, data),
    chooseBreachPenalty: (id: string, bid: string, choice: string) =>
        httpClient.post<BreachCase>(`/treaties/${id}/breaches/${bid}/choose-penalty`, { choice }),

    createBreachCompensations: (id: string, bid: string, data: { compensations: Array<{ userId: string; amount: number }>; note?: string }) =>
        httpClient.post<any>(`/treaties/${id}/breaches/${bid}/compensations`, data),

    // ─── Breach Case Chat ─────────────────────────────────────
    getBreachChatMessages: (id: string, bid: string, limit = 50, cursor?: string) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (cursor) params.set('cursor', cursor);
        return httpClient.get<any>(`/treaties/${id}/breaches/${bid}/chat?${params}`);
    },
    sendBreachChatMessage: (id: string, bid: string, content: string) =>
        httpClient.post<any>(`/treaties/${id}/breaches/${bid}/chat`, { content }),
    getBreachChatMembers: (id: string, bid: string) =>
        httpClient.get<any[]>(`/treaties/${id}/breaches/${bid}/chat-members`),
};

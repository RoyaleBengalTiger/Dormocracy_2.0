import { httpClient } from '@/lib/http';
import type {
    Violation,
    CreateViolationPayload,
    CloseEvaluationPayload,
    CaseChatMessage,
    CaseChatMember,
} from '@/types';

export const violationsApi = {
    /** List violations for the current user's room. */
    list: (offenderId?: string, status?: string) => {
        const params = new URLSearchParams();
        if (offenderId) params.set('offenderId', offenderId);
        if (status) params.set('status', status);
        const qs = params.toString();
        return httpClient.get<Violation[]>(`/violations${qs ? `?${qs}` : ''}`);
    },

    /** Create a violation (MAYOR / ADMIN only). */
    create: (data: CreateViolationPayload) =>
        httpClient.post<Violation>('/violations', data),

    /** Get invited violation cases (member of chat room). */
    getInvited: () =>
        httpClient.get<any[]>('/violations/invited'),

    /** Get a single violation by ID */
    get: (id: string) =>
        httpClient.get<Violation>(`/violations/${id}`),

    /** Appeal a violation (offender only). */
    appeal: (id: string, note?: string) =>
        httpClient.post<Violation>(`/violations/${id}/appeal`, { note }),

    /** PM inbox: appealed + in-evaluation violations for PM's department. */
    getAppeals: () =>
        httpClient.get<Violation[]>('/violations/appeals'),

    /** Start evaluation on an appealed violation (PM only). */
    startEvaluation: (id: string) =>
        httpClient.post<Violation>(`/violations/${id}/start-evaluation`, {}),

    /** Close evaluation with verdict (PM only). */
    closeEvaluation: (id: string, data: CloseEvaluationPayload) =>
        httpClient.post<Violation>(`/violations/${id}/close-evaluation`, data),

    // ─── Case Chat ─────────────────────────────────────────────

    /** Get case chat messages. */
    getChatMessages: (id: string, limit = 50, cursor?: string) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (cursor) params.set('cursor', cursor);
        return httpClient.get<{ chatRoomId: string; closed: boolean; items: CaseChatMessage[]; nextCursor: string | null }>(
            `/violations/${id}/chat?${params}`,
        );
    },

    /** Send a message to case chat. */
    sendChatMessage: (id: string, content: string) =>
        httpClient.post<CaseChatMessage>(`/violations/${id}/chat`, { content }),

    /** Get case chat members. */
    getChatMembers: (id: string) =>
        httpClient.get<CaseChatMember[]>(`/violations/${id}/chat/members`),

    /** Add member to case chat (PM only). */
    addChatMember: (id: string, userId: string) =>
        httpClient.post<CaseChatMember>(`/violations/${id}/chat/members`, { userId }),

    /** Kick member from case chat (PM only). */
    kickChatMember: (id: string, userId: string) =>
        httpClient.delete(`/violations/${id}/chat/members/${userId}`),

    /** D2: Offender chooses their penalty (EITHER_CHOICE only). */
    choosePenalty: (id: string, choice: 'CREDITS' | 'SOCIAL_SCORE') =>
        httpClient.post<Violation>(`/violations/${id}/choose-penalty`, { choice }),
};

import { httpClient } from '@/lib/http';
import { Election, SenateChatRoom, CaseChatMessage } from '@/types';

export const electionsApi = {
    // ─── Election CRUD ──────────────────────────────────────────

    createRoomElection: (data: { roomId: string; deadline: string }) =>
        httpClient.post<Election>('/elections/room', data),

    createDeptElection: (data: { departmentId: string; deadline: string }) =>
        httpClient.post<Election>('/elections/department', data),

    listElections: (params?: { roomId?: string; departmentId?: string; status?: string }) => {
        const query = new URLSearchParams();
        if (params?.roomId) query.set('roomId', params.roomId);
        if (params?.departmentId) query.set('departmentId', params.departmentId);
        if (params?.status) query.set('status', params.status);
        const qs = query.toString();
        return httpClient.get<Election[]>(`/elections${qs ? `?${qs}` : ''}`);
    },

    getElection: (id: string) =>
        httpClient.get<Election>(`/elections/${id}`),

    castVote: (electionId: string, candidateId: string) =>
        httpClient.post<Election>(`/elections/${electionId}/vote`, { candidateId }),

    resolveTie: (electionId: string, winnerId: string) =>
        httpClient.post<Election>(`/elections/${electionId}/resolve-tie`, { winnerId }),

    assignMinisters: (departmentId: string, data: { foreignMinisterId: string; financeMinisterId: string }) =>
        httpClient.post(`/elections/${departmentId}/assign-ministers`, data),

    // ─── Senate Chat ───────────────────────────────────────────

    getSenateChatRoom: (departmentId: string) =>
        httpClient.get<SenateChatRoom>(`/elections/senate/${departmentId}`),

    getSenateMessages: (departmentId: string, limit = 30, cursor?: string) => {
        const query = new URLSearchParams();
        query.set('limit', String(limit));
        if (cursor) query.set('cursor', cursor);
        return httpClient.get<{ chatRoomId: string; items: CaseChatMessage[]; nextCursor: string | null }>(
            `/elections/senate/${departmentId}/messages?${query.toString()}`,
        );
    },

    sendSenateMessage: (departmentId: string, content: string) =>
        httpClient.post<{ chatRoomId: string; message: CaseChatMessage }>(
            `/elections/senate/${departmentId}/messages`,
            { content },
        ),
};

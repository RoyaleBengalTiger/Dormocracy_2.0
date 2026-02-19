import { httpClient } from '@/lib/http';
import type {
    InterDeptTreaty,
    InterDeptBreachCase,
    BreachVerdict,
    CaseChatMessage,
    TreatyType,
    InterDeptTreatyClause,
} from '@/types';

export const interDeptTreatiesApi = {
    // ─── Treaty CRUD ─────────────────────────────────────────────
    list: () => httpClient.get<InterDeptTreaty[]>('/inter-dept-treaties'),

    get: (id: string) => httpClient.get<InterDeptTreaty>(`/inter-dept-treaties/${id}`),

    create: (data: { title: string; type: TreatyType; endsAt: string; departmentIds: string[] }) =>
        httpClient.post<InterDeptTreaty>('/inter-dept-treaties', data),

    // ─── Departments ─────────────────────────────────────────────
    listDepartments: () =>
        httpClient.get<Array<{ id: string; name: string; foreignMinister?: { id: string; username: string } | null }>>('/inter-dept-treaties/meta/departments'),

    inviteDepartment: (id: string, departmentId: string) =>
        httpClient.post<InterDeptTreaty>(`/inter-dept-treaties/${id}/departments/invite`, { departmentId }),

    respondDepartment: (id: string, departmentId: string, action: 'ACCEPT' | 'REJECT') =>
        httpClient.patch<InterDeptTreaty>(`/inter-dept-treaties/${id}/departments/${departmentId}/respond`, { action }),

    // ─── Stakeholders ────────────────────────────────────────────
    listStakeholders: (id: string) =>
        httpClient.get<Array<{ id: string; username: string; email: string }>>(`/inter-dept-treaties/${id}/stakeholders`),

    // ─── Participants ────────────────────────────────────────────
    addRoom: (id: string, roomId: string) =>
        httpClient.post<InterDeptTreaty>(`/inter-dept-treaties/${id}/participants/rooms`, { roomId }),

    addUser: (id: string, userId: string) =>
        httpClient.post<InterDeptTreaty>(`/inter-dept-treaties/${id}/participants/users`, { userId }),

    removeRoom: (id: string, roomId: string) =>
        httpClient.delete<InterDeptTreaty>(`/inter-dept-treaties/${id}/participants/rooms/${roomId}`),

    removeUser: (id: string, userId: string) =>
        httpClient.delete<InterDeptTreaty>(`/inter-dept-treaties/${id}/participants/users/${userId}`),

    // ─── Candidates ──────────────────────────────────────────────
    getRoomCandidates: (id: string) =>
        httpClient.get<Array<{ id: string; roomNumber: string; users: Array<{ id: string; username: string }> }>>(`/inter-dept-treaties/${id}/candidates/rooms`),

    getUserCandidates: (id: string) =>
        httpClient.get<Array<{ id: string; username: string; email: string; roomId: string }>>(`/inter-dept-treaties/${id}/candidates/users`),

    // ─── Clauses ─────────────────────────────────────────────────
    getClauses: (id: string) =>
        httpClient.get<InterDeptTreatyClause[]>(`/inter-dept-treaties/${id}/clauses`),

    addClause: (id: string, content: string) =>
        httpClient.post<InterDeptTreatyClause>(`/inter-dept-treaties/${id}/clauses`, { content }),

    updateClause: (id: string, clauseId: string, content: string) =>
        httpClient.patch<InterDeptTreatyClause>(`/inter-dept-treaties/${id}/clauses/${clauseId}`, { content }),

    deleteClause: (id: string, clauseId: string) =>
        httpClient.delete(`/inter-dept-treaties/${id}/clauses/${clauseId}`),

    lockClause: (id: string, clauseId: string) =>
        httpClient.post(`/inter-dept-treaties/${id}/clauses/${clauseId}/lock`, {}),

    unlockClause: (id: string, clauseId: string) =>
        httpClient.post(`/inter-dept-treaties/${id}/clauses/${clauseId}/unlock`, {}),

    // ─── Advance / Accept / Reject / Leave ──────────────────────
    advance: (id: string) =>
        httpClient.post<InterDeptTreaty>(`/inter-dept-treaties/${id}/advance`, {}),

    accept: (id: string) =>
        httpClient.post<InterDeptTreaty>(`/inter-dept-treaties/${id}/accept`, {}),

    reject: (id: string) =>
        httpClient.post<InterDeptTreaty>(`/inter-dept-treaties/${id}/reject`, {}),

    leave: (id: string) =>
        httpClient.post<InterDeptTreaty>(`/inter-dept-treaties/${id}/leave`, {}),

    // ─── Chat ────────────────────────────────────────────────────
    getChatMessages: (id: string, limit = 50, cursor?: string) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (cursor) params.set('cursor', cursor);
        return httpClient.get<{ chatRoomId: string; closed: boolean; items: CaseChatMessage[]; nextCursor: string | null }>(
            `/inter-dept-treaties/${id}/chat?${params}`,
        );
    },

    sendChatMessage: (id: string, content: string) =>
        httpClient.post<CaseChatMessage>(`/inter-dept-treaties/${id}/chat`, { content }),

    // ─── Breach Cases ────────────────────────────────────────────
    listBreaches: (id: string) =>
        httpClient.get<InterDeptBreachCase[]>(`/inter-dept-treaties/${id}/breaches`),

    createBreach: (id: string, data: { accusedUserId: string; clauseIds: string[]; title: string; description?: string }) =>
        httpClient.post<InterDeptBreachCase>(`/inter-dept-treaties/${id}/breaches`, data),

    // ─── Verdicts ────────────────────────────────────────────────
    proposeVerdict: (treatyId: string, breachId: string, data: {
        ruledAgainst: string; creditFine: number; socialPenalty: number;
        penaltyMode: string; notes?: string;
    }) => httpClient.post<BreachVerdict>(`/inter-dept-treaties/${treatyId}/breaches/${breachId}/verdicts`, data),

    voteVerdict: (verdictId: string, data: { vote: 'ACCEPT' | 'REJECT'; comment?: string }) =>
        httpClient.post<BreachVerdict>(`/inter-dept-treaties/breach-verdicts/${verdictId}/vote`, data),

    // ─── Breach Chat ─────────────────────────────────────────────
    getBreachChatMessages: (id: string, breachId: string, limit = 50, cursor?: string) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (cursor) params.set('cursor', cursor);
        return httpClient.get<{ chatRoomId: string; closed: boolean; items: CaseChatMessage[]; nextCursor: string | null }>(
            `/inter-dept-treaties/${id}/breaches/${breachId}/chat?${params}`,
        );
    },

    sendBreachChatMessage: (id: string, breachId: string, content: string) =>
        httpClient.post<CaseChatMessage>(`/inter-dept-treaties/${id}/breaches/${breachId}/chat`, { content }),
};

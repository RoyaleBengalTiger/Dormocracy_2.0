import { httpClient } from '@/lib/http';
import type { FinanceOverview, TreasuryTransaction, SocialScorePurchaseRequest } from '@/types';

export const financeApi = {
    // Treasury
    getOverview: () => httpClient.get<FinanceOverview>('/finance/overview'),

    getRoomTreasury: () => httpClient.get<{
        roomId: string;
        roomNumber: string;
        treasuryCredits: number;
        recentTransactions: TreasuryTransaction[];
    }>('/finance/room-treasury'),

    allocateToRoom: (roomId: string, data: { amount: number; note?: string }) =>
        httpClient.post<TreasuryTransaction>(`/finance/rooms/${roomId}/allocate`, data),

    recallFromRoom: (roomId: string, data: { amount: number; note?: string }) =>
        httpClient.post<TreasuryTransaction>(`/finance/rooms/${roomId}/recall`, data),

    getTransactions: (limit = 50) =>
        httpClient.get<TreasuryTransaction[]>(`/finance/transactions?limit=${limit}`),

    // Social Score Purchase
    createSocialScoreRequest: (data: { requestNote?: string }) =>
        httpClient.post<SocialScorePurchaseRequest>('/finance/social-score/requests', data),

    getSocialScoreRequests: (status?: string) =>
        httpClient.get<SocialScorePurchaseRequest[]>(
            `/finance/social-score/requests${status ? `?status=${status}` : ''}`
        ),

    getMySocialScoreRequests: () =>
        httpClient.get<SocialScorePurchaseRequest[]>('/finance/social-score/my-requests'),

    offerSocialScore: (requestId: string, data: { offeredPriceCredits: number; offeredSocialScore: number }) =>
        httpClient.patch<SocialScorePurchaseRequest>(`/finance/social-score/requests/${requestId}/offer`, data),

    acceptOffer: (requestId: string) =>
        httpClient.patch<SocialScorePurchaseRequest>(`/finance/social-score/requests/${requestId}/accept`),

    rejectOffer: (requestId: string) =>
        httpClient.patch<SocialScorePurchaseRequest>(`/finance/social-score/requests/${requestId}/reject`),
};

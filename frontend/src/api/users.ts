import { httpClient } from '@/lib/http';
import { UserProfile, User } from '@/types';

export const usersApi = {
  // Backend returns User directly, not wrapped
  getMe: async (): Promise<User> => {
    const user = await httpClient.get<User>('/users/me');
    return user;
  },

  updateMe: (data: { username?: string; email?: string }) =>
    httpClient.patch<User>('/users/me', data),

  /** PM/ADMIN: list all users (for participant search). */
  listAll: () => httpClient.get<User[]>('/users'),
};
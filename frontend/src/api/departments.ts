import { httpClient } from '@/lib/http';
import { Department, DepartmentListItem, Room } from '@/types';

export const departmentsApi = {
  getDepartments: () => httpClient.get<Department[]>('/departments'),
};

export const departmentsAdminApi = {
  /** Fetch all departments with rooms, users, and leadership for the admin view. */
  listDepartments: () => httpClient.get<DepartmentListItem[]>('/departments'),

  /** Assign or unassign PM / FM / Finance Minister for a department. */
  updateLeadership: (
    departmentId: string,
    body: { primeMinisterId?: string | null; foreignMinisterId?: string | null; financeMinisterId?: string | null },
  ) => httpClient.patch<DepartmentListItem>(`/departments/${departmentId}/leadership`, body),
};

export const roomsApi = {
  getRooms: () => httpClient.get<Room[]>('/rooms'),
};
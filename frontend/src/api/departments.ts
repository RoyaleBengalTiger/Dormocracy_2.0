 import { httpClient } from '@/lib/http';
 import { Department, Room } from '@/types';
 
 export const departmentsApi = {
   getDepartments: () => httpClient.get<Department[]>('/departments'),
 };
 
 export const roomsApi = {
   getRooms: () => httpClient.get<Room[]>('/rooms'),
 };
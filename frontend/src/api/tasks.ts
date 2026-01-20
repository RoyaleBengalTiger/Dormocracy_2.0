 import { httpClient } from '@/lib/http';
 import { Task, CreateTaskDto, ApproveAssignTaskDto, CompleteTaskDto, ReviewTaskDto, TaskStatus } from '@/types';
 
 export const tasksApi = {
   getTasks: (params?: { status?: TaskStatus; myOnly?: boolean }) => {
     const queryParams = new URLSearchParams();
     if (params?.status) queryParams.append('status', params.status);
     if (params?.myOnly) queryParams.append('myOnly', 'true');
     
     const query = queryParams.toString();
     return httpClient.get<Task[]>(`/tasks${query ? `?${query}` : ''}`);
   },
   
   getTask: (id: string) => httpClient.get<Task>(`/tasks/${id}`),
   
   createTask: (data: CreateTaskDto) => httpClient.post<Task>('/tasks', data),
   
   approveAndAssign: (id: string, data: ApproveAssignTaskDto) =>
     httpClient.patch<Task>(`/tasks/${id}/approve-assign`, data),
   
   completeTask: (id: string, data: CompleteTaskDto) =>
     httpClient.patch<Task>(`/tasks/${id}/complete`, data),
   
   reviewTask: (id: string, data: ReviewTaskDto) =>
     httpClient.patch<Task>(`/tasks/${id}/review`, data),
 };
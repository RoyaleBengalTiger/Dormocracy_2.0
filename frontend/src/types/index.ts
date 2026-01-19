 export enum Role {
   CITIZEN = 'CITIZEN',
   MAYOR = 'MAYOR',
   MINISTER = 'MINISTER',
   PM = 'PM',
   ADMIN = 'ADMIN'
 }
 
 export enum TaskStatus {
   PENDING_APPROVAL = 'PENDING_APPROVAL',
   ACTIVE = 'ACTIVE',
   AWAITING_REVIEW = 'AWAITING_REVIEW',
   COMPLETED = 'COMPLETED'
 }
 
 export interface User {
   id: string;
   username: string;
   email: string;
  role: string;
   socialScore: number;
   createdAt: string;
  room: Room | null;
  assignedTasks: any[];
 }
 
 export interface Department {
   id: string;
   name: string;
 }

export interface RoomUser {
  id: string;
  username: string;
  role: string;
}
 
 export interface Room {
   id: string;
   roomNumber: string;
  department: Department;
  mayor: RoomUser | null;
  users: RoomUser[];
 }
 
 export interface Task {
   id: string;
   title: string;
   description?: string;
   status: TaskStatus;
   roomId: string;
   createdById: string;
   assignedToId?: string;
   completionSummary?: string;
   completedAt?: string;
   mayorReviewNote?: string;
   reviewedAt?: string;
   createdAt: string;
   updatedAt: string;
   createdBy?: User;
   assignedTo?: User;
 }
 
 export interface UserProfile {
   user: User;
   room?: {
     id: string;
     roomNumber: string;
     department: Department;
     mayor: User | null;
     users: User[];
   };
   assignedTasks: Task[];
 }
 
 export interface CreateTaskDto {
   title: string;
   description?: string;
 }
 
 export interface ApproveAssignTaskDto {
   assignedToId: string;
 }
 
 export interface CompleteTaskDto {
   completionSummary: string;
 }
 
 export interface ReviewTaskDto {
   accept: boolean;
   note?: string;
 }
 
 export interface LoginDto {
   email: string;
   password: string;
 }
 
 export interface SignupDto {
   username: string;
   email: string;
   password: string;
   departmentName: string;
   roomNumber: string;
 }
 
 export interface AuthResponse {
   accessToken: string;
 }
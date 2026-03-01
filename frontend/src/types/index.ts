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
  credits: number;
  isJailed: boolean;
  createdAt: string;
  room: Room | null;
  assignedTasks: any[];
  /** Computed office flags (from department/room assignments) */
  isPrimeMinister: boolean;
  isForeignMinister: boolean;
  isFinanceMinister: boolean;
  isMayor: boolean;
}

export interface Department {
  id: string;
  name: string;
  treasuryCredits?: number;
  primeMinisterId?: string | null;
  foreignMinisterId?: string | null;
  financeMinisterId?: string | null;
  primeMinister?: { id: string; username: string; email: string } | null;
  foreignMinister?: { id: string; username: string; email: string } | null;
  financeMinister?: { id: string; username: string; email: string } | null;
}

export interface DepartmentListItem {
  id: string;
  name: string;
  primeMinister: { id: string; username: string; email: string } | null;
  foreignMinister: { id: string; username: string; email: string } | null;
  financeMinister: { id: string; username: string; email: string } | null;
  rooms: Array<{
    id: string;
    roomNumber: string;
    users: Array<{ id: string; username: string; email: string; role: string }>;
  }>;
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
  treasuryCredits?: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  roomId: string;
  createdById: string;
  assignedToId?: string;
  fundAmount?: number;
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
  fundAmount?: number;
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

export enum ViolationStatusEnum {
  ACTIVE = 'ACTIVE',
  APPEALED = 'APPEALED',
  IN_EVALUATION = 'IN_EVALUATION',
  CLOSED_UPHELD = 'CLOSED_UPHELD',
  CLOSED_OVERTURNED = 'CLOSED_OVERTURNED',
  EXPIRED = 'EXPIRED',
}

export enum ViolationVerdictEnum {
  UPHELD = 'UPHELD',
  OVERTURNED = 'OVERTURNED',
  PUNISH_MAYOR = 'PUNISH_MAYOR',
}

export enum ViolationPenaltyMode {
  BOTH_MANDATORY = 'BOTH_MANDATORY',
  EITHER_CHOICE = 'EITHER_CHOICE',
}

export enum ViolationOffenderChoice {
  CREDITS = 'CREDITS',
  SOCIAL_SCORE = 'SOCIAL_SCORE',
}

export interface Violation {
  id: string;
  status: ViolationStatusEnum;
  roomId: string;
  title: string;
  description?: string;
  points: number;
  creditFine: number;
  penaltyMode: ViolationPenaltyMode;
  offenderChoice?: ViolationOffenderChoice | null;
  creditsDeducted: number;
  pointsDeducted: number;
  creditsRefunded: number;
  expiresAt?: string | null;
  archivedAt?: string | null;
  pointsRefunded: number;
  refundedAt?: string | null;
  appealedAt?: string | null;
  appealNote?: string | null;
  evaluationStartedAt?: string | null;
  evaluationClosedAt?: string | null;
  verdict?: ViolationVerdictEnum | null;
  verdictNote?: string | null;
  closedById?: string | null;
  mayorViolationId?: string | null;
  offender: { id: string; username: string };
  createdBy: { id: string; username: string };
  chatRoom?: { id: string; closedAt?: string | null } | null;
  createdAt: string;
}

export interface CreateViolationPayload {
  offenderId: string;
  title: string;
  description?: string;
  points: number;
  creditFine?: number;
  penaltyMode?: ViolationPenaltyMode;
  expiresAt?: string;
}

export interface CloseEvaluationPayload {
  verdict: ViolationVerdictEnum;
  verdictNote?: string;
  mayorPenaltyPoints?: number;
  mayorPenaltyTitle?: string;
}

export interface CaseChatMessage {
  id: string;
  content: string;
  createdAt: string;
  chatRoomId?: string;
  sender: { id: string; username: string; role: string };
}

export interface CaseChatMember {
  id: string;
  userId: string;
  user: { id: string; username: string; role: string };
  joinedAt: string;
}

// ─── TREASURY / FINANCE TYPES ────────────────────────────────

export enum TreasuryTransactionType {
  DEPT_ALLOCATE_TO_ROOM = 'DEPT_ALLOCATE_TO_ROOM',
  DEPT_RECALL_FROM_ROOM = 'DEPT_RECALL_FROM_ROOM',
  ROOM_TASK_SPEND = 'ROOM_TASK_SPEND',
  USER_BUY_SOCIAL_SCORE = 'USER_BUY_SOCIAL_SCORE',
}

export interface TreasuryTransaction {
  id: string;
  type: TreasuryTransactionType;
  amount: number;
  roomId?: string | null;
  taskId?: string | null;
  userId?: string | null;
  note?: string | null;
  createdAt: string;
  createdBy: { id: string; username: string };
  room?: { id: string; roomNumber: string } | null;
}

export interface FinanceOverview {
  department: {
    id: string;
    name: string;
    treasuryCredits: number;
    rooms: Array<{
      id: string;
      roomNumber: string;
      treasuryCredits: number;
    }>;
  };
  recentTransactions: TreasuryTransaction[];
}

export enum SocialScorePurchaseStatusEnum {
  REQUESTED = 'REQUESTED',
  OFFERED = 'OFFERED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export interface SocialScorePurchaseRequest {
  id: string;
  userId: string;
  departmentId: string;
  status: SocialScorePurchaseStatusEnum;
  requestNote?: string | null;
  offeredById?: string | null;
  offeredBy?: { id: string; username: string } | null;
  offeredPriceCredits?: number | null;
  offeredSocialScore?: number | null;
  offeredAt?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; username: string; credits: number; socialScore: number };
}

// ─── TREATY TYPES ────────────────────────────────────────────

export enum TreatyStatus {
  NEGOTIATION = 'NEGOTIATION',
  LOCKED = 'LOCKED',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
}

export enum TreatyType {
  EXCHANGE = 'EXCHANGE',
  NON_EXCHANGE = 'NON_EXCHANGE',
}

export enum ExchangeType {
  TASK_FOR_BOUNTY = 'TASK_FOR_BOUNTY',
  NOTES_OR_RESOURCES_FOR_BOUNTY = 'NOTES_OR_RESOURCES_FOR_BOUNTY',
  ITEMS_FOR_BOUNTY = 'ITEMS_FOR_BOUNTY',
}

export enum ExchangeStatus {
  OPEN = 'OPEN',
  ACCEPTED = 'ACCEPTED',
  DELIVERED = 'DELIVERED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum BreachCaseStatus {
  OPEN = 'OPEN',
  IN_REVIEW = 'IN_REVIEW',
  AWAITING_CRIMINAL_CHOICE = 'AWAITING_CRIMINAL_CHOICE',
  RESOLVED = 'RESOLVED',
}

export enum BreachRulingType {
  AGAINST_ACCUSED = 'AGAINST_ACCUSED',
  AGAINST_ACCUSER = 'AGAINST_ACCUSER',
  NONE = 'NONE',
}

export enum BreachPenaltyMode {
  BOTH_MANDATORY = 'BOTH_MANDATORY',
  EITHER_CHOICE = 'EITHER_CHOICE',
  NONE = 'NONE',
}

export enum BreachCriminalChoice {
  SOCIAL = 'SOCIAL',
  CREDITS = 'CREDITS',
}

export interface TreatyParticipant {
  id: string;
  type: 'ROOM' | 'USER';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'LEFT';
  roomId?: string | null;
  userId?: string | null;
  respondedAt?: string | null;
  room?: { id: string; roomNumber: string; departmentId?: string } | null;
  user?: { id: string; username: string } | null;
}

export interface TreatyClause {
  id: string;
  content: string;
  orderIndex: number;
  createdBy: { id: string; username: string };
  createdAt: string;
}

export interface Treaty {
  id: string;
  title: string;
  type: TreatyType;
  status: TreatyStatus;
  departmentId: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; username: string };
  chatRoom?: { id: string; closedAt?: string | null } | null;
  participants: TreatyParticipant[];
  clauses: TreatyClause[];
}

export interface Exchange {
  id: string;
  type: ExchangeType;
  status: ExchangeStatus;
  title: string;
  description?: string | null;
  bounty: number;
  createdAt: string;
  seller?: { id: string; username: string } | null;
  buyer: { id: string; username: string };
  deliveryNotes?: string | null;
  deliveredAt?: string | null;
  reviewedAt?: string | null;
}

export interface BreachCase {
  id: string;
  status: BreachCaseStatus;
  title: string;
  description?: string | null;
  exchangeId?: string | null;
  createdAt: string;
  filer: { id: string; username: string };
  accusedUser: { id: string; username: string };
  clauses: Array<{ clause: { id: string; content: string } }>;
  chatRoom?: { id: string; closedAt?: string | null } | null;
  evaluatedAt?: string | null;
  ruledAt?: string | null;
  ruledBy?: { id: string; username: string } | null;
  rulingType?: BreachRulingType | null;
  rulingTargetUserId?: string | null;
  rulingTarget?: { id: string; username: string } | null;
  penaltyMode?: BreachPenaltyMode | null;
  socialPenalty?: number | null;
  creditFine?: number | null;
  criminalChoice?: BreachCriminalChoice | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: { id: string; username: string } | null;
}

// ─── INTER-DEPT TREATY TYPES ─────────────────────────────────

export enum TreatyMode {
  DEPT_SCOPE = 'DEPT_SCOPE',
  INTER_DEPT = 'INTER_DEPT',
}

export enum TreatyDepartmentStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  LEFT = 'LEFT',
}

export enum BreachVerdictStatus {
  PROPOSED = 'PROPOSED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export enum BreachVerdictRulingEnum {
  ACCUSED = 'ACCUSED',
  ACCUSER = 'ACCUSER',
  NONE = 'NONE',
}

export enum BreachVerdictPenaltyModeEnum {
  BOTH_MANDATORY = 'BOTH_MANDATORY',
  EITHER_CHOICE = 'EITHER_CHOICE',
}

export interface TreatyDepartmentItem {
  id: string;
  departmentId: string;
  status: TreatyDepartmentStatus;
  invitedById: string;
  respondedById?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  department: {
    id: string;
    name: string;
    foreignMinisterId?: string | null;
    foreignMinister?: { id: string; username: string } | null;
  };
  invitedBy: { id: string; username: string };
  respondedBy?: { id: string; username: string } | null;
}

export interface InterDeptTreatyClause {
  id: string;
  content: string;
  orderIndex: number;
  isLocked: boolean;
  lockedById?: string | null;
  lockedBy?: { id: string; username: string } | null;
  lockedAt?: string | null;
  createdBy: { id: string; username: string };
  createdAt: string;
}

export interface InterDeptTreaty {
  id: string;
  title: string;
  type: TreatyType;
  status: TreatyStatus;
  mode: TreatyMode;
  departmentId: string;
  hostForeignMinisterId?: string | null;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; username: string };
  hostForeignMinister?: { id: string; username: string } | null;
  department: { id: string; name: string };
  chatRoom?: { id: string; closedAt?: string | null } | null;
  treatyDepartments: TreatyDepartmentItem[];
  participants: TreatyParticipant[];
  clauses: InterDeptTreatyClause[];
}

export interface BreachVerdictVote {
  id: string;
  vote: string;
  comment?: string | null;
  createdAt: string;
  voterUser: { id: string; username: string };
  voterDepartment: { id: string; name: string };
}

export interface BreachVerdict {
  id: string;
  status: BreachVerdictStatus;
  ruledAgainst: BreachVerdictRulingEnum;
  creditFine: number;
  socialPenalty: number;
  penaltyMode: BreachVerdictPenaltyModeEnum;
  notes?: string | null;
  createdAt: string;
  finalizedAt?: string | null;
  proposedBy: { id: string; username: string };
  votes: BreachVerdictVote[];
}

export interface InterDeptBreachCase extends BreachCase {
  breachVerdicts?: BreachVerdict[];
}

// ─── ELECTION TYPES ──────────────────────────────────────────

export enum ElectionType {
  ROOM = 'ROOM',
  DEPARTMENT = 'DEPARTMENT',
}

export enum ElectionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  TIE_BREAKING = 'TIE_BREAKING',
}

export interface ElectionCandidate {
  id: string;
  electionId: string;
  userId: string;
  totalVotePower: number;
  user: { id: string; username: string; socialScore?: number };
}

export interface ElectionVote {
  id: string;
  electionId: string;
  voterId: string;
  candidateId: string;
  votePower: number;
  createdAt: string;
  voter: { id: string; username: string };
  candidate: ElectionCandidate;
}

export interface Election {
  id: string;
  type: ElectionType;
  status: ElectionStatus;
  roomId?: string | null;
  departmentId?: string | null;
  deadline: string;
  winnerId?: string | null;
  winner?: { id: string; username: string } | null;
  room?: {
    id: string;
    roomNumber: string;
    departmentId: string;
    department: { id: string; name: string };
  } | null;
  department?: { id: string; name: string } | null;
  candidates: ElectionCandidate[];
  votes: ElectionVote[];
  createdAt: string;
  updatedAt: string;
}

export interface SenateChatRoom {
  id: string;
  type: string;
  departmentSenateId: string;
  closedAt?: string | null;
  members: Array<{
    id: string;
    userId: string;
    user: { id: string; username: string; role: string };
  }>;
}

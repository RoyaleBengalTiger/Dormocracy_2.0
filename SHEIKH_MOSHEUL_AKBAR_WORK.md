# Sheikh Mosheul Akbar - Work Explanation Script & Key Concepts

## Introduction Script

> "Hello, I'm Sheikh Mosheul Akbar, and I'll walk you through my contributions to Dormocracy 2.0. My work focused on three main areas: building a real-time chat system using WebSockets, implementing the department management module, and creating the admin interface for mayor assignments. Let me explain each of these in detail."

---

## 1. Real-Time Chat System (WebSocket Implementation)

### Script

> "One of my key contributions was implementing a real-time chat system for room residents. In a dormitory management system, communication is essential—roommates need to coordinate tasks, share announcements, and discuss room matters.
>
> I chose WebSockets over traditional HTTP polling because WebSockets maintain a persistent, bidirectional connection between the client and server. This means messages are delivered instantly without the overhead of repeated HTTP requests.
>
> Here's how the system works: when a user joins their room's chat, a WebSocket connection is established through our NestJS gateway. The gateway handles events like joining a room, sending messages, and leaving. Each message is persisted to the database and broadcast to all connected room members in real-time."

### Key Concepts

#### 1.1 WebSocket Gateway (NestJS)
```
┌─────────────────────────────────────────────────────────────────┐
│                    WebSocket Architecture                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Client A ◄──────┐                    ┌──────► Client B        │
│                   │                    │                         │
│                   ▼                    ▼                         │
│              ┌─────────────────────────────┐                    │
│              │    WebSocket Gateway        │                    │
│              │    (NestJS @WebSocketGateway)│                    │
│              └─────────────────────────────┘                    │
│                          │                                       │
│                          ▼                                       │
│              ┌─────────────────────────────┐                    │
│              │      Chat Service           │                    │
│              │   (Business Logic)          │                    │
│              └─────────────────────────────┘                    │
│                          │                                       │
│                          ▼                                       │
│              ┌─────────────────────────────┐                    │
│              │      Prisma (Database)      │                    │
│              │   ChatRoom, ChatMessage     │                    │
│              └─────────────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 1.2 Key Technical Concepts

| Concept | Explanation |
|---------|-------------|
| **WebSocket** | A communication protocol providing full-duplex channels over a single TCP connection. Unlike HTTP, it keeps the connection open for real-time data exchange. |
| **@WebSocketGateway** | NestJS decorator that creates a WebSocket server. Handles connection lifecycle and message routing. |
| **@SubscribeMessage** | Decorator to handle specific message types (events) from clients. |
| **Socket.io Rooms** | Virtual channels that sockets can join. Messages can be broadcast to all sockets in a room. |
| **Event-Driven Architecture** | Pattern where components communicate through events (join, message, leave) rather than direct calls. |

#### 1.3 Database Schema for Chat

```sql
-- Chat Room linked to a physical Room
ChatRoom {
  id: UUID (Primary Key)
  type: ChatRoomType (ROOM)
  roomId: FK → Room.id (One-to-One)
  createdAt: Timestamp
  updatedAt: Timestamp
}

-- Membership table (many-to-many between Users and ChatRooms)
ChatRoomMember {
  id: UUID (Primary Key)
  chatRoomId: FK → ChatRoom.id
  userId: FK → User.id
  mutedUntil: Timestamp (nullable)
  joinedAt: Timestamp
  UNIQUE(chatRoomId, userId)
}

-- Messages in a chat room
ChatMessage {
  id: UUID (Primary Key)
  chatRoomId: FK → ChatRoom.id
  senderId: FK → User.id
  content: Text
  deletedAt: Timestamp (nullable, for soft delete)
  createdAt: Timestamp
}
```

#### 1.4 Why This Matters
- **Instant Communication**: No page refresh needed
- **Efficient**: Single persistent connection vs repeated polling
- **Scalable**: Room-based broadcasting limits message distribution
- **Persistent History**: Messages stored in database for later retrieval

---

## 2. Department Management Module

### Script

> "The department module is a backend service that manages organizational units within the dormitory system. Think of departments as buildings or sections—each department contains multiple rooms.
>
> I implemented full CRUD operations: Create, Read, Update, and Delete. The module follows NestJS's modular architecture with a controller handling HTTP requests, a service containing business logic, and DTOs (Data Transfer Objects) for validating input.
>
> This separation of concerns makes the code maintainable and testable. For example, if we need to add department-level permissions later, we only modify the service layer without touching the controller."

### Key Concepts

#### 2.1 NestJS Module Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                  Department Module Structure                    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   HTTP Request                                                  │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────────────────────────────────┐                  │
│   │        departments.controller.ts         │                  │
│   │  • @Get('/') - List all departments      │                  │
│   │  • @Get(':id') - Get one department      │                  │
│   │  • @Post('/') - Create department        │                  │
│   │  • @Patch(':id') - Update department     │                  │
│   │  • @Delete(':id') - Delete department    │                  │
│   └─────────────────────────────────────────┘                  │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────────────────────────────────┐                  │
│   │         departments.service.ts           │                  │
│   │  • findAll() - Query all records         │                  │
│   │  • findOne() - Query single record       │                  │
│   │  • create() - Insert new record          │                  │
│   │  • update() - Modify existing record     │                  │
│   │  • remove() - Delete record              │                  │
│   └─────────────────────────────────────────┘                  │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────────────────────────────────┐                  │
│   │              Prisma Client               │                  │
│   │       (Database Operations)              │                  │
│   └─────────────────────────────────────────┘                  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

#### 2.2 Key Technical Concepts

| Concept | Explanation |
|---------|-------------|
| **Controller** | Handles incoming HTTP requests and returns responses. Uses decorators like `@Get()`, `@Post()` to define routes. |
| **Service** | Contains business logic. Injectable class that can be reused across controllers. |
| **DTO (Data Transfer Object)** | Defines the shape of data for requests. Used with class-validator for automatic validation. |
| **Module** | Encapsulates related controllers, services, and providers. Promotes code organization. |
| **Dependency Injection** | NestJS automatically injects services into controllers via constructor parameters. |

#### 2.3 DTO Example
```typescript
// create-department.dto.ts
class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  name: string;        // e.g., "Building A"

  @IsString()
  @IsOptional()
  description?: string; // e.g., "First floor dormitory"
}
```

#### 2.4 Why This Matters
- **Validation**: DTOs ensure only valid data reaches the database
- **Separation of Concerns**: Each layer has a single responsibility
- **Testability**: Services can be unit tested independently
- **Scalability**: Easy to add features without breaking existing code

---

## 3. Admin Page & AssignMayor Modal

### Script

> "The admin interface allows administrators to manage room assignments and appoint mayors. A 'mayor' in our system is a room leader responsible for coordinating tasks and managing room activities.
>
> I built the AdminRooms page using React with TypeScript. It displays all rooms with their current mayors and provides a search/filter capability. Administrators can click on any room to open the AssignMayorModal and select a new mayor from the room's residents.
>
> I used React Query for data fetching, which handles caching, background refetching, and error states automatically. The modal uses controlled components with React hooks for state management."

### Key Concepts

#### 3.1 Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Admin Page Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────────────────────────────────────┐           │
│   │              AdminRooms Page                      │           │
│   │  • Search input (filter rooms)                   │           │
│   │  • Toggle: Show rooms without mayor              │           │
│   │  • Room cards grid                               │           │
│   └─────────────────────────────────────────────────┘           │
│              │                                                   │
│              │ onClick(room)                                     │
│              ▼                                                   │
│   ┌─────────────────────────────────────────────────┐           │
│   │           AssignMayorModal                        │           │
│   │  • Current mayor display                         │           │
│   │  • Dropdown: Select candidate                    │           │
│   │  • Confirm / Cancel buttons                      │           │
│   └─────────────────────────────────────────────────┘           │
│              │                                                   │
│              │ onSubmit()                                        │
│              ▼                                                   │
│   ┌─────────────────────────────────────────────────┐           │
│   │            API Call                               │           │
│   │  roomsAdminApi.assignMayor(roomId, userId)       │           │
│   └─────────────────────────────────────────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2 Key Technical Concepts

| Concept | Explanation |
|---------|-------------|
| **React Query (useQuery)** | Library for fetching, caching, and updating server state. Handles loading/error states automatically. |
| **Controlled Components** | Form elements where React state is the "single source of truth" for input values. |
| **useMemo** | React hook that memoizes computed values to avoid expensive recalculations on every render. |
| **useState** | React hook for managing local component state (search term, selected room, modal visibility). |
| **useEffect** | React hook for side effects (reset state when modal opens). |
| **Toast Notifications** | User feedback system for success/error messages. |

#### 3.3 State Management Flow
```
User Action           State Change              UI Update
─────────────────────────────────────────────────────────────
Type in search    →   setSearch(value)      →   filteredRooms updates
Toggle filter     →   setNoMayorOnly(bool)  →   filteredRooms updates  
Click room card   →   setSelectedRoom(room) →   Modal opens
                      setModalOpen(true)
Select candidate  →   setSelectedUserId(id) →   Button enabled
Click Confirm     →   API call              →   Toast notification
                      onSuccess()           →   Room list refetches
```

#### 3.4 API Integration Pattern
```typescript
// Frontend calls backend through typed API client
const roomsAdminApi = {
  listRooms: () => httpClient.get<RoomListItem[]>('/admin/rooms'),
  assignMayor: (roomId: string, userId: string) => 
    httpClient.patch(`/rooms/${roomId}/mayor`, { mayorId: userId }),
};

// Usage with React Query
const { data: rooms, refetch } = useQuery({
  queryKey: ['admin', 'rooms'],   // Cache key
  queryFn: roomsAdminApi.listRooms, // Fetcher function
});
```

#### 3.5 Why This Matters
- **Type Safety**: TypeScript ensures API responses match expected types
- **Optimistic UX**: Toast feedback keeps users informed
- **Performance**: useMemo prevents unnecessary filter recalculations
- **Error Handling**: Graceful handling of network failures and permission errors

---

## Summary of Contributions

### Contribution Statistics
| Metric | Value |
|--------|-------|
| Commits | 4 |
| Files Changed | 28 |
| Lines Added | +1,026 |
| Lines Removed | -441 |
| Backend | 441 lines |
| Frontend | 585 lines |

### Technical Skills Demonstrated

| Skill | Where Applied |
|-------|---------------|
| **WebSocket/Real-time Systems** | Chat module with Socket.io |
| **NestJS Backend Development** | Department module, Chat gateway |
| **React Frontend Development** | AdminRooms page, AssignMayorModal |
| **TypeScript** | Type-safe API clients, component props |
| **Database Design** | Chat schema with Prisma migrations |
| **State Management** | React Query, useState, useMemo |
| **UI/UX Design** | Modals, search filters, toast notifications |

---

## Closing Script

> "In summary, my contributions to Dormocracy 2.0 span both backend and frontend development. The chat system enables real-time communication between room residents. The department module provides organizational structure for the dormitory. And the admin interface empowers administrators to manage room leadership efficiently.
>
> These features work together to create a cohesive dormitory management experience. The real-time capabilities and administrative tools I built are essential for the day-to-day operations of a modern dormitory system.
>
> Thank you for your attention. I'm happy to answer any questions about my implementation."

---

## Quick Reference: Key Technologies Used

```
┌────────────────────────────────────────────────────────────────┐
│                    Technology Stack                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  BACKEND                      FRONTEND                          │
│  ────────                     ────────                          │
│  • NestJS                     • React 18                        │
│  • WebSocket Gateway          • TypeScript                      │
│  • Socket.io                  • React Query                     │
│  • Prisma ORM                 • Tailwind CSS                    │
│  • PostgreSQL                 • shadcn/ui                       │
│  • TypeScript                 • Framer Motion                   │
│                                                                 │
│  CONCEPTS                     PATTERNS                          │
│  ────────                     ────────                          │
│  • Real-time Communication    • MVC Architecture                │
│  • Event-Driven Design        • Dependency Injection            │
│  • CRUD Operations            • Controlled Components           │
│  • Database Migrations        • State Management                │
│  • DTOs & Validation          • API Client Pattern              │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

*Document prepared for presentation by Sheikh Mosheul Akbar*  
*Dormocracy 2.0 Project - January 2026*

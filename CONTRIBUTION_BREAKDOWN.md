# Dormocracy 2.0 - Contribution Breakdown

## Overview

This document provides a detailed breakdown of **every contributor's individual contributions** to the Dormocracy 2.0 project, intended for creating a contribution slide presentation.

---

## Team Contributors Summary

| Contributor | Email | Commits | Files Changed | Lines Added | Lines Removed |
|------------|-------|---------|---------------|-------------|---------------|
| **RoyaleBengalTiger** | siamsifat244@gmail.com | 4 | 62 | +23,757 | 0 |
| **noobra1** | muhatadimaruf@iut-dhaka.edu | 4 | 63 | +4,875 | 0 |
| **samiulislam22** | tony32950@gmail.com | 4 | 23 | +1,244 | 0 |
| **Sheikh Mosheul Akbar** | sheikhakbar@iut-dhaka.edu | 4 | 28 | +1,026 | -441 |
| **TOTAL** | — | **16** | **176** | **+30,902** | **-441** |

---

## Individual Contribution Breakdowns

---

### 1. RoyaleBengalTiger (Siam Sifat)
**Email:** siamsifat244@gmail.com  
**GitHub:** [@RoyaleBengalTiger](https://github.com/RoyaleBengalTiger)

#### Summary Statistics
| Metric | Value |
|--------|-------|
| Commits | 4 |
| Files Changed | 62 |
| Lines Added | +23,757 |
| Lines Removed | 0 |

#### Commit History
1. `Initial project setup` - NestJS backend scaffolding
2. `database schema & authentication implemented` - Prisma schema + JWT auth
3. `Frontend Setup` - React + Vite + Tailwind initialization
4. `user dashboard and mayor dashboard, user task modal and not found page` - Dashboard pages

#### Backend Contributions (13,846 lines)
| Module | Lines | Description |
|--------|-------|-------------|
| **Auth Module** | 334 | JWT authentication, login/register endpoints, role-based guards |
| **DB Schema & Migrations** | 409 | PostgreSQL schema design, migrations |
| **Project Setup** | ~13,000+ | NestJS config, package dependencies, ESLint, TypeScript |

#### Frontend Contributions (9,911 lines)
| Module | Lines | Description |
|--------|-------|-------------|
| **Pages** | 361 | User Dashboard, Mayor Dashboard, NotFound page |
| **Modal Components** | 104 | CreateTaskModal |
| **Contexts** | 71 | AuthContext provider |
| **Hooks** | 205 | use-toast, use-mobile hooks |
| **Lib/Utils** | 206 | HTTP client, utilities |
| **Project Setup** | ~9,000+ | Vite, Tailwind, package dependencies |

#### Key Features Implemented
- ✅ **Initial Project Architecture** (Backend + Frontend scaffolding)
- ✅ **Authentication System** (JWT-based, role guards)
- ✅ **Database Schema** (User, Room, Task, Chat models)
- ✅ **User & Mayor Dashboards**
- ✅ **AuthContext** for frontend state management
- ✅ **Custom React Hooks** (toast notifications, mobile detection)

---

### 2. noobra1 (Muhtadi Maruf)
**Email:** muhatadimaruf@iut-dhaka.edu  
**GitHub:** [@noobra1](https://github.com/noobra1)

#### Summary Statistics
| Metric | Value |
|--------|-------|
| Commits | 4 |
| Files Changed | 63 |
| Lines Added | +4,875 |
| Lines Removed | 0 |

#### Commit History
1. `prisma configured` - Prisma ORM setup
2. `task module implemented` - Task backend module
3. `ui setup and landing page` - shadcn/ui components + Landing page
4. `login and sign-up page` - Authentication pages

#### Backend Contributions (353 lines)
| Module | Lines | Description |
|--------|-------|-------------|
| **Tasks Module** | 301 | Task CRUD, assignment, completion, review workflow |
| **Prisma Service** | 52 | Database connection service |

#### Frontend Contributions (4,522 lines)
| Module | Lines | Description |
|--------|-------|-------------|
| **UI Components** | 3,954 | 50+ shadcn/ui components (buttons, cards, dialogs, etc.) |
| **Pages** | 568 | Landing page, Login page, Signup page |

#### Key Features Implemented
- ✅ **Prisma ORM Configuration**
- ✅ **Task Module** (backend CRUD + workflow)
- ✅ **50+ UI Components** (comprehensive shadcn/ui component library)
- ✅ **Landing Page** (marketing/home page)
- ✅ **Login & Signup Pages** (authentication UI)

---

### 3. samiulislam22 (Samiul Islam)
**Email:** tony32950@gmail.com  
**GitHub:** [@samiulislam22](https://github.com/samiulislam22)

#### Summary Statistics
| Metric | Value |
|--------|-------|
| Commits | 4 |
| Files Changed | 23 |
| Lines Added | +1,244 |
| Lines Removed | 0 |

#### Commit History
1. `User module` - User backend module
2. `implemented room module` - Room backend module
3. `final api confiq and initial component setup` - API configuration
4. `added task page and some task modals` - Task management UI

#### Backend Contributions (532 lines)
| Module | Lines | Description |
|--------|-------|-------------|
| **Users Module** | 279 | User CRUD, profile management |
| **Rooms Module** | 253 | Room CRUD, member management |

#### Frontend Contributions (712 lines)
| Module | Lines | Description |
|--------|-------|-------------|
| **Modal Components** | 241 | ApproveAssignTaskModal, ReviewTaskModal |
| **Other Components** | 223 | AppLayout, NavLink, ProtectedRoute, StatusPill, RoleBadge |
| **Pages** | 197 | Tasks page |
| **API Client** | 51 | API service functions |

#### Key Features Implemented
- ✅ **User Module** (backend user management)
- ✅ **Room Module** (backend room management)
- ✅ **API Client Setup** (frontend HTTP services)
- ✅ **Task Page** (task management UI)
- ✅ **Task Modals** (approve, assign, review)
- ✅ **Layout Components** (AppLayout, NavLink, ProtectedRoute)

---

### 4. Sheikh Mosheul Akbar
**Email:** sheikhakbar@iut-dhaka.edu  
**GitHub:** [@sheikh2583](https://github.com/sheikh2583)

#### Summary Statistics
| Metric | Value |
|--------|-------|
| Commits | 4 |
| Files Changed | 28 |
| Lines Added | +1,026 |
| Lines Removed | -441 |

#### Commit History
1. `Implemented the department module` - Department backend module
2. `implemented chatsystem using websocket` - Real-time chat system
3. `api configuration and index setup` - Frontend API setup
4. `added admin page and assignmayor modal` - Admin functionality

#### Backend Contributions (441 lines)
| Module | Lines | Description |
|--------|-------|-------------|
| **Chat Module** | 309 | WebSocket-based real-time chat system |
| **Departments Module** | 132 | Department management |

#### Frontend Contributions (585 lines)
| Module | Lines | Description |
|--------|-------|-------------|
| **Modal Components** | 271 | AssignMayorModal, CompleteTaskModal |
| **Pages** | 153 | AdminRooms page |
| **API Client** | 30 | API configuration |
| **Other** | 131 | Index setup, configurations |

#### Key Features Implemented
- ✅ **Chat System** (WebSocket real-time messaging)
- ✅ **Department Module** (backend department management)
- ✅ **Admin Rooms Page** (room administration UI)
- ✅ **AssignMayor Modal** (mayor assignment functionality)
- ✅ **CompleteTask Modal** (task completion UI)
- ✅ **API Configuration** (frontend HTTP setup)

---

## Contribution Distribution

### By Lines of Code

| Contributor | Lines | Percentage |
|------------|-------|------------|
| RoyaleBengalTiger | 23,757 | **76.9%** |
| noobra1 | 4,875 | **15.8%** |
| samiulislam22 | 1,244 | **4.0%** |
| Sheikh Mosheul Akbar | 1,026 | **3.3%** |

### By Area (Backend vs Frontend)

| Contributor | Backend | Frontend | Backend % | Frontend % |
|------------|---------|----------|-----------|------------|
| RoyaleBengalTiger | 13,846 | 9,911 | 58.3% | 41.7% |
| noobra1 | 353 | 4,522 | 7.2% | 92.8% |
| samiulislam22 | 532 | 712 | 42.8% | 57.2% |
| Sheikh Mosheul Akbar | 441 | 585 | 43.0% | 57.0% |

---

## Feature Ownership Matrix

| Feature | Primary Contributor | Supporting |
|---------|-------------------|------------|
| **Project Setup & Architecture** | RoyaleBengalTiger | — |
| **Authentication (JWT)** | RoyaleBengalTiger | — |
| **Database Schema (Prisma)** | RoyaleBengalTiger | noobra1 |
| **User Module** | samiulislam22 | — |
| **Room Module** | samiulislam22 | — |
| **Task Module** | noobra1 | samiulislam22 |
| **Department Module** | Sheikh Mosheul Akbar | — |
| **Chat System (WebSocket)** | Sheikh Mosheul Akbar | — |
| **UI Component Library** | noobra1 | — |
| **Landing Page** | noobra1 | — |
| **Login/Signup Pages** | noobra1 | — |
| **User Dashboard** | RoyaleBengalTiger | — |
| **Mayor Dashboard** | RoyaleBengalTiger | — |
| **Admin Rooms Page** | Sheikh Mosheul Akbar | — |
| **Task Page & Modals** | samiulislam22 | Sheikh Mosheul Akbar |

---

## Technology Stack Contributions

| Technology | Primary Contributor |
|------------|-------------------|
| NestJS Backend Setup | RoyaleBengalTiger |
| Prisma ORM | RoyaleBengalTiger, noobra1 |
| PostgreSQL Schema | RoyaleBengalTiger |
| JWT Authentication | RoyaleBengalTiger |
| WebSocket Chat | Sheikh Mosheul Akbar |
| React Frontend Setup | RoyaleBengalTiger |
| Vite Build System | RoyaleBengalTiger |
| Tailwind CSS | RoyaleBengalTiger, noobra1 |
| shadcn/ui Components | noobra1 |

---

## Project Timeline

| Date | Contributor | Activity |
|------|-------------|----------|
| 2026-01-19 | RoyaleBengalTiger | Initial project setup |
| 2026-01-19 | RoyaleBengalTiger | Database schema & authentication |
| 2026-01-20 | Sheikh Mosheul Akbar | Department module |
| 2026-01-21 | noobra1 | Prisma configuration |
| 2026-01-22 | samiulislam22 | User module |
| 2026-01-23 | noobra1 | Task module |
| 2026-01-24 | samiulislam22 | Room module |
| 2026-01-25 | Sheikh Mosheul Akbar | Chat system (WebSocket) |
| 2026-01-26 | Sheikh Mosheul Akbar | API configuration |
| 2026-01-26 | samiulislam22 | API config & components |
| 2026-01-27 | noobra1 | UI setup & Landing page |
| 2026-01-27 | noobra1 | Login & Signup pages |
| 2026-01-27 | RoyaleBengalTiger | Frontend setup |
| 2026-01-28 | RoyaleBengalTiger | Dashboards & modals |
| 2026-01-28 | samiulislam22 | Task page & modals |
| 2026-01-28 | Sheikh Mosheul Akbar | Admin page & AssignMayor modal |

---

## Gamma Prompt Ready Summary

**For Contribution Breakdown Slide:**

### Team Overview
> **Dormocracy 2.0** was built by a team of **4 contributors** with **16 commits** totaling **30,902 lines of code** across **176 files**.

### Individual Highlights

> **🏆 RoyaleBengalTiger (Siam Sifat)** - *Project Lead & Architect*
> - 76.9% of codebase (23,757 lines)
> - Project setup, authentication, database schema, dashboards
> - Full-stack: 58% Backend + 42% Frontend

> **🎨 noobra1 (Muhtadi Maruf)** - *Frontend & Task Specialist*
> - 15.8% of codebase (4,875 lines)
> - 50+ UI components, landing page, login/signup, task module
> - Frontend-focused: 93% Frontend + 7% Backend

> **🔧 samiulislam22 (Samiul Islam)** - *Backend Modules & Integration*
> - 4.0% of codebase (1,244 lines)
> - User module, room module, task page, API client
> - Balanced: 43% Backend + 57% Frontend

> **💬 Sheikh Mosheul Akbar** - *Real-time & Admin Features*
> - 3.3% of codebase (1,026 lines)
> - WebSocket chat, department module, admin page
> - Balanced: 43% Backend + 57% Frontend

---

*Generated on: 2026-01-29*

# Dormocracy 2.0 - Contribution Breakdown

## Overview

This document provides a detailed breakdown of individual contributions to the Dormocracy 2.0 project, intended for creating a contribution slide presentation.

---

## Contributors Summary

| Contributor | Email | Commits | Files Changed | Lines Added | Lines Removed |
|------------|-------|---------|---------------|-------------|---------------|
| Sheikh Mosheul Akbar | sheikhakbar@iut-dhaka.edu | 1 | 156 | +30,461 | 0 |
| copilot-swe-agent[bot] | Copilot@users.noreply.github.com | 1 | 0 | 0 | 0 |

---

## Detailed Contribution Breakdown

### Sheikh Mosheul Akbar
**Email:** sheikhakbar@iut-dhaka.edu

#### Total Contribution
- **Commits:** 1 (Initial project setup - "added admin page and assignmayor modal")
- **Total Files Changed:** 156
- **Total Lines Added:** +30,461
- **Total Lines Removed:** 0

#### Backend Development (14,731 lines)

| Module | Lines | Description |
|--------|-------|-------------|
| **Auth Module** | 334 | JWT authentication, login/register endpoints, role-based guards |
| **Rooms Module** | 253 | Room management, mayor assignment functionality |
| **Tasks Module** | 301 | Task creation, assignment, completion, review workflow |
| **Users Module** | 279 | User management, profile updates |
| **Prisma Service** | 52 | Database connection and service layer |
| **DB Schema & Migrations** | 409 | PostgreSQL schema design, 4 migrations |
| **Config & Setup** | ~12,000+ | Package dependencies, ESLint, TypeScript configs |

**Key Backend Files:**
- `backend/src/auth/auth.service.ts` - 166 lines (Authentication logic)
- `backend/src/tasks/tasks.service.ts` - 184 lines (Task workflow management)
- `backend/src/users/users.service.ts` - 142 lines (User management)
- `backend/src/rooms/rooms.service.ts` - 109 lines (Room management)
- `backend/prisma/schema.prisma` - 167 lines (Database schema)

#### Frontend Development (15,730 lines)

| Module | Lines | Description |
|--------|-------|-------------|
| **UI Components** | 3,954 | 50+ reusable shadcn/ui components |
| **Pages** | 1,279 | 7 main application pages |
| **Modal Components** | 616 | 5 task/admin modal dialogs |
| **Hooks** | 205 | Custom React hooks (toast, mobile detection) |
| **API Client** | 81 | HTTP client and API service layers |
| **Contexts** | 71 | Authentication context provider |
| **Config & Setup** | ~9,500+ | Package dependencies, Vite, Tailwind configs |

**Key Frontend Files:**
- `frontend/src/components/ui/sidebar.tsx` - 637 lines (Navigation sidebar)
- `frontend/src/components/ui/chart.tsx` - 303 lines (Data visualization)
- `frontend/src/pages/Landing.tsx` - 227 lines (Landing page)
- `frontend/src/pages/Signup.tsx` - 206 lines (User registration)
- `frontend/src/lib/http.ts` - 200 lines (HTTP client utilities)
- `frontend/src/pages/MayorDashboard.tsx` - 198 lines (Mayor dashboard)
- `frontend/src/pages/Tasks.tsx` - 197 lines (Task management page)

---

## Contribution by Area

### Architecture Overview

```
Dormocracy 2.0
├── Backend (NestJS + Prisma + PostgreSQL)
│   ├── Authentication & Authorization
│   ├── User Management
│   ├── Room Management
│   ├── Task Management System
│   └── Database Schema
│
└── Frontend (React + Vite + Tailwind + shadcn/ui)
    ├── Landing Page
    ├── Authentication (Login/Signup)
    ├── Dashboard
    ├── Mayor Dashboard
    ├── Admin Rooms Management
    ├── Task Management
    └── 50+ Reusable UI Components
```

### Percentage Breakdown

| Area | Lines | Percentage |
|------|-------|------------|
| Frontend | 15,730 | 51.6% |
| Backend | 14,731 | 48.4% |
| **Total** | **30,461** | **100%** |

---

## Key Features Implemented

### By Sheikh Mosheul Akbar

1. **Authentication System**
   - JWT-based authentication
   - Role-based access control (Admin, Mayor, User)
   - Protected routes

2. **User Management**
   - User registration and login
   - Profile management
   - Role assignment

3. **Room Management**
   - CRUD operations for rooms
   - Mayor assignment modal
   - Admin room management page

4. **Task Management System**
   - Task creation workflow
   - Task assignment and approval
   - Task completion and review
   - Status tracking (Pending, Assigned, In Progress, Completed, Reviewed)

5. **Frontend UI/UX**
   - Modern responsive design with Tailwind CSS
   - 50+ shadcn/ui components
   - Dashboard visualizations
   - Toast notifications

6. **Database Design**
   - User, Room, Task, and Chat schemas
   - 4 database migrations
   - Relationship modeling

---

## Technology Stack Contributions

| Technology | Contributor |
|------------|-------------|
| NestJS Backend | Sheikh Mosheul Akbar |
| Prisma ORM | Sheikh Mosheul Akbar |
| React Frontend | Sheikh Mosheul Akbar |
| Vite Build System | Sheikh Mosheul Akbar |
| Tailwind CSS Styling | Sheikh Mosheul Akbar |
| shadcn/ui Components | Sheikh Mosheul Akbar |
| JWT Authentication | Sheikh Mosheul Akbar |
| PostgreSQL Schema | Sheikh Mosheul Akbar |

---

## Timeline

| Date | Contributor | Activity |
|------|-------------|----------|
| 2026-01-26 | Sheikh Mosheul Akbar | Initial project setup with full backend and frontend |
| 2026-01-29 | copilot-swe-agent[bot] | Planning documentation |

---

## Gamma Prompt Ready Summary

**For Contribution Breakdown Slide:**

> **Sheikh Mosheul Akbar** is the primary contributor to Dormocracy 2.0, responsible for:
> - **30,461 lines of code** across **156 files**
> - **Full-stack development**: 51.6% Frontend + 48.4% Backend
> - **Core features**: Authentication, User Management, Room Management, Task Workflow System
> - **Tech stack setup**: NestJS, React, Prisma, PostgreSQL, Tailwind CSS, shadcn/ui
> - **Database design**: Complete schema with 4 migrations
> - **50+ UI components** and **7 application pages**

---

*Generated on: 2026-01-29*

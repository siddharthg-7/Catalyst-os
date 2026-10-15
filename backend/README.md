# CatalystOS — Backend Service

Node.js + Express 4 + TypeScript API Gateway and Autonomous Multi-Agent Service layer for CatalystOS.

---

## 📂 Directory Structure

```text
backend/
├── src/
│   ├── config/             # Environment validation, database client & pool configuration
│   ├── controllers/        # Domain request handlers (startup, initiatives, approvals, team)
│   ├── middleware/         # Authentication, rate limiting, and RBAC permission guards
│   ├── models/             # Domain TypeScript interfaces and business entity definitions
│   ├── routes/             # Express API routers (/api, /api/voice, /api/v1)
│   ├── services/           # Re-exports of business logic services
│   ├── utils/              # Helper utilities
│   ├── app.ts              # Express application configuration & middleware stack
│   └── server.ts           # Standalone HTTP server bootstrap & DB pre-connect
├── routes/                 # Legacy Express API route implementations
├── services/               # 38+ Core enterprise micro-services & orchestrators
│   ├── approvalService.ts  # Human-in-the-loop deliverable review & founder gate
│   ├── dbService.ts        # Resilient Neon PostgreSQL / Prisma connection manager
│   ├── geminiService.ts    # Google Gemini 2.5 Flash executive reasoning engine
│   ├── multiAgentCouncil.ts# C-Suite board consensus voting & deliberation loop
│   ├── orchestrationService.ts # Master 5-step CEO planner-executor orchestrator
│   └── permissionService.ts# Unified RBAC permission enforcement
├── py_service/             # Autonomous Python FastAPI LangGraph microservice
├── voice/                  # Voice Studio & Conversational Speech API router
├── .env.example            # Backend environment variables template
├── package.json            # Backend dependencies & npm scripts
├── tsconfig.json           # Backend TypeScript configuration
└── state.ts                # In-memory transient session state fallback
```

---

## 🏃 Running Backend Independently

From this directory (`backend/`):

```bash
# 1. Install dependencies
npm install

# 2. Start Express development server with live reload
npm run dev
```

The server will start at **`http://localhost:3000`**.
- **Health Check:** `http://localhost:3000/health`
- **Readiness Probe:** `http://localhost:3000/ready`
- **Core API:** `http://localhost:3000/api`

---

## 🛠️ Where to Make Changes

| When you want to modify... | Go to file / folder... |
| :--- | :--- |
| **API Endpoints & Routing** | `src/routes/api.ts` or `routes/api.ts` |
| **Controllers & Request Handling** | `src/controllers/` |
| **Business Logic & Services** | `services/` |
| **Database Models & Prisma Schema** | `../prisma/schema.prisma` & `services/dbService.ts` |
| **Auth & Permissions (RBAC)** | `src/middleware/` & `services/permissionService.ts` |
| **Voice & Speech Service** | `voice/routes.ts` & `services/sttService.ts` / `ttsService.ts` |
| **Multi-Agent Orchestration** | `services/multiAgentOrchestratorService.ts` & `services/multiLevelOrchestrator.ts` |

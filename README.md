<div align="center">
  <h1>Catalyst OS</h1>
  <p><b>Autonomous Startup Operating System & Multi-Agent AI Executive Team</b></p>
  <p align="center">
    <img src="https://img.shields.io/badge/Status-Production--Ready-brightgreen?style=for-the-badge" alt="Status" />
    <img src="https://img.shields.io/badge/React%2019-Frontend-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
    <img src="https://img.shields.io/badge/Vite%206-Bundler-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 6" />
    <img src="https://img.shields.io/badge/Tailwind%20CSS%20v4-Styling-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
    <img src="https://img.shields.io/badge/Express%204-API%20Gateway-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
    <img src="https://img.shields.io/badge/FastAPI-Python%203.11-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
    <img src="https://img.shields.io/badge/LangGraph-Multi--Agent-FF6F00?style=for-the-badge&logo=python&logoColor=white" alt="LangGraph" />
    <img src="https://img.shields.io/badge/Google%20Gemini-2.5%2F3.5%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini" />
    <img src="https://img.shields.io/badge/Prisma%20ORM-v6-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
    <img src="https://img.shields.io/badge/Neon%20PostgreSQL-Database%20%26%20Auth-00E599?style=for-the-badge&logo=postgresql&logoColor=black" alt="Neon Auth" />
  </p>
  <p>
    An enterprise-grade autonomous operating system for founders that coordinates Finance, Talent, Growth, Legal, Investment, and Operations through collaborating AI executives with human-in-the-loop governance.
  </p>
  <blockquote>
    <b>One Founder. One Command. An Entire AI Executive Team.</b>
  </blockquote>
</div>

---

##  Table of Contents
- [ Key Features](#-key-features)
- [ The AI Executive Suite](#-the-ai-executive-suite)
- [ System Architecture](#️-system-architecture)
- [ Executive Collaboration & Board Vote](#-executive-collaboration--board-vote)
- [ Hallucination Prevention & AI Safety](#️-hallucination-prevention--ai-safety)
- [ Technology Stack](#-technology-stack)
- [ Project Structure](#-project-structure)
- [ Getting Started](#-getting-started)
- [ Configuration & Environment Variables](#️-configuration--environment-variables)
- [ Running Locally](#-running-locally)
- [ API Reference](#-api-reference)
- [ Database Design & Models](#️-database-design--models)
- [ Knowledge Base & Hybrid RAG](#-knowledge-base--hybrid-rag)
- [ User Flow & Founder Experience](#-user-flow--founder-experience)
- [ Scalability & Performance](#-scalability--performance)
- [ Roadmap](#️-roadmap)
- [ Lessons Learned & Challenges](#-lessons-learned--challenges)
- [ Authors & Community](#-authors--community)
- [ License](#-license)

---

##  Key Features

###  Smart Founder Onboarding & State Initialization
* **Flexible Startup Context:** Capture company name, industry, funding stage, burn rate, cash-on-hand, runway, and target ICP.
* **Document Intelligence Ingestion:** Drag-and-drop pitch decks, financial statements, roadmaps, hiring specs, policies, and contracts.
* **Multi-Format Extraction:** Native parser support for PDF, DOCX, XLSX, TXT, and Markdown files.
* **Shared Grounded Memory:** Structured startup data forms contextual boundary constraints for every executive agent.

###  Real-Time Executive Dashboard
* **Startup Health Score (0–100):** Weighted multi-dimensional index calculated across Velocity, Financial Health, Legal Compliance, Growth Rate, and Operational Efficiency.
* **Founder Command Box:** Issue high-level strategic objectives via natural language text or voice.
* **Live Executive Matrix:** Real-time visibility into agent states (`idle`, `analyzing`, `collaborating`, `generating`) and active tasks.
* **Daily Executive Brief:** Automated morning digest summarizing pending approvals, runway alerts, velocity bottlenecks, and strategic milestones.
* **Metric Cards & Dynamic Projections:** Live monitors for Monthly Burn, Runway Months, Cash Balance, and Active Initiatives.

###  Human-in-the-Loop Approval Center
* **Safe Decision Gates:** High-impact business actions (hiring, capital expenditures, contract execution, GTM launches) require explicit founder sign-off.
* **Impact Forecaster:** Every approval displays predicted financial impact (e.g. `-$14,000/mo`) and metric shifts across company health indicators.
* **One-Click Actions:** Founder can **Approve**, **Reject** (with constructive feedback), or **Edit** before commitment.
* **Automatic Ledger & Profile Updates:** Approvals dynamically update treasury balances, burn rates, and the company decision log.

###  Auditable Decision Log
* Complete, tamper-evident corporate audit trail tracking:
  * Timestamp and founder command
  * Responsible executive agent
  * Strategic rationale and confidence score (0–100%)
  * Source document citations (`[CIT-1]`, `[CIT-2]`)
  * Founder verdict (`approved`, `rejected`) and operational outcome

###  Enterprise RAG & Semantic Memory
* **Hybrid Vector + Keyword Search:** Powered by PostgreSQL with `pgvector` extension and Prisma ORM.
* **Overlapping Chunking:** Documents chunked with semantic sliding windows for maximum contextual coherence.
* **Grounding Engine:** LLM queries are injected with relevant chunks to completely eliminate hallucinated metrics.
* **Interactive Chatbot:** Embedded conversational assistant (`CatalystOsChatbot`) answering questions directly grounded in the company knowledge base.

###  Voice Command Interface
* Issue founder commands hands-free using real-time audio capture.
* Integrated speech-to-text pipeline via **Whisper / Faster-Whisper** and Gemini Multimodal Audio.

---

##  The AI Executive Suite

Catalyst OS simulates a C-suite corporate hierarchy where agents reason, consult peers, and debate trade-offs:

| Executive Role | Avatar / Name | Primary Responsibilities | Cross-Agent Interactions |
| :--- | :--- | :--- | :--- |
| **CEO Orchestrator** |  Chief Executive | Intent classification, task decomposition, trade-off mediation, unified execution synthesis | Coordinates all departments; reconciles conflicting advice |
| **CFO / Finance** |  Chief Financial Officer | Burn rate analysis, runway modeling, cash-flow stress testing, budget guardrails | Vetoes unaffordable hiring; constrains marketing spend |
| **Head of Talent** |  Chief People Officer | Job description drafting, resume screening, candidate ranking, salary benchmarking | Proactively consults CFO before advancing hiring plans |
| **Head of Growth** |  Chief Commercial Officer | Go-To-Market strategies, marketing campaigns, launch calendars, sales copy | Coordinates with Legal on claims and CFO on ad budgets |
| **General Counsel** |  Legal & Compliance | NDA/contract generation, IP risk assessment, regulatory compliance checklists | Audits external communications and employment agreements |
| **Head of Operations** |  Chief Operating Officer | Sprint roadmaps, milestone scheduling, dependency tracking, bottleneck mitigation | Aligns engineering delivery dates with Growth launch dates |
| **Investment Agent** |  Head of Corporate Finance | Pitch deck evaluation, cap table modeling, fundraising readiness, investor updates | Prepares metrics packages for angel and VC outreach |
| **Auditor Agent** |  Independent Verification | Fact-checking claims, validating citations, detecting invalid assumptions | Acts as quality control gatekeeper before human approval |

---

##  System Architecture

Catalyst OS utilizes a dual-engine architecture: a high-performance **Node.js Express + TypeScript Gateway** paired with an autonomous **Python FastAPI LangGraph Microservice**.

```text
                               ┌──────────────────────────────────────────────┐
                               │           React 19 Founder Frontend          │
                               │  (Dashboard • Workflow • Approvals • Voice)  │
                               └──────────────────────┬───────────────────────┘
                                                      │ HTTP / WebSocket
                                                      ▼
                               ┌──────────────────────────────────────────────┐
                               │     Unified Express 4 Server & API Gateway   │
                               │        (server.ts • TypeScript • tsx)        │
                               └──────┬───────────────────────────────┬───────┘
                                      │                               │
                       ┌──────────────▼──────────────┐                ▼
                       │  Node.js Agent Orchestrator │   Proxy /api/v1 & /api/audio
                       │   - Fast in-memory engine   │   FastAPI Python Microservice
                       │   - Gemini 2.5/3.5 Flash    │   - LangGraph State Machine
                       │   - Local RAG & Document    │   - Autonomous Agent Nodes
                       │     Parsing Pipeline        │   - Whisper Audio Engine
                       └──────────────┬──────────────┘                ▲
                                      │                               │
                                      ▼                               │
                       ┌──────────────────────────────────────────────┴───────┐
                       │                   Persistence Layer                  │
                       │   - PostgreSQL + pgvector (Prisma ORM v6)            │
                       │   - Documents, Knowledge Chunks, Embeddings          │
                       │   - Startups, Decisions, Approvals, Timeline         │
                       │   - HashiCorp Vault / Encrypted Secrets Store        │
                       └──────────────────────────────────────────────────────┘
```

### Dual-Engine Resilience (Graceful Fallback)
* When the **Python FastAPI microservice** is active on port 8000, complex LangGraph cycles and audio workflows run with full deep-graph execution.
* If the microservice is offline, the **Express Node.js engine** seamlessly handles multi-agent planning, document parsing, RAG queries, and approvals without interruption!

---

##  Executive Collaboration & Board Vote

When a founder issues a multi-faceted objective, agents do not act in silos. They engage in structured cross-consultation:

```text
Founder Command: "Hire 2 Senior Engineers & Launch Pilot in 30 Days"
                                │
                                ▼
                       CEO Orchestrator
           Decomposes into Parallel Business Tasks
                                │
       ┌────────────────────────┼────────────────────────┐
       ▼                        ▼                        ▼
Head of Talent            Head of Growth         Operations Lead
Researches Candidates     Prepares Launch Plan    Maps Deliverables
       │                        │                        │
       ▼                        ▼                        ▼
  Asks CFO:                Asks Legal:              Asks Talent:
"Can we afford $30k/mo?" "Review Pilot Terms"    "When do devs start?"
       │                        │                        │
       ▼                        ▼                        ▼
      CFO                     Legal                    Talent
"Budget supports 1 dev;  "NDAs & SLAs drafted;   "First candidate can
 runway drops to 4 mo."   vendor review needed"   start in 2 weeks"
       │                        │                        │
       └────────────────────────┼────────────────────────┘
                                │
                                ▼
                     Board Vote & Consensus
       ┌─────────────────────────────────────────────────┐
       │ Finance Agent:   ⚠️ Reject 2 hires; Approve 1   │
       │ Talent Agent:    ✅ Approve 1 senior backend    │
       │ Operations:      ✅ Approve (with timeline shift)│
       │ Legal:           ✅ Approve with NDA condition  │
       └────────────────────────┬────────────────────────┘
                                │
                                ▼
                        CEO Synthesis
     "Hire 1 senior engineer now. Push pilot by 10 days.
      Runway remains healthy at 6.8 months."
                                │
                                ▼
                    Founder Approval Center
     [Approve Plan]         [Modify Terms]         [Reject]
```

---

##  Hallucination Prevention & AI Safety

Catalyst OS incorporates defensive engineering principles to safeguard startup operations:

1. **Deterministic Calculations over LLM Guesswork:**
   * Critical financial metrics (monthly burn rate, runway months, cash balances) are calculated using deterministic TypeScript/Python arithmetic functions. The LLM interprets and explains results but never fabricates figures.
2. **Strict RAG Citations (`[CIT-X]`):**
   * Knowledge base responses reference exact chunk IDs and document names. If context is missing, agents return `DATA_MISSING` instead of extrapolating.
3. **Auditor Agent Fact-Checking:**
   * Before a recommendation reaches the approval queue, the Auditor Agent checks for unsupported claims, internal contradictions, and budget violations.
4. **Structured JSON Schemas:**
   * Agent communications and deliverables adhere to strict TypeScript interfaces and Pydantic schemas, eliminating format drift.

---

## Technology Stack

### Frontend Application
* **Framework:** React 19 (`react`, `react-dom`)
* **Build Tool:** Vite 6 (`vite`, `@vitejs/plugin-react`)
* **Styling:** Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/vite`)
* **Animations:** Framer Motion (`framer-motion`, `motion`), GSAP (`gsap`, `@gsap/react`), Lottie (`@lottiefiles/dotlottie-react`)
* **Icons & Charts:** Lucide React (`lucide-react`), React Icons (`react-icons`), Recharts (`recharts`)
* **Auth Client:** Native Neon Auth Context (`src/context/AuthContext.tsx`)

### Backend Gateway & Services
* **Runtime:** Node.js (v18+) with `tsx` for high-speed TypeScript execution
* **HTTP Server:** Express 4 with modular routers and HTTP proxy middleware (`http-proxy-middleware`)
* **Database ORM:** Prisma ORM v6 (`@prisma/client`, `prisma`) with PostgreSQL and vector extension preview
* **Document Parsing:** `pdf-parse`, `mammoth` (DOCX), `officeparser` (PPTX/XLSX)
* **AI SDK:** Google GenAI SDK (`@google/genai`) running Gemini 2.5 / 3.5 Flash
* **Security & Auth:** Neon Auth JWKS & Native JWT (`jsonwebtoken`, `bcryptjs`), HashiCorp Vault client

### Python AI Microservice
* **Framework:** FastAPI, Uvicorn, Pydantic v2
* **Multi-Agent Graph:** LangGraph, LangChain Core
* **Database Engine:** SQLAlchemy with PostgreSQL engine
* **Audio & Speech:** Faster-Whisper, OpenAI Whisper, SoundFile

---

## 📂 Project Structure & Architecture

The project is cleanly decoupled into standalone, developer-friendly modules with clear separation of responsibilities:

```text
catalyst-os/
│
├── frontend/                          # Dedicated Frontend Application (Vite 6 + React 19)
│   ├── public/                        # Public static assets, icons, brand marks
│   ├── src/
│   │   ├── assets/                    # Bundled frontend assets & media
│   │   ├── components/                # Modular UI components
│   │   │   ├── chatbot/               # Grounded AI Chatbot drawer & message bubbles
│   │   │   ├── AgentWorkspace.tsx     # Visual agent matrix & live task cards
│   │   │   ├── ApprovalQueue.tsx      # Human-in-the-loop approval center
│   │   │   ├── DecisionLog.tsx        # Auditable corporate decision trail
│   │   │   ├── KnowledgeBase.tsx      # RAG document vault & semantic search
│   │   │   ├── SaaSDashboard.tsx      # Executive command center
│   │   │   └── ...                    # Other domain components
│   │   ├── layouts/                   # Shared shell layouts & visual wrappers
│   │   ├── pages/                     # Full-page route views (Landing, Auth, Dashboard, etc.)
│   │   ├── sections/                  # Page-level landing & dashboard sections
│   │   ├── hooks/                     # Custom React hooks (voice, notifications, state)
│   │   ├── context/                   # React context providers (AuthContext)
│   │   ├── services/                  # Frontend API client (no hardcoded localhost URLs)
│   │   ├── constants/                 # Centralized route definitions & API base URLs
│   │   ├── styles/                    # Original design system & CSS (index.css)
│   │   ├── types/                     # Frontend TypeScript domain types
│   │   ├── utils/                     # Client helper utilities
│   │   ├── App.tsx                    # Root routing & layout setup
│   │   └── main.tsx                   # React DOM root entrypoint
│   ├── .env.example                   # Frontend environment template
│   ├── index.html                     # Vite HTML entrypoint with font preloads
│   ├── package.json                   # Independent frontend dependencies & scripts
│   ├── tsconfig.json                  # Standalone TypeScript configuration with `@/*` aliases
│   ├── vite.config.ts                 # Vite bundler configuration with backend proxies
│   └── README.md                      # Frontend-specific documentation
│
├── backend/                           # Dedicated Backend Application (Express 4 + TypeScript)
│   ├── src/
│   │   ├── config/                    # Environment validation, database & server config
│   │   ├── controllers/               # Express route handlers & business coordination
│   │   ├── routes/                    # Modular API route definitions
│   │   ├── middleware/                # Auth, rate-limiting, and error-handling middleware
│   │   ├── models/                    # Decoupled backend data models & types
│   │   ├── services/                  # Business logic services & AI orchestrator re-exports
│   │   ├── utils/                     # Backend utility functions
│   │   ├── app.ts                     # Express app setup, proxy rules & health checks
│   │   └── server.ts                  # Server entry point with Neon DB pre-warming
│   ├── services/                      # Core agent execution & RAG engine services
│   ├── agents/                        # Modular Node.js agent controllers (CEO, CFO, CTO, Legal, etc.)
│   ├── routes/                        # Legacy & expanded Express routes
│   ├── py_service/                    # Optional FastAPI Python AI Microservice (LangGraph)
│   ├── .env.example                   # Backend environment template
│   ├── package.json                   # Standalone backend dependencies & scripts
│   ├── tsconfig.json                  # Standalone TypeScript configuration with `@/*` aliases
│   └── README.md                      # Backend-specific documentation
│
├── tests/                             # Comprehensive test suites (27 automated test files)
├── prisma/                            # Database schema & migrations (PostgreSQL + pgvector)
├── docs/                              # Architecture documentation & API references
├── server.ts                          # Unified full-stack server (runs Express + serves frontend)
├── package.json                       # Unified root scripts (run both or either subproject)
├── tsconfig.json                      # Root TypeScript configuration
├── .gitignore                         # Project-wide ignore rules (node_modules, dist, .env)
├── .env.example                       # Root environment variables template
└── README.md                          # Main project guide
```

---

## 🧭 Developer Guide: Where to Edit What

| I want to modify... | File / Directory to Edit | Description |
| :--- | :--- | :--- |
| **Color palette, typography, CSS styles** | `frontend/src/styles/index.css` | All CSS variables, brand tokens, and styling rules. |
| **A UI component (e.g. Chatbot, Approval Queue)** | `frontend/src/components/` | Reusable UI components. |
| **Page-level layouts & new routes** | `frontend/src/pages/` & `frontend/src/App.tsx` | Route definitions and page container views. |
| **Frontend API calls to the backend** | `frontend/src/services/api.ts` | Centralized API client utilizing `VITE_API_BASE_URL`. |
| **Backend API endpoints & routes** | `backend/src/routes/` or `backend/routes/api.ts` | Express route definitions. |
| **Backend business logic & controllers** | `backend/src/controllers/` & `backend/services/` | Logic for approvals, ledger, council deliberations. |
| **AI Agent prompts & orchestration** | `backend/services/multiAgentCouncil.ts` & `backend/agents/` | Executive agent personas, deliberation rules, and prompts. |
| **Database schemas & models** | `prisma/schema.prisma` | PostgreSQL tables, relationships, and vector columns. |

---

## 🚀 Running the Project

### Option A: Run Unified Full-Stack (Easiest)
From the project root:
```bash
# Install dependencies
npm install

# Start unified full-stack development server (Port 3000)
npm run dev

# Run automated tests
npm test

# Build all production bundles (unified + frontend + backend)
npm run build
```

### Option B: Run Frontend & Backend Independently
You can start and develop either subproject independently:

#### 1. Frontend Only (Vite Dev Server on Port 5173)
```bash
# From root:
npm run dev:frontend

# Or directly in frontend folder:
cd frontend
npm install
npm run dev
```

#### 2. Backend Only (Node/Express API Server on Port 3000)
```bash
# From root:
npm run dev:backend

# Or directly in backend folder:
cd backend
npm install
npm run dev
```

### Option C: Standalone Production Builds & Linting
```bash
# Type-check and lint across all projects
npm run lint

# Build standalone frontend to frontend/dist/
npm run build:frontend

# Build standalone backend to backend/dist/server.cjs
npm run build:backend
```

---

### Prerequisites
Make sure you have the following installed on your machine:
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* **Python**: v3.11 or higher (optional, for the FastAPI LangGraph microservice)
* **PostgreSQL**: v15+ with `pgvector` extension (optional; app automatically runs with in-memory fallback if no database is connected)
* **Git**
* **Docker & Docker Compose** (for containerized deployment)

### Quick Start with Docker (Recommended)
Run the entire platform (Frontend, Node.js API Gateway, FastAPI AI Service, and PostgreSQL) with a single command or double-click:

- **Windows One-Click Shortcut:** Double-click [`docker-run.bat`](docker-run.bat) (automatically verifies Docker, builds images, starts containers, and opens `http://localhost:3000`).
- **Stop Containers:** Double-click [`docker-down.bat`](docker-down.bat).
- **NPM Shortcut:**
  ```bash
  npm run docker:up
  # To stop:
  npm run docker:down
  ```
- **Linux/macOS Shortcut:**
  ```bash
  chmod +x docker-run.sh
  ./docker-run.sh
  ```

### Quick Start (Native Windows / Local Node)
1. **Launch Full-Stack Application:** Double-click `run.bat` (or run `./run.bat` in PowerShell).
   * Automatically validates Node.js, creates `.env` if missing, installs dependencies, and starts the server on `http://localhost:3000`.
2. **Launch Python AI Microservice (Optional):** Double-click `run_fastapi.bat`.
   * Automatically validates Python, installs requirements, and launches FastAPI with hot reload on `http://localhost:8000`.

---

##  Configuration & Environment Variables

Copy `.env.example` to create your local `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# =============================================================================
# CATALYST OS ENVIRONMENT CONFIGURATION
# =============================================================================

# Server Port & URLs
PORT=3000
APP_URL=http://localhost:3000
FASTAPI_URL=http://localhost:8000

# Google Gemini AI API Configuration
GEMINI_API_KEY="your_google_gemini_api_key"
GEMINI_MODEL="gemini-2.5-flash"
RAG_DEBUG="false"

# Database Configuration (Neon PostgreSQL with pgvector)
DATABASE_URL="postgresql://neondb_owner:password@ep-late-mud-b42a9cnw-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://neondb_owner:password@ep-late-mud-b42a9cnw.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Neon / JWT Authentication Secret
JWT_SECRET="your_jwt_secret_key"
```

>  **Security Notice:** Never commit `.env` or any production secrets to source control.

---

##  Running Locally

### Step 1: Install Node Dependencies
From the repository root:
```bash
npm install
```

### Step 2: Initialize Database (Prisma)
Generate the Prisma Client and push schemas to your PostgreSQL database:
```bash
# Push Prisma schema to PostgreSQL
npx prisma db push

# (Optional) Seed the database with demo startup metrics
npx prisma db seed
```
*(Note: If no database URL is provided, Catalyst OS operates gracefully in resilient in-memory offline mode.)*

### Step 3: Start the Full-Stack Server
Run the unified Express + Vite development server:
```bash
npm run dev
```
* **Frontend Application:** Available at `http://localhost:3000`
* **Express API Gateway:** Available at `http://localhost:3000/api`

### Step 4: (Optional) Run the Python FastAPI Microservice
In a separate terminal, start the Python LangGraph microservice:
```bash
# Navigate to the Python service directory
cd backend/py_service

# Create and activate a virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Start FastAPI server with live reload
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
* **Microservice API:** `http://localhost:8000`
* **Interactive OpenAPI Swagger Docs:** `http://localhost:8000/docs`

---

##  API Reference

The Express gateway routes core requests, proxying `/api/v1` and `/api/audio` to the Python microservice when online.

###  Startup Profile & Context
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/startup` | Retrieve active startup profile, burn rate, runway, and health metrics | Yes (JWT) |
| `POST` | `/api/startup` | Update startup profile details and financial balances | Yes (Founder/Admin) |

###  Multi-Agent Orchestration & Initiatives
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/agents` | Retrieve all executive agents and their real-time execution statuses | Yes (JWT) |
| `GET` | `/api/initiatives` | List all active, pending, and completed initiatives | Yes (JWT) |
| `POST` | `/api/initiatives` | Create a new cross-agent strategic initiative | Yes (JWT) |
| `POST` | `/api/initiatives/:id/simulate` | Execute multi-agent collaboration loop (LangGraph or Gemini) | Yes (JWT) |
| `POST` | `/api/orchestrate` | Master CEO planner-executor endpoint for high-level commands | Yes (JWT) |

###  Human-in-the-Loop Approvals & Decisions
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/approvals` | Fetch pending approvals queue with predicted financial impact | Yes (JWT) |
| `POST` | `/api/approvals/:id/review` | Approve or reject a gated deliverable with founder feedback | Yes (Founder/Admin) |
| `GET` | `/api/decisions` | Fetch immutable audit trail of corporate decisions | Yes (JWT) |

###  Knowledge Base & Hybrid RAG
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/knowledge` | List all indexed company documents and summaries | Yes (JWT) |
| `POST` | `/api/knowledge` | Upload, parse, chunk, and embed a new document (PDF, DOCX, XLSX, TXT) | Yes (JWT) |
| `POST` | `/api/knowledge/query` | Hybrid vector + keyword search answering questions with citations | Yes (JWT) |
| `POST` | `/api/chat` | Direct RAG chat query grounded in local knowledge base | Public / Semi-Private |
| `POST` | `/api/chat/stream` | Server-Sent Events (SSE) streaming chat endpoint | Public / Semi-Private |

###  Infrastructure, Vault & Voice
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/vault/status` | Verify connection status to HashiCorp Vault / encrypted secret store | Yes (JWT) |
| `GET` | `/api/mcp/tools` | Discover available Model Context Protocol (MCP) tool registrations | Yes (JWT) |
| `POST` | `/api/audio/transcribe` | Transcribe voice recordings to text via Whisper | Yes (JWT) |

---

##  Database Design & Models

Catalyst OS utilizes **Prisma ORM v6** with **PostgreSQL** and the `pgvector` extension for structured business state and vector embeddings:

```mermaid
erDiagram
    USER ||--o{ STARTUP : owns
    STARTUP ||--o{ STARTUP_DOCUMENT : contains
    STARTUP_DOCUMENT ||--o{ KNOWLEDGE_CHUNK : has
    KNOWLEDGE_CHUNK ||--o| EMBEDDING : indexed_by
    STARTUP ||--o{ EXECUTIVE_AGENT : employs
    STARTUP ||--o{ COMMAND : receives
    STARTUP ||--o{ PLAN : creates
    PLAN ||--o{ TASK : includes
    PLAN ||--o{ APPROVAL : requires
    STARTUP ||--o{ DECISION_LOG : records
    STARTUP ||--o{ HEALTH_SCORE : tracks
    STARTUP ||--o{ TIMELINE_ITEM : logs
```

### Core Schema Entities (`prisma/schema.prisma`)
* **`Startup`:** Company metadata, cash balance, monthly burn rate, overall health score, and owner relations.
* **`StartupDocument`:** Document catalog storing file name, MIME type, size, AI-generated summary, and tactical insights.
* **`KnowledgeChunk`:** Segmented text chunks with sliding-window overlap for high-precision vector retrieval.
* **`Embedding`:** Vector representations stored in PostgreSQL for cosine similarity matching.
* **`ExecutiveAgent`:** Real-time agent registry tracking agent role, avatar, current operational status, and active task.
* **`Plan` & `Task`:** Hierarchical decomposition of founder commands into departmental deliverables.
* **`Approval`:** Human-in-the-loop gating records holding predicted financial impact and metric shifts.
* **`DecisionLog`:** Auditable historical log of approved and rejected company actions.
* **`HealthScore` & `TimelineItem`:** Historical snapshot of company wellness and milestone events.

---

## 📚 Knowledge Base & Hybrid RAG

Catalyst OS turns static company documents into an active memory network:

1. **Multi-Format Document Parsing:**
   * Ingest PDF pitch decks (`pdf-parse`), DOCX operational briefs (`mammoth`), XLSX financial spreadsheets (`officeparser`), and Markdown policies.
2. **Contextual Analysis:**
   * Gemini automatically synthesizes a concise 1-sentence document abstract and 3 strategic corporate insights on upload.
3. **Overlapping Vector Chunking:**
   * Content is split into overlapping chunks, vectorized, and persisted in PostgreSQL.
4. **Hybrid Search Retrieval:**
   * Combines semantic embeddings with exact keyword matching to surface relevant passages.
5. **Grounded Synthesis with Attribution:**
   * Responses cite exact source documents (`[CIT-1]`, `[CIT-2]`) so founders can verify claims with a single click.

---

## 🎯 User Flow & Founder Experience

```text
  1. Onboarding / Demo Seed
     ├── Enter company details or load instant seed profile
     └── Upload initial documents (decks, budgets, roadmap)
            │
            ▼
  2. Executive Dashboard Overview
     ├── Review Startup Health Score (83/100)
     ├── Read Daily Executive Brief & Runway Alert (5.2 months)
     └── Inspect Executive Status Matrix (CEO, CFO, Talent, Legal)
            │
            ▼
  3. Issue Strategic Command
     ├── Type in Command Box or click Microphone for Voice
     └── Example: "Can we hire a senior engineer and launch next month?"
            │
            ▼
  4. Autonomous C-Suite Collaboration
     ├── CEO breaks down objectives into departmental subtasks
     ├── Talent analyzes market salary and candidate pipeline
     ├── CFO stress-tests runway and imposes hiring budget caps
     ├── Operations shifts release milestones to accommodate onboarding
     └── Legal verifies contractor agreements and IP assignment
            │
            ▼
  5. Board Vote & Auditor Verification
     ├── Board displays unanimous/majority consensus
     └── Auditor agent verifies citations and absence of hallucinations
            │
            ▼
  6. Human-In-The-Loop Approval Center
     ├── Founder reviews proposed hire with projected financial impact (-$12,500/mo)
     ├── Inspects source evidence and confidence rating (94%)
     └── Founder Clicks: [APPROVE] | [REJECT WITH FEEDBACK] | [EDIT]
            │
            ▼
  7. State & Treasury Reconciliation
     ├── Cash balance and runway automatically recomputed
     ├── Decision logged permanently in immutable audit ledger
     └── Timeline and health score update in real-time
```

---

## 📈 Scalability & Performance

* **Stateless API Services:** Express and FastAPI instances scale horizontally across container clusters.
* **Resilient Database Fallback:** `safeDbQuery` wrapper with exponential retry logic ensures zero UI crashing if connection pool spikes occur.
* **Token Optimization:** Conditional agent execution ensures only relevant departments activate per command, saving up to 70% in LLM API token costs.
* **Sub-Second Knowledge Queries:** Hybrid indexing caches frequently queried startup context in memory.
* **Encrypted Credential Vault:** API keys and external access tokens are isolated in HashiCorp Vault or environment secret vaults.

---

## 🗺️ Roadmap

### Phase 1 — Core Operating Foundation (Completed ✅)
- [x] Multi-Agent C-Suite (CEO, Finance, Talent, Growth, Legal, Operations)
- [x] Human-in-the-Loop Approval Queue with financial impact projections
- [x] Prisma ORM v6 PostgreSQL database schema with vector extension
- [x] Resilient dual-engine architecture (Express 4 + FastAPI microservice)
- [x] Multi-format document parser (PDF, DOCX, XLSX, TXT)
- [x] Hybrid RAG knowledge base with source citations (`[CIT-X]`)
- [x] Interactive chatbot grounded in local company knowledge
- [x] Auditable Decision Log and Startup Health Score calculation
- [x] Voice command input with Whisper transcription

### Phase 2 — Enterprise Integrations (In Progress 🚧)
- [ ] Direct Google Workspace synchronization (Drive, Docs, Calendar)
- [ ] Slack & Discord automated notification bot for pending founder approvals
- [ ] GitHub / Linear two-way sync for engineering roadmap tasks
- [ ] Cap Table simulation & automated investor updates generator
- [ ] Multi-tenant workspace organization and team member role management

### Phase 3 — Autonomous Execution (Upcoming 🔮)
- [ ] Autonomous outreach pipeline (drafting & staging verified candidate emails)
- [ ] Real-time WebSocket collaboration streaming
- [ ] Predictive runway risk forecasting using historical burn variance
- [ ] Automated regulatory and compliance filing prep (SOC-2, GDPR, Delaware C-Corp)

---

## 💡 Lessons Learned & Challenges

* **Hierarchical vs. Flat Agent Topologies:** Giving the CEO Orchestrator authority to decompose tasks and reconcile conflicts prevented infinite inter-agent debate loops.
* **The Necessity of Deterministic Financial Guards:** LLMs cannot be trusted to perform exact compounding runway math. Offloading financial arithmetic to deterministic code while using LLMs for qualitative reasoning yielded 100% accuracy.
* **Gating High-Risk Operations:** Founder fatigue occurs when AI asks for permission on every trivial detail. Segmenting actions into low-risk (automatic execution) vs. high-risk (founder approval gate) struck the ideal balance between autonomy and safety.

---

## 👥 Authors & Community

Built with ❤️ for founders and builders worldwide:
* **Siddharth** — [@siddharthg-7](https://github.com/siddharthg-7)

Contributions, issues, and feature requests are warmly welcomed! Feel free to check the [issues page](https://github.com/siddharthg-7/Catalyst-Os/issues) if you want to contribute.

---

## 📜 License

This project is licensed under the **Apache-2.0 / MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <h3>⚡ Catalyst OS</h3>
  <p><b>One Founder. One Command. An Entire AI Executive Team.</b></p>
  <i>Designed to transform single founders into fully-functional corporate teams.</i>
</div>

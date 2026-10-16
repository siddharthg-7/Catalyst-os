# CatalystOS — Claude Code Instructions

## Overview
CatalystOS is an enterprise-grade AI operating platform for automated workflow orchestration, multi-agent founder assistance, and employee workspace management.

## Tech Stack
- **Backend**: Node.js, Express, TypeScript, Prisma ORM, Neon PostgreSQL (pgvector).
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide React.
- **Python Service**: FastAPI, LangGraph, Uvicorn (port 8000).

## Environment Configuration
Keys and credentials are saved in `.env` (and mirrored in `backend/.env`):
- `CLAUDE_CODE_KEY`: Claude Code API key configured in `.env` and User environment variables.
- `ANTHROPIC_API_KEY`: Anthropic API key configured in `.env` and User environment variables.
- `GEMINI_API_KEY`: Google Gemini Flash API key for multi-agent reasoning.
- `DATABASE_URL`: Neon PostgreSQL pooled connection.
- `DIRECT_URL`: Neon PostgreSQL unpooled direct connection for migrations.

## Useful Commands
- `npm run dev`: Starts the complete development environment (Node backend + Vite frontend).
- `npm run build`: Compiles both backend and frontend for production.
- `npm run build:frontend`: Compiles Vite frontend bundle (`dist/`).
- `npx prisma db push`: Pushes Prisma schema changes to Neon PostgreSQL.

## Architectural Conventions
- **Tenant Isolation**: All database queries and RAG operations must be scoped to the user's active company membership via `resolveMembership`.
- **Role Scoping**: Privileged founders/admins (`FOUNDER`, `ADMIN`) have full access; employees (`HR`, `FINANCE`, `OPERATIONS`, `GROWTH`) have access scoped to their department and assigned tasks.
- **No Direct Schema Migrations on Live Tables**: Maintain backward compatibility with existing Neon PostgreSQL tables (`Notification`, `Task`, `Memory`, `StartupDocument`).
- **Realtime**: Client-side reliable polling every 12s with Page Visibility API pausing.

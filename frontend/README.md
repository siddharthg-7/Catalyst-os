# CatalystOS — Frontend Application

Modern React 19 + TypeScript + Vite Single Page Application for CatalystOS.

---

## 📂 Directory Structure

```text
frontend/
├── public/                 # Static assets (images, frames, icons)
├── src/
│   ├── assets/             # Brand logos, icons, illustrations
│   ├── components/         # Reusable UI components
│   │   ├── chatbot/        # AI Copilot floating chatbot interface
│   │   ├── reactbits/      # Interactive motion cards, cursors & brand panels
│   │   ├── reui/           # Headless primitive UI widgets
│   │   ├── voice/          # Voice Studio & Conversational interface
│   │   └── workspace/      # Notes, community board & workspace widgets
│   ├── constants/          # Application routes, tabs, static constants
│   ├── context/            # Global React context (AuthContext, sessions)
│   ├── hooks/              # Custom hooks (useChat, useStreaming, useGsapAnimations)
│   ├── layouts/            # Page shells (Footer, Spotlight, Navigation)
│   ├── pages/              # High-level route views (Landing, Auth, Dashboard, Employee)
│   ├── sections/           # Modular landing & dashboard sections
│   ├── services/           # Frontend API and service clients (api.ts, emailJs, voice)
│   ├── styles/             # Global CSS, Tailwind v4 design tokens (index.css)
│   ├── types/              # TypeScript models, data contracts, and domain types
│   ├── utils/              # Client-side helper functions (currency formatters, etc.)
│   ├── App.tsx             # Master client router & navigation controller
│   └── main.tsx            # Application bootstrapping & React 19 root
├── .env.example            # Sample frontend environment configuration
├── index.html              # HTML entry point with modern typography & theme loader
├── package.json            # Frontend dependencies & npm scripts
├── tsconfig.json           # Frontend TypeScript compiler configuration
└── vite.config.ts          # Vite build, HMR, and API proxy configuration
```

---

## 🏃 Running Frontend Independently

From this directory (`frontend/`):

```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```

The frontend will be available at **`http://localhost:5173`**.
API requests starting with `/api` are automatically proxied to the backend at `http://localhost:3000`.

---

## 🛠️ Where to Make Changes

| When you want to modify... | Go to file / folder... |
| :--- | :--- |
| **Landing Page** | `src/components/HackathonLandingPage.tsx` or `src/pages/LandingPage.tsx` |
| **Executive Dashboard** | `src/components/SaaSDashboard.tsx` or `src/components/RoleAwareDashboard.tsx` |
| **Styling & Theme Tokens** | `src/styles/index.css` |
| **API Endpoints & Fetching** | `src/services/api.ts` |
| **Authentication & Session** | `src/context/AuthContext.tsx` & `src/components/AuthScreen.tsx` |
| **Navigation & Routing** | `src/App.tsx` & `src/constants/index.ts` |
| **Types & Interfaces** | `src/types/index.ts` |

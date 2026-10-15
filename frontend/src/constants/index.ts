/**
 * CatalystOS Frontend Constants & Route Configurations
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const APP_ROUTES = {
  HOME: '/',
  LANDING: '/landing',
  AUTH: '/auth',
  LOGIN: '/login',
  SIGNUP: '/signup',
  ONBOARDING: '/onboarding',
  DASHBOARD: '/dashboard',
  EMPLOYEE: '/employee',
  ACCEPT_INVITATION: '/accept-invitation',
} as const;

export const NAVIGATION_TABS = [
  { id: 'dashboard', label: 'Executive Dashboard', icon: 'LayoutDashboard' },
  { id: 'council', label: 'Executive Council', icon: 'Cpu' },
  { id: 'orchestration', label: 'AI Multi-Agent Fleet', icon: 'Sparkles' },
  { id: 'workspace', label: 'Initiative Execution', icon: 'Layers' },
  { id: 'approvals', label: 'Approval Queue', icon: 'CheckSquare' },
  { id: 'workflows', label: 'Visual Workflows', icon: 'GitMerge' },
  { id: 'knowledge', label: 'Knowledge Base & RAG', icon: 'BookOpen' },
  { id: 'scenarios', label: 'Scenario Simulator', icon: 'SlidersHorizontal' },
  { id: 'decisions', label: 'Immutable Decision Log', icon: 'ShieldCheck' },
  { id: 'people', label: 'People Directory', icon: 'Users' },
] as const;

export const DEFAULT_THEME = 'light';

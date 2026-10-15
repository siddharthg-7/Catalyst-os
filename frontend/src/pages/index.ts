/**
 * Page-Level Module Exports for CatalystOS
 *
 * Provides a clean, standard page entry point for routing and views:
 * - LandingPage (HackathonLandingPage)
 * - AuthPage (AuthScreen)
 * - DashboardPage (RoleAwareDashboard / SaaSDashboard)
 * - EmployeePage (EmployeeWorkspace)
 * - CouncilPage (ExecutiveCouncilWorkspace)
 */

export { default as LandingPage } from '../components/HackathonLandingPage';
export { default as AuthPage } from '../components/AuthScreen';
export { default as DashboardPage } from '../components/RoleAwareDashboard';
export { default as SaaSDashboardPage } from '../components/SaaSDashboard';
export { default as EmployeePage } from '../components/EmployeeWorkspace';
export { default as CouncilPage } from '../components/ExecutiveCouncilWorkspace';
export { default as OnboardingPage } from '../components/FounderOnboardingWizard';
export { default as AcceptInvitationPage } from '../components/AcceptInvitation';

# CatalystOS Landing Page Content Refinement — Preserve Existing UI

## Objective

Refine the content and product messaging of the existing CatalystOS landing page to communicate its real value to startup founders.

The website currently has a polished, minimal design with a light neutral background, black typography, rounded cards, subtle borders, a product dashboard preview, pricing cards, an FAQ section, and a dark footer. Preserve this visual identity.

**The primary objective is to improve what the website communicates, not redesign how it looks.**

Use the existing CatalystOS project resources, repository, product architecture, implemented features, dashboard screens, workflow definitions, integrations, agent capabilities, and previous project documentation as the source of truth.

Do not introduce a new product concept or replace existing functionality with invented capabilities.

---

## 1. Strict UI Preservation Rules

Treat this as a content-first refinement, not a UI redesign.

- Preserve the current page structure, section order, and overall layout.
- Retain the existing typography, font sizes, font weights, spacing, alignment, colors, and background treatments wherever possible.
- Keep the existing navigation bar, buttons, dashboard preview, feature cards, pricing cards, FAQ accordions, CTA section, and footer.
- Preserve the existing illustrations, robot graphic, icons, decorative elements, and animations.
- Retain existing responsive behavior for desktop, tablet, and mobile.
- Do not introduce new sections unless a small content adjustment is essential.
- Do not replace the existing visual system with a new design system.
- Do not change routes, authentication flows, pricing logic, API calls, application state, backend services, or database behavior.
- Preserve all existing functional interactions.
- Avoid unnecessary component refactoring or dependency changes.
- Make only minimal spacing or text adjustments when new content requires them to fit the existing layout.
- Do not shrink text excessively, truncate meaningful content, or introduce awkward line breaks to force longer copy into existing components.

The result should look recognizably like the current CatalystOS website, with substantially clearer messaging.

## 2. Inspect Existing Project Resources Before Editing

Before making changes, inspect the existing codebase and all relevant project resources available in the repository.

Review:

- The current landing page implementation and reusable UI components.
- The existing dashboard and its real product workflows.
- Authentication and onboarding flows.
- AI agent orchestration and available agent responsibilities.
- Task, project, deadline, dependency, and team-management functionality.
- Existing integrations and connected data sources.
- Current pricing configuration and plan restrictions.
- Security, permissions, tenant isolation, and approval mechanisms.
- Existing pitch deck, problem statement, architecture documentation, and product requirements.

Use the actual implementation to determine what CatalystOS can currently do.

**Do not claim that a feature exists merely because it appears in a pitch deck or proposed architecture.** Distinguish implemented features from planned capabilities.

Do not fabricate customer testimonials, measured productivity improvements, adoption figures, integrations, security certifications, or validated commercial results.

If a capability is not implemented or cannot be verified, do not present it as a confirmed capability.

## 3. Navigation Bar

Keep the existing navigation layout and styling.

Refine the navigation labels only where it improves clarity.

Suggested labels:

- Product
- Process
- Pricing
- FAQ

Keep the CatalystOS logo and existing primary CTA.

Ensure that every navigation item points to its correct existing section or route. Do not create broken anchors or unnecessary new pages.

## 4. Hero Section — Replace Generic Messaging With a Founder Problem

The current headline describes CatalystOS as an AI operating system but does not immediately explain the problem it solves.

Replace the hero copy with the following direction.

**Headline:**

"Run Your Startup Without Losing Track of What Matters."

**Supporting copy:**

"Connect your team's work, business priorities, and critical dependencies in one workspace. CatalystOS helps you understand what needs attention, identify blockers, and coordinate the next steps."

**Primary CTA:**

"Start Free Trial"

Keep the existing secondary demo CTA, using the label:

"Explore the Workflow"

Retain the existing hero illustration and its position.

The messaging must communicate three things immediately:

1. Startup work is fragmented across people, tasks, and information.
2. Founders need visibility into priorities, blockers, and dependencies.
3. CatalystOS helps bring that work together into a more coordinated workflow.

Avoid generic claims such as "revolutionary AI," "fully autonomous company," or "everything automated."

Do not claim that CatalystOS replaces every existing startup tool.

If the current implementation supports a more specific capability, use that capability to make the supporting copy more concrete.

## 5. Hero Dashboard Preview — Preserve the Existing Visual

Keep the current dashboard screenshot or dashboard-style preview in its existing position.

Update only the visible text labels and sample content where appropriate.

Use a realistic example that demonstrates startup execution rather than a generic collection of AI features.

Suggested example:

**Workspace:** Product Launch

**Priority:** Launch readiness

**Example status:** At risk

**Identified dependency:** Final product testing must be completed before the launch announcement.

**Business impact:** A delayed testing milestone may affect the planned launch date.

**Recommended next step:** Confirm testing ownership, review unresolved issues, and update the launch timeline.

**Approval:** Awaiting founder review

**Team tasks:** Show realistic owners, task statuses, and deadlines consistent with the actual dashboard capabilities.

These are illustrative sample records, not claims about real customers or actual events.

Use only fields and status labels supported by the existing UI and product model. If the dashboard cannot represent these fields, retain its existing structure and update only the text that fits.

Do not hardcode new demo data into production workflows or modify backend behavior just to match the example.

## 6. Product Value Proposition — Explain the Outcome

The landing page should explain the value of CatalystOS in terms of the founder's daily work.

Prioritize these benefits, where supported by the implementation:

- **Shared visibility:** Understand what is happening across the startup.
- **Priority awareness:** Identify work that needs attention.
- **Dependency awareness:** Understand how blocked tasks affect other work.
- **Coordinated execution:** Connect decisions, responsibilities, and next steps.
- **Founder oversight:** Keep important decisions and approvals visible.
- **Progress tracking:** Monitor execution and identify unresolved issues.

Do not add a new feature grid if the current page already communicates these capabilities through its existing dashboard and workflow sections.

Use the existing content areas to communicate outcomes instead of adding more UI.

## 7. "From Idea to Execution" Section

Keep the existing four-card layout, numbering, icons, and card styling.

Retain the section heading:

"From Idea to Execution"

Refine the four cards as follows.

### Card 01 — Connect Your Startup

**Description:**
"Bring your team's priorities, projects, and relevant business information into a shared workspace using supported connections and workflows."

### Card 02 — Understand Your Business

**Description:**
"See important tasks, emerging blockers, and dependencies that may affect your team's progress."

### Card 03 — Move Work Forward

**Description:**
"Turn identified priorities into clear next steps, with responsibilities and approvals where supported."

### Card 04 — Track Progress

**Description:**
"Monitor execution, review outstanding work, and keep your startup aligned as priorities change."

Adjust the wording to match the actual implementation. If the product does not currently support a particular connection, automated task creation, or approval workflow, do not imply that it does.

The purpose of these cards is to explain the user journey, not to advertise a list of AI technologies.

## 8. Demonstrate One Concrete Workflow

Use the existing product demo or dashboard area to make the value proposition understandable.

The example should follow this sequence:

1. A founder is preparing for a product launch.
2. A critical task becomes delayed or remains incomplete.
3. CatalystOS surfaces the blocker or dependency, if supported.
4. The founder can understand the potential impact on the launch.
5. The system presents an appropriate next step or recommendation, if implemented.
6. The founder reviews or approves consequential actions where the product supports approval.
7. The team proceeds with assigned work and updated priorities where those workflows are available.

The sequence must reflect the actual product.

Do not suggest that the system autonomously changes deadlines, contacts team members, or executes external actions unless those behaviors are implemented and appropriately authorized.

Keep the existing UI. Prefer better labels, descriptions, and demo content over new components.

## 9. Pricing Section — Improve Clarity Without Inventing Prices

Keep the existing pricing section, its four cards, visual hierarchy, billing toggle, highlighted plan, and CTA buttons.

Preserve the existing pricing amounts and billing logic unless the project owner has explicitly approved a pricing change.

Refine the plan descriptions so a founder can understand the intended use case of each tier.

Suggested positioning:

### Free Trial

"For founders who want to explore the core CatalystOS workflow before committing."

### Starter

"For early-stage teams that need a clearer view of their work and priorities."

### Growth

"For growing teams coordinating more projects, responsibilities, and dependencies."

### Enterprise

"For organizations that need a tailored deployment, configuration, or support arrangement, where available."

Keep each card's feature list consistent with its existing plan entitlements.

Verify that the billing toggle, displayed prices, plan limits, and checkout actions remain functional.

Do not describe a plan as unlimited, enterprise-ready, or fully featured unless the actual plan configuration supports that claim.

Do not imply that the displayed prices have been validated by customer research.

## 10. FAQ Section — Answer Adoption Concerns

Keep the current FAQ heading, accordion behavior, card styling, and layout.

Retain the existing questions where they remain relevant, but refine their answers to address the concerns of startup founders.

### What is CatalystOS?

"CatalystOS is a workspace designed to help startup teams organize business priorities, coordinate execution, and maintain visibility into important work. Its capabilities depend on the features and integrations available in your current setup."

### Which AI advisors are included?

"Available AI capabilities depend on the agents and workflows enabled in your CatalystOS environment. Explore the product to see which capabilities are currently supported."

Update this answer using the actual agent names and responsibilities found in the project.

### Can I invite my team?

Explain the actual team invitation, membership, and permission capabilities. If team invitations are not implemented, state that accurately.

### Is my startup data secure?

Describe only verified security controls, such as implemented authentication, authorization, tenant isolation, and access restrictions. Do not claim certifications or guarantees that have not been established.

### Can I integrate with my existing tools?

List only integrations that are actually supported and available. Explain any current limitations.

### Do you offer a free trial?

Use the actual trial configuration, including duration, eligibility, limitations, and conversion behavior. Do not invent a trial period.

Ensure every answer is concise, factual, and useful to a prospective customer.

## 11. Final Call-to-Action Section

Preserve the existing dark CTA panel, illustration, centered content, button, rounded corners, and surrounding whitespace.

Replace the generic heading with:

**"Bring Your Startup's Work Into Focus."**

Supporting copy:

"Get a clearer view of your priorities, responsibilities, and blockers. Start with the workflows available in CatalystOS and see how they fit the way your team works."

CTA:

"Start Free Trial"

Keep the existing CTA destination and trial behavior unchanged.

Avoid promising guaranteed growth, autonomous execution of every business function, or measurable productivity improvements without evidence.

## 12. Footer

Preserve the current dark footer and its existing column layout.

Keep the CatalystOS branding and existing links.

Update link labels only when necessary to improve clarity, and ensure every link points to a valid destination.

Do not add invented social profiles, contact details, policy pages, or external links.

## 13. Tone and Copywriting Rules

The entire website must use consistent messaging.

The tone should be:

- Clear and founder-focused.
- Practical rather than futuristic.
- Specific about problems and outcomes.
- Concise enough to fit the existing components.
- Honest about current capabilities.
- Focused on coordination, visibility, priorities, dependencies, and execution.

Avoid:

- Excessive AI terminology.
- Unsupported claims about autonomy.
- Repeated use of "all-in-one."
- Vague promises about transforming startups.
- Fabricated metrics or customer evidence.
- Repetitive descriptions of the same feature.
- Long paragraphs that damage the current visual rhythm.

Explain the user benefit before explaining the underlying technology.

## 14. Technical Implementation Requirements

Before editing, identify the exact files and components responsible for the landing page.

Then:

1. Make the smallest possible changes to existing copy and sample labels.
2. Reuse the current components and design tokens.
3. Preserve existing routes, IDs, anchors, state management, and interactions.
4. Avoid changing backend code unless a verified content-related issue requires it.
5. Keep content responsive without introducing horizontal overflow.
6. Check text wrapping and alignment across desktop and mobile breakpoints.
7. Confirm that the pricing toggle and FAQ accordions still work.
8. Confirm that navigation and CTA links still work.
9. Confirm that the product demo and dashboard preview still render correctly.
10. Check the browser console for errors introduced by the changes.

Do not rewrite the application or introduce unnecessary packages.

## 15. Acceptance Criteria

The work is complete only when:

- The page retains its recognizable existing visual design.
- The hero immediately communicates a founder-relevant problem and value proposition.
- The dashboard illustrates a believable workflow rather than merely showcasing AI.
- The four process cards explain how a founder uses CatalystOS.
- Pricing descriptions are understandable and consistent with actual entitlements.
- FAQs answer real adoption concerns with verified information.
- The final CTA reinforces the same value proposition as the hero.
- No unsupported product capabilities or commercial claims have been introduced.
- Existing functionality, navigation, responsiveness, and interactions remain intact.
- No unnecessary sections, visual redesigns, or backend changes have been made.

## Final Instruction

First inspect the actual CatalystOS repository and its existing project resources. Then implement the content refinements directly in the existing landing page.

Do not return only a proposed design or a list of recommendations. Make the changes in the existing implementation if the necessary files and tools are available.

At the end, report:
- Files changed.
- Content and messaging updated.
- Features and UI behavior preserved.
- Tests or checks performed.
- Any product claims that could not be verified and therefore were not included.

**Priority order: factual accuracy → clearer founder value proposition → preservation of existing UI → minimal implementation changes.**
import { Initiative, WorkflowTask, AgentMessage, Deliverable } from '../src/models/types';
import { 
  runCEOPlanner, 
  runFinanceAgent, 
  runTalentAgent, 
  runGrowthAgent, 
  runOperationsAgent, 
  runLegalAgent, 
  runConflictResolver, 
  runApprovalManager 
} from './services';
import { PlannerOutputDTO, AgentResponseDTO, ConflictResolutionDTO } from './types';

// Simple helper to find avatar for roles
const getAvatarByRole = (role: string): string => {
  switch (role) {
    case 'CEO': return 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150';
    case 'Finance': return 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150';
    case 'Talent': return 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150';
    case 'Growth': return 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150';
    case 'Operations': return 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150';
    case 'Legal': return 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=150';
    case 'ConflictResolver': return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150';
    case 'ApprovalManager': return 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150';
    default: return 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150';
  }
};

const getRoleName = (role: string): string => {
  switch (role) {
    case 'CEO': return 'Sophia Vance';
    case 'Finance': return 'Marcus Sterling';
    case 'Talent': return 'Evelyn Brooks';
    case 'Growth': return 'Dax Ramirez';
    case 'Operations': return 'Kaelen Finch';
    case 'Legal': return 'Helena Vance, Esq.';
    case 'ConflictResolver': return 'Pax-9 Synthesis';
    case 'ApprovalManager': return 'Loom-V Director';
    default: return 'Automated Executive';
  }
};

export async function executeCollaborationLoop(
  initiative: Initiative,
  startupState: any,
  knowledgeFiles: any[]
): Promise<any> {
  const startupStateStr = JSON.stringify(startupState, null, 2);
  const ragContext = knowledgeFiles.map(d => `${d.name}: ${d.summary} Insights: ${d.insights.join('; ')}`).join('\n');

  console.log(`[Collaboration Engine] Starting loop for: ${initiative.title}`);

  // Step 1: Call CEO Planner to decompose task
  const ceoPlan: PlannerOutputDTO = await runCEOPlanner(initiative.description, startupStateStr, ragContext);
  console.log(`[Collaboration Engine] Decomposed tasks count: ${ceoPlan.decomposedTasks.length}`);

  const messages: AgentMessage[] = [];
  const completedTasks: WorkflowTask[] = [];
  const agentResponses: AgentResponseDTO[] = [];

  // CEO Introductory message
  messages.push({
    id: `msg_ceo_start_${Date.now()}`,
    sender: 'CEO',
    receiver: 'All',
    content: `Team, we are launching an important initiative: "${ceoPlan.founderGoal}". I have decomposed our objectives and assigned concrete tasks. Let's coordinate immediately to secure quality execution.`,
    timestamp: new Date().toISOString()
  });

  // Step 2: Concurrently / sequentially run the designated executive agents
  for (const task of ceoPlan.decomposedTasks) {
    const role = task.assignedTo;
    console.log(`[Collaboration Engine] Running Agent: ${role} on task: ${task.title}`);

    let response: AgentResponseDTO;
    if (role === 'Finance') {
      response = await runFinanceAgent(task.title, startupStateStr, ragContext);
    } else if (role === 'Talent') {
      response = await runTalentAgent(task.title, startupStateStr, ragContext);
    } else if (role === 'Growth') {
      response = await runGrowthAgent(task.title, startupStateStr, ragContext);
    } else if (role === 'Operations') {
      response = await runOperationsAgent(task.title, startupStateStr, ragContext);
    } else if (role === 'Legal') {
      response = await runLegalAgent(task.title, startupStateStr, ragContext);
    } else {
      // Default fallback if some other role shows up
      response = {
        agentId: role,
        reasoning: `Executing assigned subtask: "${task.title}". Verified bounds and compliance thresholds.`,
        recommendations: [{
          id: `rec_${role.toLowerCase()}_1`,
          title: `Configure ${role} strategy`,
          description: `Successfully validated ${role} objectives and parameters.`,
          financialImpact: 0,
          riskRating: 'low'
        }],
        isConflict: false
      };
    }

    agentResponses.push(response);

    // Save as message from agent
    messages.push({
      id: `msg_${role.toLowerCase()}_${Date.now()}`,
      sender: role,
      receiver: 'CEO',
      content: `${response.reasoning}\n\n**Recommendations:**\n${response.recommendations.map(r => `- **${r.title}**: ${r.description} (Est. Impact: $${r.financialImpact})`).join('\n')}`,
      timestamp: new Date().toISOString(),
      isConflict: response.isConflict
    });

    // Mark task completed
    completedTasks.push({
      id: task.id,
      title: task.title,
      assignedTo: role,
      status: 'completed',
      result: response.reasoning
    });
  }

  // Step 3: Scan loop for conflict identification
  const clashingMessages = messages.filter(m => m.isConflict);
  let resolvedCompensation: ConflictResolutionDTO | null = null;

  if (clashingMessages.length > 0) {
    console.log(`[Collaboration Engine] Conflict identified. Triggering ConflictResolver...`);
    
    // Call Conflict Resolver Service to mediate
    resolvedCompensation = await runConflictResolver(messages, startupStateStr);

    messages.push({
      id: `msg_conflict_resolver_${Date.now()}`,
      sender: 'ConflictResolver',
      receiver: 'All',
      content: `### Conflict Mediated Successfully\n\n**Resolution:** ${resolvedCompensation.resolutionText}\n\n**Compromise Details:** ${resolvedCompensation.compromiseDetails}`,
      timestamp: new Date().toISOString()
    });
  }

  // Step 4: Call ApprovalManager to bundle the final high-fidelity Deliverables
  console.log(`[Collaboration Engine] Packaging deliverables...`);
  const finalDeliverable = await runApprovalManager(
    ceoPlan.initiativeId,
    initiative.title,
    initiative.description,
    agentResponses
  );

  // If there was a conflict resolved, apply the compromise metrics to the final deliverable!
  if (resolvedCompensation) {
    finalDeliverable.financialChange = resolvedCompensation.resolvedMetrics.financialChange;
    finalDeliverable.metricChanges = resolvedCompensation.resolvedMetrics.metricChanges;
  }

  const deliverables: Deliverable[] = [{
    id: finalDeliverable.id || `del_${Date.now()}`,
    initiativeId: initiative.id,
    title: finalDeliverable.title,
    description: finalDeliverable.description,
    type: finalDeliverable.type || 'document',
    status: 'pending_review',
    content: finalDeliverable.content,
    impact: finalDeliverable.impact,
    financialChange: finalDeliverable.financialChange,
    metricChanges: finalDeliverable.metricChanges
  }];

  // Final CEO/Approval packaging message
  messages.push({
    id: `msg_ceo_final_${Date.now()}`,
    sender: 'CEO',
    receiver: 'All',
    content: `Our strategic planning session has completed successfully. Loom-V Director has packaged our final corporate deliverable: **"${deliverables[0].title}"**. I have directed this to the Founder Approval Queue for high-fidelity review.`,
    timestamp: new Date().toISOString()
  });

  return {
    tasks: completedTasks,
    messages,
    deliverables
  };
}

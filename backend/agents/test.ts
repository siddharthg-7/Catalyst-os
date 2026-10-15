import { runCEOPlanner, runFinanceAgent } from './services';
import { runOrchestrationLoop } from '../ai/orchestrator';
import { Initiative } from '../src/models/types';

async function runTests() {
  console.log('========================================');
  console.log('STARTING CENTRAL ORCHESTRATOR TEST SUITE');
  console.log('========================================');

  const mockStartupState = {
    name: 'CatalystOS Startup',
    industry: 'B2B SaaS / Developer Tools',
    fundingStage: 'Pre-Seed',
    cashBalance: 245000,
    burnRate: 18500,
    metrics: {
      velocity: 65,
      financialHealth: 72,
      legalCompliance: 80,
      growthRate: 45,
      operationsEfficiency: 70
    }
  };

  const mockKnowledgeFiles = [
    {
      id: 'doc_1',
      name: 'CatalystOS_Pitch_Deck.md',
      summary: 'Core fundraising presentation detailing CatalystOS Cloud Orchestrator, market size ($22B), product roadmap, and founder experience.',
      insights: [
        'Targeting $1.5M Seed round at $10M pre-money valuation.',
        'Saves cloud costs by up to 34% using predictive scheduling algorithms.'
      ]
    }
  ];

  const mockInitiative: Initiative = {
    id: 'test_init_123',
    title: 'Hire a Lead DevOps platform engineer',
    description: 'Structure and deploy a recruiting workflow to hire the lead DevOps engineer. Need options pool setup, Finance budget approval, and Legal contract auditing.',
    status: 'pending',
    category: 'hiring',
    createdAt: new Date().toISOString(),
    currentTaskIndex: 0,
    tasks: [],
    messages: [],
    deliverables: []
  };

  try {
    console.log('\n--- Test 1: Testing CEO Planner Task Decomposition ---');
    const ceoOutput = await runCEOPlanner(
      mockInitiative.description, 
      JSON.stringify(mockStartupState), 
      JSON.stringify(mockKnowledgeFiles)
    );
    console.log('CEO Planner output successfully received:');
    console.log(`Required Executives: ${ceoOutput.requiredExecutives.join(', ')}`);
    console.log(`Decomposed tasks count: ${ceoOutput.decomposedTasks.length}`);
    console.log(`Expected Deliverables: ${ceoOutput.expectedDeliverables.map(d => d.title).join(', ')}`);

    console.log('\n--- Test 2: Testing Specialty Agent Execution (Finance) ---');
    const financeOutput = await runFinanceAgent(
      'Evaluate budget limits for a lead engineer base salary and runway adjustments.',
      JSON.stringify(mockStartupState),
      JSON.stringify(mockKnowledgeFiles)
    );
    console.log('Finance Agent output successfully received:');
    console.log(`Reasoning: ${financeOutput.reasoning.substring(0, 100)}...`);
    console.log(`Is Conflict Flagged? ${financeOutput.isConflict}`);

    console.log('\n--- Test 3: Testing Full Prompt-File & RAG Driven Central Orchestrator ---');
    const loopResult = await runOrchestrationLoop(
      mockInitiative,
      mockStartupState,
      mockKnowledgeFiles
    );
    console.log('Central Orchestrator Loop executed successfully!');
    console.log(`Generated messages: ${loopResult.messages.length}`);
    console.log(`Completed tasks: ${loopResult.tasks.length}`);
    console.log(`Generated deliverables: ${loopResult.deliverables.length}`);
    console.log(`Deliverable Content Sample:\n${loopResult.deliverables[0].content.substring(0, 150)}...`);

    console.log('========================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY!');
    console.log('========================================');
  } catch (error) {
    console.error('Test Suite Failed:', error);
  }
}

// Run test suite directly
runTests();

export { runTests };

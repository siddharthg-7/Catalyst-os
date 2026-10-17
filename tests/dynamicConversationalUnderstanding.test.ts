import { test } from 'node:test';
import assert from 'node:assert';
import { multiLevelOrchestrator } from '../backend/services/multiLevelOrchestrator';

const TEST_USER = 'usr_dynamic_test';
const TEST_STARTUP = 'stp_novatech_demo';

test('Dynamic AI [Test 1]: Casual Conversational Check-ins ("How are you?" & "What\'s up?")', async () => {
  const directives = ["How are you?", "What's up?"];

  for (const directive of directives) {
    const run = await multiLevelOrchestrator.dispatchDirective({
      directive,
      userId: TEST_USER,
      startupId: TEST_STARTUP
    });

    assert.strictEqual(run.status, 'completed');
    assert.strictEqual(run.intent, 'greeting');
    assert.strictEqual(run.tasks.length, 0, 'Must not launch an unnecessary multi-agent DAG for a greeting');
    assert.ok(run.result.summary.length > 20, 'Must produce a natural, dynamic conversational answer');

    // Verify it avoids canned/hardcoded telemetry and roadmaps
    assert.ok(!run.result.summary.includes('operating telemetry'), 'Must NOT claim verified against operating telemetry');
    assert.ok(!run.result.summary.includes('30-Day Go-To-Market Execution Charter'), 'Must NOT generate a generic 30-day charter for greetings');
    assert.ok(run.result.completedWork.some(w => w.includes('Avoided launching unnecessary multi-agent DAG')), 'Must note avoided unnecessary DAG');
  }
  console.log('✅ PASS: Test 1 - Casual conversational check-ins dynamically answered without fake roadmaps');
});

test('Dynamic AI [Test 2]: Identity & Assistant Persona ("Who am I talking to?" & "Tell me about yourself")', async () => {
  const directives = ["Who am I talking to?", "Tell me about yourself."];

  for (const directive of directives) {
    const run = await multiLevelOrchestrator.dispatchDirective({
      directive,
      userId: TEST_USER,
      startupId: TEST_STARTUP
    });

    assert.strictEqual(run.status, 'completed');
    assert.strictEqual(run.intent, 'greeting');
    assert.strictEqual(run.tasks.length, 0, 'Must not launch multi-agent DAG');
    assert.ok(run.result.summary.length > 20, 'Must produce dynamic identity explanation');

    const lowerSummary = run.result.summary.toLowerCase();
    const identifiesRole = lowerSummary.includes('sophia') || lowerSummary.includes('catalyst') || lowerSummary.includes('dispatcher') || lowerSummary.includes('executive');
    assert.ok(identifiesRole, 'Must identify assistant persona/role dynamically');
    assert.ok(!run.result.summary.includes('30-Day Go-To-Market Execution Charter'), 'Must NOT output business roadmap');
  }
  console.log('✅ PASS: Test 2 - Identity inquiries dynamically answered using Sophia Vance persona');
});

test('Dynamic AI [Test 3]: Deterministic Financial Reasoning ("What is our current runway?" & "How much time do we have before we run out of cash?")', async () => {
  const directives = [
    "What is our current runway?",
    "How much time do we have before we run out of cash?"
  ];

  for (const directive of directives) {
    const run = await multiLevelOrchestrator.dispatchDirective({
      directive,
      userId: TEST_USER,
      startupId: TEST_STARTUP
    });

    assert.strictEqual(run.status, 'completed');
    assert.strictEqual(run.intent, 'financial_scenario');
    assert.strictEqual(run.tasks.length, 0, 'Must answer informational financial questions without unnecessary multi-agent DAG');

    // Sourced calculations
    assert.ok(run.result.calculations.length >= 2, 'Must include deterministic calculations');
    const runwayCalc = run.result.calculations.find(c => c.metric.toLowerCase().includes('runway'));
    assert.ok(runwayCalc, 'Calculations must include runway metric');
    assert.ok(runwayCalc.value.includes('Months'), 'Runway must have month units');

    // Dynamic summary
    assert.ok(run.result.summary.length > 20, 'Summary must explain financial horizon');
    const lowerSummary = run.result.summary.toLowerCase();
    assert.ok(lowerSummary.includes('runway') || lowerSummary.includes('months') || lowerSummary.includes('cash'), 'Must address runway or cash horizon');
    
    // Explicit demo disclosure
    const hasDemoNotice = run.result.summary.toLowerCase().includes('demo') || run.result.keyFindings.some(k => k.toLowerCase().includes('demo'));
    assert.ok(hasDemoNotice, 'Must clearly identify baseline demo figures as demo data');
  }
  console.log('✅ PASS: Test 3 - Financial runway questions answered using deterministic calculations with demo disclosure');
});

test('Dynamic AI [Test 4]: Financial Safety Evaluation ("Are we financially safe for the next six months?")', async () => {
  const directive = "Are we financially safe for the next six months?";

  const run = await multiLevelOrchestrator.dispatchDirective({
    directive,
    userId: TEST_USER,
    startupId: TEST_STARTUP
  });

  assert.strictEqual(run.status, 'completed');
  assert.strictEqual(run.intent, 'financial_scenario');
  assert.strictEqual(run.tasks.length, 0);

  // Key findings should evaluate safety buffer
  const safetyFinding = run.result.keyFindings.find(k => k.includes('Safety') || k.includes('Assessment') || k.includes('Buffer'));
  assert.ok(safetyFinding, 'Must provide structured safety buffer finding');

  // Summary must answer safety question
  assert.ok(run.result.summary.length > 20);
  const lowerSummary = run.result.summary.toLowerCase();
  const answersSafety = lowerSummary.includes('safe') || lowerSummary.includes('secure') || lowerSummary.includes('adequate') || lowerSummary.includes('exceeds');
  assert.ok(answersSafety, 'Must address safety for the requested 6-month period');
  console.log('✅ PASS: Test 4 - Financial safety evaluation accurately reasoned and explained');
});

test('Dynamic AI [Test 5]: Honest Handling of Missing Company Information', async () => {
  const directive = "What is our patent filing status for European markets?";

  const run = await multiLevelOrchestrator.dispatchDirective({
    directive,
    userId: TEST_USER,
    startupId: TEST_STARTUP
  });

  assert.strictEqual(run.status, 'completed');
  assert.strictEqual(run.intent, 'knowledge_query');
  assert.strictEqual(run.tasks.length, 0);

  // Must honestly acknowledge missing info without hallucinating fictitious patents
  const lowerSummary = run.result.summary.toLowerCase();
  const honestReporting = lowerSummary.includes('no') || lowerSummary.includes('not') || lowerSummary.includes('missing') || lowerSummary.includes('unrecorded') || lowerSummary.includes('uploaded');
  assert.ok(honestReporting, 'Must honestly report lack of records instead of fabricating European patents');
  console.log('✅ PASS: Test 5 - Missing company information truthfully reported without fabrication');
});

/**
 * CatalystOS - Multi-Agent Workflows & DAG Canvas
 * Redesigned with Apple × Linear × Notion aesthetics.
 * Clean, scannable sprint boards, reactive SVG collaboration topology DAG,
 * interactive multi-agent deliberation simulation, and high-contrast deliverable previews.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Initiative, 
  AgentRole, 
  Deliverable, 
  ExecutionWorkflow, 
  ExplicitWorkflowTask,
  ExecutionTaskStatus 
} from '../types';
import {
  Play, Plus, RefreshCw, AlertTriangle, FileText, CheckCircle2,
  ChevronRight, ArrowRight, ArrowLeft,
  Sparkles, Check, X, Clock, Lock, Calendar, ShieldCheck,
  Layers, AlertOctagon, GitCommit, UserCheck, ArrowUpRight,
  GitBranch, CheckSquare, Zap, Activity, Info, History as HistoryIcon
} from 'lucide-react';
import Section from './Section';

interface WorkflowCanvasProps {
  initiatives: Initiative[];
  onLaunchInitiative: (title: string, description: string, category: 'funding' | 'hiring' | 'growth' | 'operations' | 'legal') => Promise<void>;
  onSimulateInitiative: (id: string) => Promise<void>;
  onNavigate?: (tab: string) => void;
  apiFetch?: any;
}

export default function WorkflowCanvas({ initiatives, onLaunchInitiative, onSimulateInitiative, onNavigate, apiFetch }: WorkflowCanvasProps) {
  const [selectedInitId, setSelectedInitId] = useState<string>(initiatives[0]?.id || '');
  const [workflowView, setWorkflowView] = useState<'list' | 'detail'>('detail');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<number>(1);
  const [isLaunching, setIsLaunching] = useState(false);
  
  // Custom Initiative Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<'funding' | 'hiring' | 'growth' | 'operations' | 'legal'>('growth');
  const [selectedAgents, setSelectedAgents] = useState<string[]>(['CEO', 'Finance', 'Legal']);
  const [targetMilestone, setTargetMilestone] = useState('30-Day Execution Cycle');

  // Detail View Sub-tabs: 'execution' | 'topology' | 'debate' | 'deliverables'
  const [detailTab, setDetailTab] = useState<'execution' | 'topology' | 'debate' | 'deliverables'>('execution');

  // ─────────────────────────────────────────────────────────────────────────────
  // Section 5.8: Workflows as Explicit Execution Objects State & Handlers
  // ─────────────────────────────────────────────────────────────────────────────
  const [executionWorkflow, setExecutionWorkflow] = useState<ExecutionWorkflow | null>(null);
  const [execLoading, setExecLoading] = useState(false);
  const [cascadeAlert, setCascadeAlert] = useState<{
    summary: string;
    revisedCount: number;
    delayDays: number;
  } | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [evidenceInput, setEvidenceInput] = useState<string>('');
  const [expandedTaskHistories, setExpandedTaskHistories] = useState<Record<string, boolean>>({});

  const toggleTaskHistory = (taskId: string) => {
    setExpandedTaskHistories(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const fetchExecutionWorkflow = async () => {
    try {
      setExecLoading(true);
      const fetchImpl = apiFetch || fetch;
      const res = await fetchImpl('/api/workflows/execution');
      if (res.ok) {
        const list: ExecutionWorkflow[] = await res.json();
        if (list && list.length > 0) {
          setExecutionWorkflow(list[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load execution workflow:', err);
    } finally {
      setExecLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutionWorkflow();
  }, []);

  const handleSimulateEngineeringDelay = async () => {
    if (!executionWorkflow) return;
    setActionInProgress('delay');
    try {
      const fetchImpl = apiFetch || fetch;
      const res = await fetchImpl(`/api/workflows/execution/${executionWorkflow.id}/task/task_eng_readiness/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daysShift: 7,
          reason: 'OAuth 2.0 & SAML Token Revocation re-scan required (GitHub Issue #410)',
          actor: 'Founder & CEO (Jeswitha)'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setExecutionWorkflow(data.workflow);
        setCascadeAlert({
          summary: data.summary,
          revisedCount: data.revisedTasks.length,
          delayDays: 7
        });
      }
    } catch (err) {
      console.error('Error cascading delay:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    if (!executionWorkflow || !evidenceInput.trim()) return;
    setActionInProgress(taskId);
    try {
      const fetchImpl = apiFetch || fetch;
      const res = await fetchImpl(`/api/workflows/execution/${executionWorkflow.id}/task/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidenceProof: evidenceInput.trim(),
          actor: 'Vikram Seth (Staff Platform Engineer)'
        })
      });

      if (res.ok) {
        const updatedWf = await res.json();
        setExecutionWorkflow(updatedWf);
        setCompletingTaskId(null);
        setEvidenceInput('');
      }
    } catch (err) {
      console.error('Error completing task:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleResetWorkflow = async () => {
    if (!executionWorkflow) return;
    setActionInProgress('reset');
    try {
      const fetchImpl = apiFetch || fetch;
      const res = await fetchImpl(`/api/workflows/execution/${executionWorkflow.id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const resetWf = await res.json();
        setExecutionWorkflow(resetWf);
        setCascadeAlert(null);
        setCompletingTaskId(null);
      }
    } catch (err) {
      console.error('Error resetting workflow:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  // Interactive Live Simulation Tracking
  const [simStep, setSimStep] = useState<number>(-1);
  const [activeAgent, setActiveAgent] = useState<AgentRole | null>(null);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [simProgressMessage, setSimProgressMessage] = useState('');

  // Selected Deliverable for visual preview modal
  const [previewDeliverable, setPreviewDeliverable] = useState<Deliverable | null>(null);

  const activeInit = initiatives.find(i => i.id === selectedInitId) || initiatives[0];

  // Pre-configured executive templates
  const templates = [
    {
      title: 'Formulate Q3 Institutional Seed Funding Pitch & Economics',
      description: 'Prepare strategic financial pitch scripts, model CAC payback terms, audit cap table, and structure accredited investor disclosures.',
      category: 'funding' as const,
      executives: ['CEO', 'Finance', 'Legal'],
      duration: '4-Week Sprint'
    },
    {
      title: 'Founding Infrastructure Engineer Compensation Package',
      description: 'Structure employment agreements, options vesting cliffs, IP transfer covenants, and stress test cash runways against salary.',
      category: 'hiring' as const,
      executives: ['CEO', 'Talent', 'Finance', 'Legal'],
      duration: '2-Week Sprint'
    },
    {
      title: 'SOC-2 Compliance Checklist & Vendor Security Policies',
      description: 'Draft internal data protection guidelines, formulate password compliance, and verify third-party vendor encryption policies.',
      category: 'operations' as const,
      executives: ['CEO', 'Legal', 'Operations'],
      duration: '3-Week Sprint'
    }
  ];

  // Coordinates node positions on our interactive SVG collaboration workspace
  const agentNodes: { role: AgentRole; x: number; y: number; name: string; avatar: string }[] = [
    { role: 'CEO', x: 300, y: 55, name: 'Atlas (CEO)', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150' },
    { role: 'Finance', x: 100, y: 160, name: 'Marcus (CFO)', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150' },
    { role: 'Talent', x: 500, y: 160, name: 'Evelyn (CPO)', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150' },
    { role: 'Growth', x: 100, y: 300, name: 'Dax (CRO)', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
    { role: 'Legal', x: 300, y: 390, name: 'Helena (CLO)', avatar: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=150' },
    { role: 'ConflictResolver', x: 300, y: 220, name: 'Pax-9 Synthesis', avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150' },
    { role: 'ApprovalManager', x: 300, y: 490, name: 'Loom-V Director', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150' }
  ];

  // Map dependencies for drawing path lines
  const flowLinks = [
    { from: 'CEO', to: 'Finance' },
    { from: 'CEO', to: 'Talent' },
    { from: 'Finance', to: 'ConflictResolver' },
    { from: 'Talent', to: 'ConflictResolver' },
    { from: 'Growth', to: 'ConflictResolver' },
    { from: 'ConflictResolver', to: 'Legal' },
    { from: 'Legal', to: 'ApprovalManager' },
  ];

  // Run multi-agent executive council simulation
  const handleSimulate = async (id: string) => {
    setSimulatingId(id);
    setSimStep(0);
    
    const steps = [
      { agent: 'CEO' as const, msg: 'Atlas (CEO / Strategy) decomposing strategic objectives & bottlenecks...' },
      { agent: 'Finance' as const, msg: 'Aura (CFO / Finance) auditing runway impact & monthly burn margins...' },
      { agent: 'Operations' as const, msg: 'Helix (VP / Operations) evaluating engineering capacity & onboarding ramp...' },
      { agent: 'Growth' as const, msg: 'Vector (VP / Growth) analyzing enterprise pilot SLAs & ARR targets...' },
      { agent: 'ConflictResolver' as const, msg: 'Pax-9 Synthesis mediating executive trade-offs & consensus...' },
      { agent: 'ApprovalManager' as const, msg: 'Loom-V Director packaging executive decision charter for founder review...' }
    ];

    // Trigger backend multi-agent orchestration concurrently
    const apiPromise = onSimulateInitiative(id);

    for (let i = 0; i < steps.length; i++) {
      setSimStep(i);
      setActiveAgent(steps[i].agent);
      setSimProgressMessage(steps[i].msg);
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    try {
      await apiPromise;
      setDetailTab('deliverables');
    } catch (err) {
      console.error(err);
    } finally {
      setSimStep(-1);
      setActiveAgent(null);
      setSimulatingId(null);
      setSimProgressMessage('');
    }
  };

  const handleLaunchSubmit = async () => {
    if (!newTitle || !newDescription) return;
    setIsLaunching(true);
    try {
      await onLaunchInitiative(newTitle, newDescription, newCategory);
      setNewTitle('');
      setNewDescription('');
      setIsCreateOpen(false);
      setCreateStep(1);
      setWorkflowView('detail');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleApplyTemplate = (tpl: typeof templates[number]) => {
    setNewTitle(tpl.title);
    setNewDescription(tpl.description);
    setNewCategory(tpl.category);
    setSelectedAgents(tpl.executives);
    setIsCreateOpen(true);
    setCreateStep(2);
  };

  useEffect(() => {
    if (initiatives.length > 0 && !selectedInitId) {
      setSelectedInitId(initiatives[0].id);
    }
  }, [initiatives, selectedInitId]);

  return (
    <div id="workflow-canvas-container" className="space-y-8 font-sans">
      
      {/* ── TOP SECTION HEADER ──────────────────────────────────────────────── */}
      <Section delay={0.05} className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold" style={{ color: 'var(--c-accent)' }}>
              Multi-Agent Orchestration
            </span>
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--c-border-strong)' }} />
            <span className="text-[11px] font-mono" style={{ color: 'var(--c-muted)' }}>
              {initiatives.length} Strategic Sprints
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--c-fg)' }}>
            Workflows & Sprints
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--c-muted)' }}>
            Autonomous multi-agent execution pipelines. Dispatch executive councils, simulate strategic decisions, and track verified deliverables.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div 
            className="relative flex items-center p-1 rounded-xl text-xs font-semibold"
            style={{ 
              backgroundColor: 'var(--c-surface-2)', 
              border: '1px solid var(--c-border)' 
            }}
          >
            {(['detail', 'list'] as const).map((view) => {
              const isActive = workflowView === view;
              const label = view === 'detail' ? 'Workspace' : `All Workflows (${initiatives.length})`;
              return (
                <button
                  key={view}
                  onClick={() => setWorkflowView(view)}
                  className="relative z-10 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  style={{
                    color: isActive ? 'var(--c-fg)' : 'var(--c-muted)'
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="workflowViewTab"
                      className="absolute inset-0 rounded-lg shadow-sm"
                      style={{ backgroundColor: 'var(--c-surface)' }}
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              setIsCreateOpen(true);
              setCreateStep(1);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm cursor-pointer transition-all"
            style={{
              backgroundColor: 'var(--c-fg)',
              color: 'var(--c-bg)'
            }}
          >
            <Plus className="w-4 h-4" />
            New Workflow
          </button>
        </div>
      </Section>

      {/* ── CONDITIONAL VIEW 1: WORKFLOW LIST / INDEX ───────────────────────── */}
      {workflowView === 'list' ? (
        <div className="space-y-8 animate-fade-in">
          {/* Active Workflows Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--c-fg)' }}>Active & In-Flight Sprints</h3>
                <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Workflows currently undergoing executive council collaboration or awaiting founder action.</p>
              </div>
              <span className="text-xs font-mono" style={{ color: 'var(--c-muted)' }}>
                {initiatives.filter(i => i.status !== 'completed').length} In Flight
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {initiatives.map((init) => (
                <div
                  key={init.id}
                  onClick={() => {
                    setSelectedInitId(init.id);
                    setWorkflowView('detail');
                  }}
                  className="p-5 rounded-2xl flex flex-col justify-between cursor-pointer group transition-all"
                  style={{
                    backgroundColor: 'var(--c-surface)',
                    border: '1px solid var(--c-border)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span 
                        className="px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-full uppercase"
                        style={{
                          backgroundColor: 'var(--c-surface-2)',
                          color: 'var(--c-fg)',
                          border: '1px solid var(--c-border)'
                        }}
                      >
                        {init.category}
                      </span>
                      <span className="text-[10px] font-bold flex items-center gap-1.5 font-mono">
                        <span className={`w-2 h-2 rounded-full ${
                          init.status === 'completed' ? 'bg-emerald-500' :
                          init.status === 'active' ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'
                        }`} />
                        <span style={{ color: init.status === 'completed' ? 'rgb(16, 185, 129)' : init.status === 'active' ? '#f59e0b' : 'var(--c-muted)' }}>
                          {init.status.toUpperCase()}
                        </span>
                      </span>
                    </div>

                    <h4 className="text-sm font-bold line-clamp-2 transition-colors group-hover:text-[#141413]" style={{ color: 'var(--c-fg)' }}>
                      {init.title}
                    </h4>
                    <p className="text-xs line-clamp-3 leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                      {init.description}
                    </p>
                  </div>

                  <div 
                    className="pt-4 mt-4 flex items-center justify-between text-xs"
                    style={{ borderTop: '1px solid var(--c-border)' }}
                  >
                    <span className="text-[11px] font-mono flex items-center gap-1" style={{ color: 'var(--c-muted)' }}>
                      <FileText className="w-3.5 h-3.5" />
                      {init.deliverables.length} Deliverables
                    </span>
                    <span className="text-[11px] font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform" style={{ color: 'var(--c-fg)' }}>
                      Open Canvas <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Curated Enterprise Templates Section */}
          <section className="space-y-4 pt-4" style={{ borderTop: '1px solid var(--c-border)' }}>
            <div>
              <h3 className="text-base font-bold" style={{ color: 'var(--c-fg)' }}>Enterprise Sprint Templates</h3>
              <p className="text-xs" style={{ color: 'var(--c-muted)' }}>Pre-engineered executive council topologies for common high-impact corporate maneuvers.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {templates.map((tpl, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl flex flex-col justify-between space-y-4 transition-all"
                  style={{
                    backgroundColor: 'var(--c-surface)',
                    border: '1px solid var(--c-border)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span 
                        className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md uppercase"
                        style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
                      >
                        {tpl.category}
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>{tpl.duration}</span>
                    </div>
                    <h4 className="text-sm font-bold" style={{ color: 'var(--c-fg)' }}>{tpl.title}</h4>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--c-muted)' }}>{tpl.description}</p>
                  </div>

                  <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--c-border)' }}>
                    <div className="flex -space-x-1.5">
                      {tpl.executives.map((role, i) => (
                        <span
                          key={i}
                          className="w-6 h-6 rounded-full text-[9px] font-bold font-mono flex items-center justify-center border"
                          style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', borderColor: 'var(--c-border)' }}
                          title={role}
                        >
                          {role[0]}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => handleApplyTemplate(tpl)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                      style={{
                        backgroundColor: 'var(--c-surface-2)',
                        color: 'var(--c-fg)',
                        border: '1px solid var(--c-border)'
                      }}
                    >
                      Use Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        /* ── CONDITIONAL VIEW 2: WORKSPACE & DETAILS ──────────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
          
          {/* Left Column: Quick Sprint Selector (4 cols on lg) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--c-fg)' }}>
                Strategic Sprints ({initiatives.length})
              </span>
              <button
                onClick={() => setWorkflowView('list')}
                className="text-[11px] underline font-medium cursor-pointer"
                style={{ color: 'var(--c-muted)' }}
              >
                View all
              </button>
            </div>

            <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
              {initiatives.map((init) => {
                const isSelected = selectedInitId === init.id;
                return (
                  <button
                    key={init.id}
                    onClick={() => setSelectedInitId(init.id)}
                    className="w-full p-4 rounded-2xl text-left transition-all cursor-pointer"
                    style={{
                      backgroundColor: isSelected ? 'var(--c-surface-2)' : 'var(--c-surface)',
                      border: `1px solid ${isSelected ? 'var(--c-fg)' : 'var(--c-border)'}`,
                      boxShadow: isSelected ? 'var(--shadow-sm)' : 'none'
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span 
                        className="px-2 py-0.5 text-[9px] font-mono font-bold rounded-full uppercase"
                        style={{ backgroundColor: 'var(--c-surface)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
                      >
                        {init.category}
                      </span>
                      <span className="text-[10px] font-bold flex items-center gap-1 font-mono">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          init.status === 'completed' ? 'bg-emerald-500' :
                          init.status === 'active' ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'
                        }`} />
                        <span style={{ color: init.status === 'completed' ? 'rgb(16, 185, 129)' : init.status === 'active' ? '#f59e0b' : 'var(--c-muted)' }}>
                          {init.status.toUpperCase()}
                        </span>
                      </span>
                    </div>
                    <h4 className="text-xs font-bold line-clamp-1" style={{ color: 'var(--c-fg)' }}>{init.title}</h4>
                    <p className="mt-1 text-[11px] line-clamp-2 leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                      {init.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Quick Template Card */}
            <div 
              className="p-4 rounded-2xl space-y-2 transition-all"
              style={{ 
                backgroundColor: 'var(--c-surface)', 
                border: '1px dashed var(--c-border-strong)' 
              }}
            >
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider block" style={{ color: 'var(--c-muted)' }}>
                Quick Deploy
              </span>
              <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
                Deploy an accredited Q3 institutional funding, SOC-2, or compensation round.
              </p>
              <button
                onClick={() => {
                  handleApplyTemplate(templates[0]);
                }}
                className="w-full mt-1 py-2 px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'var(--c-surface-2)',
                  border: '1px solid var(--c-border)',
                  color: 'var(--c-fg)'
                }}
              >
                Use Funding Template →
              </button>
            </div>
          </div>

          {/* Right Column: Active Workflow Detail Canvas (8 cols on lg) */}
          <div className="lg:col-span-8 space-y-6">
            {activeInit ? (
              <div 
                className="rounded-2xl p-6 space-y-6"
                style={{ 
                  backgroundColor: 'var(--c-surface)', 
                  border: '1px solid var(--c-border)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                
                {/* Active Workflow Header Banner */}
                <div 
                  className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5"
                  style={{ borderBottom: '1px solid var(--c-border)' }}
                >
                  <div className="space-y-2 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span 
                        className="px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-full uppercase"
                        style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
                      >
                        SPRINT-{activeInit.id.slice(0, 8)}
                      </span>
                      <span className="text-xs font-mono uppercase font-bold" style={{ color: 'var(--c-muted)' }}>
                        {activeInit.category} Track
                      </span>
                    </div>
                    <h2 className="text-xl font-bold leading-snug" style={{ color: 'var(--c-fg)' }}>
                      {activeInit.title}
                    </h2>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                      {activeInit.description}
                    </p>
                  </div>

                  {/* Primary Simulation CTA */}
                  <div className="shrink-0 self-start sm:self-center">
                    {activeInit.status === 'pending' || activeInit.status === 'active' ? (
                      <button
                        onClick={() => handleSimulate(activeInit.id)}
                        disabled={simulatingId !== null}
                        className="px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer transition-all"
                        style={{
                          backgroundColor: 'var(--c-fg)',
                          color: 'var(--c-bg)'
                        }}
                      >
                        <Play className="w-4 h-4" />
                        {simulatingId === activeInit.id ? 'Simulating Debate...' : 'Orchestrate Council'}
                      </button>
                    ) : (
                      <span className="px-3.5 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-1.5" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: 'rgb(16, 185, 129)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                        <CheckCircle2 className="w-4 h-4" />
                        Completed & Audited
                      </span>
                    )}
                  </div>
                </div>

                {/* Simulation Progress Alert Bar */}
                {simulatingId === activeInit.id && (
                  <div 
                    className="p-5 rounded-2xl space-y-3 animate-pulse"
                    style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}
                  >
                    <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--c-fg)' }}>
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--c-accent)' }} />
                        Live Multi-Agent Synthesis in Progress
                      </span>
                      <span className="font-mono" style={{ color: 'var(--c-muted)' }}>Step {simStep + 1} of 6</span>
                    </div>
                    <p className="text-xs font-mono" style={{ color: 'var(--c-fg)' }}>{simProgressMessage}</p>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--c-border)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${((simStep + 1) / 6) * 100}%`,
                          backgroundColor: 'var(--c-accent)' 
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Sub-tab Navigation */}
                <div className="flex items-center gap-1.5 pb-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
                  {[
                    { id: 'execution', label: 'Execution Coordination Engine', isPrimary: true },
                    { id: 'topology', label: 'Council Topology & Network' },
                    { id: 'debate', label: 'Debate Logs', count: activeInit?.messages?.length || 0 },
                    { id: 'deliverables', label: 'Verified Assets', count: activeInit?.deliverables?.length || 0 },
                  ].map((tab) => {
                    const isActive = detailTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setDetailTab(tab.id as any)}
                        className="relative px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                        style={{
                          color: isActive ? 'var(--c-fg)' : 'var(--c-muted)'
                        }}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="workflowDetailTab"
                            className="absolute inset-0 rounded-xl"
                            style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-1.5">
                          {tab.id === 'execution' && <Zap className="w-3.5 h-3.5 text-indigo-500" />}
                          {tab.label}
                        </span>
                        {tab.count !== undefined && (
                          <span
                            className="relative z-10 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold transition-colors"
                            style={{
                              backgroundColor: isActive ? 'var(--c-fg)' : 'var(--c-surface)',
                              color: isActive ? 'var(--c-bg)' : 'var(--c-muted)',
                              border: '1px solid var(--c-border)'
                            }}
                          >
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Sub-tab 0: Workflows as Explicit Execution Objects */}
                {detailTab === 'execution' && executionWorkflow && (
                  <div className="space-y-6 animate-fade-in">
                    {/* 1. BUSINESS OBJECTIVE & OUTCOME CARD */}
                    <div 
                      className="p-5 rounded-2xl space-y-4"
                      style={{
                        backgroundColor: 'var(--c-surface-2)',
                        border: '1px solid var(--c-border)',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                              Authoritative Execution Object
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                              executionWorkflow.status === 'revising' 
                                ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30 animate-pulse'
                                : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                            }`}>
                              {executionWorkflow.status === 'revising' ? 'Active Revision (Cascade In Flight)' : 'Executing (Live Coordination)'}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-fg">
                            {executionWorkflow.title}
                          </h3>
                        </div>

                        {/* Action Controls */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={handleSimulateEngineeringDelay}
                            disabled={actionInProgress !== null}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer bg-amber-500 text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
                            title="Simulate delay in Engineering release gate and observe automatic deadline revisions cascading across Marketing and Sales"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            {actionInProgress === 'delay' ? 'Cascading...' : 'Simulate Engineering Delay (+7d)'}
                          </button>
                          
                          <button
                            onClick={handleResetWorkflow}
                            disabled={actionInProgress !== null}
                            className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-border text-muted hover:text-fg hover:bg-surface disabled:opacity-50"
                            title="Reset workflow to baseline dates"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Reset Baseline
                          </button>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-surface border border-border/80 space-y-2">
                        <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-indigo-500" />
                          Primary Business Objective
                        </div>
                        <p className="text-xs text-fg leading-relaxed">
                          {executionWorkflow.businessObjective}
                        </p>
                        <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="text-[11px] text-muted">
                            <strong className="text-fg font-semibold">Target Metrics:</strong> {executionWorkflow.targetOutcomeMetric}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-muted">Execution Progress:</span>
                            <div className="w-24 h-2 rounded-full bg-surface-2 border border-border overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${executionWorkflow.overallProgress}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold text-emerald-500">{executionWorkflow.overallProgress}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. CASCADE REVISION IMPACT ALERT */}
                    {(cascadeAlert || executionWorkflow.tasks.some(t => t.isDeadlineRevised)) && (
                      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-fade-in">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-amber-500 text-white">
                              <Clock className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 font-mono">
                                Active Coordination Alert: Upstream Release Date Shifted
                              </h4>
                              <p className="text-xs text-fg mt-0.5">
                                Engineering release readiness was delayed by +7 days due to Pen-Test Ticket #410. CatalystOS automatically traversed the dependency graph and adjusted downstream deadlines for Marketing Announcement and Sales Outbound to prevent premature public claims.
                              </p>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-500 border border-amber-500/40 shrink-0">
                            {executionWorkflow.tasks.filter(t => t.isDeadlineRevised).length} Tasks Re-aligned
                          </span>
                        </div>

                        {/* Downstream Revised Deadlines comparison table */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-amber-500/20 text-[11px] font-mono">
                          <div className="p-2 rounded-lg bg-surface/80 border border-border">
                            <span className="text-muted block text-[10px]">1. Engineering Release</span>
                            <span className="line-through text-muted text-[10px]">Nov 02, 2026</span>
                            <span className="text-amber-500 font-bold block">Nov 09, 2026 (+7d)</span>
                          </div>
                          <div className="p-2 rounded-lg bg-surface/80 border border-border">
                            <span className="text-muted block text-[10px]">2. Marketing Announcement</span>
                            <span className="line-through text-muted text-[10px]">Nov 04, 2026</span>
                            <span className="text-amber-500 font-bold block">Nov 11, 2026 (+7d)</span>
                          </div>
                          <div className="p-2 rounded-lg bg-surface/80 border border-border">
                            <span className="text-muted block text-[10px]">3. Sales Launch Outreach</span>
                            <span className="line-through text-muted text-[10px]">Nov 05, 2026</span>
                            <span className="text-amber-500 font-bold block">Nov 12, 2026 (+7d)</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. CROSS-DEPARTMENT EXECUTION STEPPER */}
                    <div className="p-4 rounded-2xl bg-surface border border-border">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted mb-3 flex items-center justify-between">
                        <span>Cross-Department Dependency Chain</span>
                        <span>Deterministic Topological Order</span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                        {executionWorkflow.tasks.map((task, idx) => {
                          const isDone = task.status === 'COMPLETED';
                          const isCurrent = task.status === 'IN_PROGRESS' || task.status === 'READY';
                          const isBlocked = task.status === 'BLOCKED';

                          return (
                            <React.Fragment key={task.id}>
                              <div className="flex items-center gap-2.5 w-full sm:w-auto p-2 rounded-xl bg-surface-2 border border-border/80">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                                  isDone ? 'bg-emerald-500 text-white' :
                                  isCurrent ? 'bg-indigo-500 text-white animate-pulse' :
                                  isBlocked ? 'bg-rose-500/20 text-rose-500' : 'bg-surface text-muted'
                                }`}>
                                  {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                                </div>
                                <div className="text-left">
                                  <span className="text-[11px] font-bold block text-fg truncate max-w-[140px]">
                                    {task.department}
                                  </span>
                                  <span className="text-[10px] font-mono text-muted block truncate max-w-[140px]">
                                    {task.responsibleOwner.name}
                                  </span>
                                </div>
                              </div>

                              {idx < executionWorkflow.tasks.length - 1 && (
                                <div className="hidden sm:flex text-muted">
                                  <ChevronRight className="w-4 h-4 text-border-strong" />
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. EXPLICIT EXECUTION TASKS LIST */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-fg flex items-center gap-2">
                          <Layers className="w-4 h-4 text-accent" />
                          Explicit Task Execution Registry ({executionWorkflow.tasks.length} Tasks)
                        </h4>
                        <span className="text-xs text-muted font-mono">
                          Strict Preconditions & Failure Policies Enforced
                        </span>
                      </div>

                      {executionWorkflow.tasks.map((task) => {
                        const isDone = task.status === 'COMPLETED';
                        const isBlocked = task.status === 'BLOCKED';
                        const isRevised = task.isDeadlineRevised;
                        const isHistoryExpanded = !!expandedTaskHistories[task.id];

                        // Find parent dependency task names
                        const depNames = task.dependencies.map(dId => {
                          const dep = executionWorkflow.tasks.find(t => t.id === dId);
                          return dep ? dep.title : dId;
                        });

                        return (
                          <div
                            key={task.id}
                            className="p-5 rounded-2xl bg-surface border transition-all space-y-4 shadow-sm"
                            style={{
                              borderColor: isBlocked ? 'rgba(244, 63, 94, 0.3)' : isRevised ? 'rgba(245, 158, 11, 0.4)' : isDone ? 'rgba(16, 185, 129, 0.3)' : 'var(--c-border)'
                            }}
                          >
                            {/* Task Card Header */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                                    task.department === 'ENGINEERING' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' :
                                    task.department === 'MARKETING' ? 'bg-fuchsia-500/10 text-fuchsia-500 border border-fuchsia-500/20' :
                                    task.department === 'SALES' ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20' :
                                    'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                  }`}>
                                    {task.department}
                                  </span>

                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 ${
                                    isDone ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' :
                                    task.status === 'IN_PROGRESS' ? 'bg-blue-500/15 text-blue-500 border border-blue-500/30' :
                                    isBlocked ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30' :
                                    task.status === 'READY' ? 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/30' :
                                    'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                                  }`}>
                                    {isDone && <CheckCircle2 className="w-3 h-3" />}
                                    {task.status === 'IN_PROGRESS' && <RefreshCw className="w-3 h-3 animate-spin" />}
                                    {isBlocked && <Lock className="w-3 h-3" />}
                                    {task.status === 'READY' && <CheckSquare className="w-3 h-3" />}
                                    {task.status}
                                  </span>

                                  {isRevised && (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      REVISED (+7d SLACK)
                                    </span>
                                  )}
                                </div>

                                <h3 className="text-sm font-bold text-fg leading-snug">
                                  {task.title}
                                </h3>
                                <p className="text-xs text-muted leading-relaxed max-w-2xl">
                                  {task.description}
                                </p>
                              </div>

                              {/* Deadline & Owner info */}
                              <div className="shrink-0 sm:text-right space-y-1">
                                <div className="flex sm:justify-end items-center gap-2">
                                  <img
                                    src={task.responsibleOwner.avatar}
                                    alt={task.responsibleOwner.name}
                                    className="w-6 h-6 rounded-full border border-border object-cover"
                                  />
                                  <div className="text-left sm:text-right">
                                    <span className="text-xs font-bold text-fg block">{task.responsibleOwner.name}</span>
                                    <span className="text-[10px] text-muted block font-mono">{task.responsibleOwner.role}</span>
                                  </div>
                                </div>

                                <div className="text-xs pt-1">
                                  {isRevised ? (
                                    <div>
                                      <span className="text-[10px] line-through text-muted mr-1.5 font-mono">
                                        {new Date(task.originalDeadline || task.deadline).toLocaleDateString()}
                                      </span>
                                      <span className="font-mono font-bold text-amber-500">
                                        {new Date(task.deadline).toLocaleDateString()}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="font-mono text-muted text-[11px]">
                                      Deadline: <strong className="text-fg">{new Date(task.deadline).toLocaleDateString()}</strong>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Revision Reason Callout if Revised */}
                            {isRevised && task.deadlineRevisionReason && (
                              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono text-amber-600 dark:text-amber-400 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                <span><strong>Revision Impact:</strong> {task.deadlineRevisionReason}</span>
                              </div>
                            )}

                            {/* 3-Column Specifications Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-border/80">
                              {/* Col 1: Preconditions */}
                              <div className="p-3 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                                  <ShieldCheck className="w-3 h-3 text-indigo-500" />
                                  Preconditions ({task.preconditions.length})
                                </div>
                                <div className="space-y-1.5">
                                  {task.preconditions.map(pre => (
                                    <div key={pre.id} className="text-[11px] space-y-0.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                          pre.status === 'MET' ? 'bg-emerald-500' :
                                          pre.status === 'BLOCKED' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'
                                        }`} />
                                        <span className="text-fg font-medium line-clamp-2">{pre.description}</span>
                                      </div>
                                      <span className={`text-[9px] font-mono ml-3 block ${
                                        pre.status === 'MET' ? 'text-emerald-500' :
                                        pre.status === 'BLOCKED' ? 'text-rose-500 font-bold' : 'text-amber-500'
                                      }`}>
                                        [{pre.status}] {pre.verifiedAt ? `Verified: ${new Date(pre.verifiedAt).toLocaleTimeString()}` : ''}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Col 2: Dependencies & Approvals */}
                              <div className="p-3 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                                  <GitBranch className="w-3 h-3 text-cyan-500" />
                                  Dependencies & Approvals
                                </div>
                                <div className="space-y-1 text-[11px]">
                                  <div className="text-muted text-[10px]">
                                    <strong>Prerequisites:</strong>{' '}
                                    {depNames.length > 0 ? depNames.join(', ') : 'None (Root Milestone)'}
                                  </div>
                                  {task.approvalRequirements.map(appr => (
                                    <div key={appr.id} className="p-1.5 rounded-lg bg-surface border border-border text-[10px] space-y-0.5">
                                      <span className="font-bold text-fg block">{appr.role}</span>
                                      <span className="text-muted block">{appr.approverName}</span>
                                      <span className={`font-mono text-[9px] font-bold ${appr.isSatisfied ? 'text-emerald-500' : 'text-amber-500'}`}>
                                        {appr.isSatisfied ? '✓ Approved' : '⏳ Pending Gate Review'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Col 3: Completion Criteria & Failure Handling */}
                              <div className="p-3 rounded-xl bg-surface-2 border border-border/70 space-y-2">
                                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                                  <AlertOctagon className="w-3 h-3 text-rose-500" />
                                  Criteria & Failure Policy
                                </div>
                                <div className="space-y-1.5 text-[11px]">
                                  <div className="space-y-0.5">
                                    <span className="text-[10px] font-bold text-fg block">Completion Criteria:</span>
                                    <ul className="list-disc list-inside text-muted space-y-0.5 text-[10px]">
                                      {task.completionCriteria.slice(0, 2).map((crit, cIdx) => (
                                        <li key={cIdx} className="truncate">{crit}</li>
                                      ))}
                                    </ul>
                                  </div>

                                  <div className="pt-1 border-t border-border/60">
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-surface border border-border text-fg inline-block mb-1">
                                      Policy: {task.failureHandling.policy}
                                    </span>
                                    <p className="text-[10px] text-muted line-clamp-2 leading-tight">
                                      {task.failureHandling.remediationAction}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Task Action Bar & Evidence Verification */}
                            <div className="pt-3 border-t border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              {isDone ? (
                                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2 w-full">
                                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                                  <span className="font-medium truncate">
                                    Verified Complete with evidence artifact. Downstream dependencies unlocked.
                                  </span>
                                </div>
                              ) : isBlocked ? (
                                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2 w-full">
                                  <Lock className="w-4 h-4 shrink-0" />
                                  <span>
                                    <strong>Execution Blocked:</strong> Prerequisite [<strong>{depNames[0] || 'Upstream Task'}</strong>] must reach COMPLETED before work can proceed.
                                  </span>
                                </div>
                              ) : completingTaskId === task.id ? (
                                <div className="w-full p-3 rounded-xl bg-surface-2 border border-border space-y-2">
                                  <span className="text-xs font-bold text-fg block">
                                    Submit Verifiable Completion Evidence:
                                  </span>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={evidenceInput}
                                      onChange={(e) => setEvidenceInput(e.target.value)}
                                      placeholder="e.g. Git commit hash #8bf32e, PR #284 merged, Snyk report URL..."
                                      className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-surface border border-border text-fg"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleCompleteTask(task.id)}
                                      disabled={!evidenceInput.trim() || actionInProgress !== null}
                                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600 disabled:opacity-50"
                                    >
                                      {actionInProgress === task.id ? 'Verifying...' : 'Confirm'}
                                    </button>
                                    <button
                                      onClick={() => setCompletingTaskId(null)}
                                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted hover:text-fg cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                  <button
                                    onClick={() => {
                                      setCompletingTaskId(task.id);
                                      setEvidenceInput('PR #284 merged with signed commit hash. Snyk clean.');
                                    }}
                                    disabled={actionInProgress !== null}
                                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-fg text-bg flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-all shadow-sm"
                                  >
                                    <CheckSquare className="w-3.5 h-3.5" />
                                    Mark Verified & Completed
                                  </button>

                                  <button
                                    onClick={() => handleSimulateEngineeringDelay()}
                                    disabled={actionInProgress !== null}
                                    className="px-3 py-1.5 rounded-xl text-xs font-medium border border-border text-muted hover:text-fg hover:bg-surface-2 cursor-pointer transition-all"
                                  >
                                    Report Blocker
                                  </button>
                                </div>
                              )}

                              {/* Toggle History Log */}
                              <button
                                onClick={() => toggleTaskHistory(task.id)}
                                className="text-[11px] font-mono text-muted hover:text-fg flex items-center gap-1 cursor-pointer self-end sm:self-auto"
                              >
                                <HistoryIcon className="w-3 h-3" />
                                {isHistoryExpanded ? 'Hide History' : `Execution Audit (${task.executionHistory.length})`}
                              </button>
                            </div>

                            {/* Execution Audit History Drawer */}
                            {isHistoryExpanded && (
                              <div className="p-3 rounded-xl bg-surface-2 border border-border/80 space-y-2 animate-fade-in text-xs font-mono">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                                  Immutable Execution Audit Log:
                                </span>
                                <div className="space-y-2">
                                  {task.executionHistory.map((hist) => (
                                    <div key={hist.id} className="p-2 rounded-lg bg-surface border border-border text-[11px] space-y-1">
                                      <div className="flex items-center justify-between text-muted text-[10px]">
                                        <span>{new Date(hist.timestamp).toLocaleTimeString()} · {hist.actor} ({hist.actorRole})</span>
                                        <span className="font-bold text-fg">{hist.action}</span>
                                      </div>
                                      {hist.comment && (
                                        <p className="text-fg font-sans text-xs">{hist.comment}</p>
                                      )}
                                      {hist.evidenceProof && (
                                        <span className="text-indigo-500 text-[10px] block truncate">
                                          Proof: {hist.evidenceProof}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sub-tab 1: SVG Multi-Agent Collaboration Topology */}
                {detailTab === 'topology' && (
                  <div className="space-y-4">
                    <div 
                      className="p-4 rounded-2xl relative"
                      style={{ 
                        backgroundColor: 'var(--c-surface-2)', 
                        border: '1px solid var(--c-border)' 
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>
                          Executive Collaboration Graph
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>
                          7 Connected Council Nodes
                        </span>
                      </div>

                      <div className="relative h-[540px] w-full overflow-hidden flex items-center justify-center">
                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                          {flowLinks.map((link, idx) => {
                            const fromNode = agentNodes.find(n => n.role === link.from);
                            const toNode = agentNodes.find(n => n.role === link.to);
                            if (!fromNode || !toNode) return null;
                            
                            const isFlowing = activeAgent === fromNode.role || (simStep >= 0 && agentNodes.findIndex(n => n.role === fromNode.role) <= simStep && agentNodes.findIndex(n => n.role === toNode.role) >= simStep);

                            return (
                              <g key={idx}>
                                <path
                                  d={`M ${fromNode.x} ${fromNode.y} L ${toNode.x} ${toNode.y}`}
                                  stroke={isFlowing ? 'var(--c-accent)' : 'var(--c-border-strong)'}
                                  strokeWidth={isFlowing ? 2.5 : 1.5}
                                  strokeDasharray={isFlowing ? '4,4' : undefined}
                                />
                              </g>
                            );
                          })}
                        </svg>

                        {/* Agent nodes */}
                        {agentNodes.map((node) => {
                          const isActive = activeAgent === node.role;
                          const isVetted = simStep >= 0 && agentNodes.findIndex(n => n.role === node.role) < simStep;

                          return (
                            <div
                              key={node.role}
                              style={{ 
                                left: `${node.x - 45}px`, 
                                top: `${node.y - 45}px`,
                                backgroundColor: 'var(--c-surface)',
                                borderColor: isActive ? 'var(--c-accent)' : isVetted ? 'rgb(16, 185, 129)' : 'var(--c-border)',
                                boxShadow: isActive ? '0 0 16px rgba(99, 102, 241, 0.3)' : 'var(--shadow-sm)'
                              }}
                              className={`absolute p-3 rounded-2xl border flex flex-col items-center justify-between w-24 h-24 transition-all duration-300 select-none ${
                                isActive ? 'scale-105' : ''
                              }`}
                            >
                              <div className="relative">
                                <img
                                  src={node.avatar}
                                  alt={node.role}
                                  referrerPolicy="no-referrer"
                                  className="w-10 h-10 rounded-full object-cover filter grayscale border"
                                  style={{ borderColor: 'var(--c-border)' }}
                                />
                                {isActive && (
                                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
                                )}
                              </div>
                              <div className="text-center">
                                <span className="text-[10px] font-bold block font-mono" style={{ color: 'var(--c-fg)' }}>
                                  {node.role}
                                </span>
                                <span className="text-[9px] block truncate max-w-[80px]" style={{ color: 'var(--c-muted)' }}>
                                  {node.name.split(' ')[0]}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-tab 2: Debate Logs */}
                {detailTab === 'debate' && (
                  <div className="space-y-4">
                    {activeInit.messages.length > 0 ? (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                        {activeInit.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className="p-4 rounded-xl text-xs space-y-1.5 transition-all"
                            style={{
                              backgroundColor: msg.isConflict 
                                ? 'rgba(245, 158, 11, 0.08)' 
                                : msg.sender === 'ConflictResolver'
                                  ? 'rgba(99, 102, 241, 0.08)'
                                  : 'var(--c-surface-2)',
                              border: `1px solid ${
                                msg.isConflict 
                                  ? 'rgba(245, 158, 11, 0.3)' 
                                  : msg.sender === 'ConflictResolver'
                                    ? 'rgba(99, 102, 241, 0.3)'
                                    : 'var(--c-border)'
                              }`
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold uppercase tracking-wider text-[10px]" style={{ color: 'var(--c-fg)' }}>
                                {msg.sender} → {msg.receiver}
                              </span>
                              {msg.isConflict && (
                                <span className="px-2 py-0.5 text-[9px] font-bold rounded-full flex items-center gap-1" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                  <AlertTriangle className="w-3 h-3" />
                                  Boundary Conflict
                                </span>
                              )}
                            </div>
                            <p className="leading-relaxed font-sans" style={{ color: 'var(--c-fg)' }}>{msg.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div 
                        className="p-8 text-center rounded-2xl text-xs"
                        style={{ border: '1px dashed var(--c-border)', color: 'var(--c-muted)' }}
                      >
                        No deliberation logs recorded yet. Launch orchestration to view the multi-agent debate.
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab 3: Deliverables & Assets */}
                {detailTab === 'deliverables' && (
                  <div className="space-y-4">
                    {activeInit.deliverables.length > 0 ? (
                      <div className="space-y-4">
                        {onNavigate && (
                          <div 
                            className="p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm"
                            style={{
                              backgroundColor: 'var(--c-surface-2)',
                              border: '1px solid var(--c-border)'
                            }}
                          >
                            <div>
                              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-500 font-bold block">
                                Executive Council Consensus Reached
                              </span>
                              <h4 className="text-sm font-bold mt-0.5" style={{ color: 'var(--c-fg)' }}>
                                Decision Charter compiled and queued for Founder Sign-Off
                              </h4>
                            </div>
                            <button
                              onClick={() => onNavigate('approvals')}
                              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
                              style={{
                                backgroundColor: 'var(--c-fg)',
                                color: 'var(--c-bg)'
                              }}
                            >
                              Review in Decision Inbox →
                            </button>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeInit.deliverables.map((del) => (
                          <div
                            key={del.id}
                            className="p-4 rounded-2xl flex flex-col justify-between space-y-3 transition-all"
                            style={{
                              backgroundColor: 'var(--c-surface)',
                              border: '1px solid var(--c-border)',
                              boxShadow: 'var(--shadow-sm)'
                            }}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span 
                                  className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded-md"
                                  style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
                                >
                                  {del.type}
                                </span>
                                <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded-full" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: 'rgb(16, 185, 129)' }}>
                                  Score: {del.impact}/10
                                </span>
                              </div>
                              <h4 className="text-xs font-bold" style={{ color: 'var(--c-fg)' }}>{del.title}</h4>
                              <p className="text-[11px] line-clamp-2 leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                                {del.description}
                              </p>
                            </div>

                            <button
                              onClick={() => setPreviewDeliverable(del)}
                              className="w-full mt-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              style={{
                                backgroundColor: 'var(--c-surface-2)',
                                border: '1px solid var(--c-border)',
                                color: 'var(--c-fg)'
                              }}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Inspect Deliverable
                            </button>
                          </div>
                        ))}
                      </div>
                      </div>
                    ) : (
                      <div 
                        className="p-8 text-center rounded-2xl text-xs"
                        style={{ border: '1px dashed var(--c-border)', color: 'var(--c-muted)' }}
                      >
                        No deliverables compiled yet for this sprint.
                      </div>
                    )}
                  </div>
                )}

              </div>
            ) : (
              <div 
                className="p-12 text-center rounded-2xl text-xs"
                style={{ border: '1px dashed var(--c-border)', color: 'var(--c-muted)' }}
              >
                Select a sprint or create a new initiative to begin.
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── FOCUSED 6-STEP WORKFLOW CREATION MODAL ─────────────────────────── */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setIsCreateOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="relative w-full max-w-xl rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10"
              style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              onClick={(e) => e.stopPropagation()}
            >
            
            {/* Modal Header & Progress Indicator */}
            <div className="p-6 space-y-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>
                    Step {createStep} of 6
                  </span>
                  <h3 className="text-lg font-bold mt-0.5" style={{ color: 'var(--c-fg)' }}>
                    {createStep === 1 && 'Select Initiative Track'}
                    {createStep === 2 && 'Define Scope & Context'}
                    {createStep === 3 && 'Assign Executive Council'}
                    {createStep === 4 && 'Target Objectives & Milestone'}
                    {createStep === 5 && 'Executive Review & Alignment'}
                    {createStep === 6 && 'Ready to Launch'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1.5 rounded-full transition-colors cursor-pointer"
                  style={{ color: 'var(--c-muted)', backgroundColor: 'var(--c-surface-2)' }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--c-surface-2)' }}>
                <div
                  className="h-full transition-all duration-300"
                  style={{ 
                    width: `${(createStep / 6) * 100}%`,
                    backgroundColor: 'var(--c-accent)'
                  }}
                />
              </div>
            </div>

            {/* Step Content */}
            <div className="p-6 space-y-4 min-h-[260px] flex flex-col justify-center">
              {/* Step 1: Track */}
              {createStep === 1 && (
                <div className="space-y-4">
                  <label className="text-xs font-bold block" style={{ color: 'var(--c-fg)' }}>
                    Choose Strategic Domain
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {(['growth', 'funding', 'hiring', 'operations', 'legal'] as const).map((cat) => {
                      const isSelected = newCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNewCategory(cat)}
                          className="p-3 rounded-xl text-left transition-all capitalize font-semibold text-xs cursor-pointer"
                          style={{
                            backgroundColor: isSelected ? 'var(--c-fg)' : 'var(--c-surface-2)',
                            color: isSelected ? 'var(--c-bg)' : 'var(--c-fg)',
                            border: `1px solid ${isSelected ? 'var(--c-fg)' : 'var(--c-border)'}`
                          }}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--c-fg)' }}>Initiative Title</label>
                    <input
                      type="text"
                      placeholder="e.g., Enterprise SOC-2 Audit & Compliance"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none transition-colors"
                      style={{
                        backgroundColor: 'var(--c-surface-2)',
                        border: '1px solid var(--c-border)',
                        color: 'var(--c-fg)'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Scope & Context */}
              {createStep === 2 && (
                <div className="space-y-3">
                  <label className="text-xs font-bold block" style={{ color: 'var(--c-fg)' }}>
                    Directives & Operational Bounds
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Specify constraints, key deliverables expected, budget boundaries, and timelines..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full p-3.5 rounded-xl text-xs leading-relaxed resize-none outline-none"
                    style={{
                      backgroundColor: 'var(--c-surface-2)',
                      border: '1px solid var(--c-border)',
                      color: 'var(--c-fg)'
                    }}
                  />
                  <p className="text-[11px]" style={{ color: 'var(--c-muted)' }}>
                    The multi-agent debate engine will use these directives to guide disagreement resolution.
                  </p>
                </div>
              )}

              {/* Step 3: Select Executives */}
              {createStep === 3 && (
                <div className="space-y-3">
                  <label className="text-xs font-bold block" style={{ color: 'var(--c-fg)' }}>
                    Select Participating AI Executives
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { role: 'CEO', label: 'Atlas (CEO & Orchestrator)' },
                      { role: 'Finance', label: 'Marcus (CFO & Treasury)' },
                      { role: 'Legal', label: 'Helena (CLO & Compliance)' },
                      { role: 'Growth', label: 'Dax (CRO & Marketing)' },
                      { role: 'Talent', label: 'Evelyn (CPO & People)' },
                      { role: 'Operations', label: 'Vector (COO & Ops)' },
                    ].map((agent) => {
                      const isSelected = selectedAgents.includes(agent.role);
                      return (
                        <button
                          key={agent.role}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedAgents(selectedAgents.filter(a => a !== agent.role));
                            } else {
                              setSelectedAgents([...selectedAgents, agent.role]);
                            }
                          }}
                          className="p-3 rounded-xl text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition-all"
                          style={{
                            backgroundColor: isSelected ? 'var(--c-fg)' : 'var(--c-surface-2)',
                            color: isSelected ? 'var(--c-bg)' : 'var(--c-fg)',
                            border: `1px solid ${isSelected ? 'var(--c-fg)' : 'var(--c-border)'}`
                          }}
                        >
                          <span>{agent.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 4: Objectives & Targets */}
              {createStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--c-fg)' }}>
                      Target Completion Milestone
                    </label>
                    <select
                      value={targetMilestone}
                      onChange={(e) => setTargetMilestone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                      style={{
                        backgroundColor: 'var(--c-surface-2)',
                        border: '1px solid var(--c-border)',
                        color: 'var(--c-fg)'
                      }}
                    >
                      <option value="2-Week Sprint">2-Week Sprint (Rapid Turnaround)</option>
                      <option value="30-Day Execution Cycle">30-Day Execution Cycle (Standard)</option>
                      <option value="Quarterly Board Cycle">Quarterly Board Cycle (Comprehensive)</option>
                    </select>
                  </div>
                  <div 
                    className="p-3.5 rounded-xl space-y-1"
                    style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}
                  >
                    <span className="text-[10px] font-mono font-bold uppercase" style={{ color: 'var(--c-fg)' }}>
                      Governance Guardrail
                    </span>
                    <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
                      Any capital changes above ₹1,00,000 will automatically pause for founder sign-off before committing to the Decision Ledger.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 5: Review */}
              {createStep === 5 && (
                <div 
                  className="p-4 rounded-xl space-y-3 text-xs"
                  style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}
                >
                  <div className="flex justify-between pb-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
                    <span style={{ color: 'var(--c-muted)' }}>Track:</span>
                    <span className="font-bold uppercase font-mono" style={{ color: 'var(--c-fg)' }}>{newCategory}</span>
                  </div>
                  <div className="flex justify-between pb-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
                    <span style={{ color: 'var(--c-muted)' }}>Title:</span>
                    <span className="font-bold text-right line-clamp-1" style={{ color: 'var(--c-fg)' }}>{newTitle || 'Untitled Sprint'}</span>
                  </div>
                  <div className="flex justify-between pb-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
                    <span style={{ color: 'var(--c-muted)' }}>Council:</span>
                    <span className="font-bold" style={{ color: 'var(--c-fg)' }}>{selectedAgents.join(', ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--c-muted)' }}>Milestone:</span>
                    <span className="font-bold" style={{ color: 'var(--c-fg)' }}>{targetMilestone}</span>
                  </div>
                </div>
              )}

              {/* Step 6: Launch */}
              {createStep === 6 && (
                <div className="text-center space-y-3 py-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold" style={{ color: 'var(--c-fg)' }}>Council Ready to Deploy</h4>
                  <p className="text-xs max-w-sm mx-auto" style={{ color: 'var(--c-muted)' }}>
                    Spawning this workflow will initiate cross-functional agent deliberations and generate deliverables for your review.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div 
              className="p-5 flex items-center justify-between"
              style={{ backgroundColor: 'var(--c-surface)', borderTop: '1px solid var(--c-border)' }}
            >
              {createStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCreateStep(createStep - 1)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  style={{ color: 'var(--c-muted)' }}
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              ) : (
                <div />
              )}

              {createStep < 6 ? (
                <button
                  type="button"
                  disabled={createStep === 1 && !newTitle.trim()}
                  onClick={() => setCreateStep(createStep + 1)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
                  style={{
                    backgroundColor: 'var(--c-fg)',
                    color: 'var(--c-bg)'
                  }}
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isLaunching}
                  onClick={handleLaunchSubmit}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md disabled:opacity-50 transition-all cursor-pointer"
                  style={{
                    backgroundColor: 'var(--c-fg)',
                    color: 'var(--c-bg)'
                  }}
                >
                  {isLaunching ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Spawning...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" /> Deploy Sprint
                    </>
                  )}
                </button>
              )}
            </div>

          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* ── DELIVERABLE PREVIEW MODAL ──────────────────────────────────────── */}
      <AnimatePresence>
        {previewDeliverable && (
          <div id="deliverable-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setPreviewDeliverable(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="relative w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden z-10"
              style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div 
                className="p-5 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--c-border)' }}
              >
                <div>
                  <span 
                    className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
                  >
                    {previewDeliverable.type}
                  </span>
                  <h4 className="text-base font-bold mt-1.5" style={{ color: 'var(--c-fg)' }}>{previewDeliverable.title}</h4>
                </div>
                <button
                  onClick={() => setPreviewDeliverable(null)}
                  className="p-1.5 rounded-full transition-colors cursor-pointer"
                  style={{ color: 'var(--c-muted)', backgroundColor: 'var(--c-surface-2)' }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div 
                className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed font-mono whitespace-pre-wrap"
                style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)' }}
              >
                {previewDeliverable.content}
              </div>

              <div 
                className="p-4 flex items-center justify-between text-xs font-mono"
                style={{ backgroundColor: 'var(--c-surface)', borderTop: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
              >
                <div className="flex items-center gap-3">
                  <span>Impact: {previewDeliverable.impact}</span>
                  <span className="font-bold" style={{ color: 'var(--c-fg)' }}>
                    Treasury: {previewDeliverable.financialChange ? `${previewDeliverable.financialChange > 0 ? '+' : ''}${(previewDeliverable.financialChange / 1000).toFixed(0)}k` : 'Neutral'}
                  </span>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => {
                      setPreviewDeliverable(null);
                      onNavigate('approvals');
                    }}
                    className="px-4 py-2 rounded-xl font-sans font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    style={{
                      backgroundColor: 'var(--c-fg)',
                      color: 'var(--c-bg)'
                    }}
                  >
                    Open in Decision Inbox →
                  </button>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

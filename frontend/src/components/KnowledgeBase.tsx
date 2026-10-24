/**
 * CatalystOS - Company Knowledge Base (Section 16)
 * Redesigned with Apple × Notion × Linear aesthetics.
 * Institutional Memory & Truth (Documents, Research, Strategy, Financials, Customer & Product Info).
 * Semantic token integration, smooth upload zones, interactive QA hub, and vector status.
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { KnowledgeFile, FactProvenance, DisagreementResolutionCase } from '../types';
import {
  UploadCloud, FileText, Search, Sparkles, Send, Calendar,
  Loader2, CheckCircle2, AlertTriangle, X,
  ChevronDown, Lightbulb, Layers, Globe, ArrowRight, ArrowLeft,
  Trash2, Check, FileUp, Link as LinkIcon, RefreshCw,
  ShieldCheck, Scale, Clock, CheckSquare, GitCompare, Info,
  Database, Activity, ExternalLink, HelpCircle, BadgeAlert, ArrowUpRight
} from 'lucide-react';
import Section from './Section';

interface KnowledgeBaseProps {
  documents: KnowledgeFile[];
  onUploadDoc: (name: string, content: string, type: string, fileData?: string, mimeType?: string) => Promise<void>;
}

interface ActiveUpload {
  id: string;
  name: string;
  size: string;
  progress: number;
  status: 'reading' | 'uploading' | 'analyzing' | 'completed' | 'failed';
  error?: string;
}

const CATEGORIES = [
  { id: 'ALL', label: 'All Knowledge' },
  { id: 'strategy', label: 'Strategy & Pitch' },
  { id: 'financials', label: 'Financials' },
  { id: 'research', label: 'Research & Notes' },
  { id: 'product', label: 'Product & Tech' },
  { id: 'legal', label: 'Legal & Contracts' },
];

const DOC_TYPES = [
  { value: 'pitch_deck', label: 'Pitch Deck (Strategy)' },
  { value: 'business_plan', label: 'Business Plan (Strategy)' },
  { value: 'financial_reports', label: 'Financial Report (Financials)' },
  { value: 'hiring_docs', label: 'Hiring Document (People)' },
  { value: 'meeting_notes', label: 'Meeting Notes & Research' },
  { value: 'legal', label: 'Legal Document (Compliance)' },
  { value: 'other', label: 'Product & Other' },
];

const QUICK_PROMPTS = [
  "What is our current cash runway?",
  "Is our Multi-Tenant Auth feature ready for customer launch?",
  "Summarize our target investor narrative",
  "What are our key quarterly milestones?",
];

export default function KnowledgeBase({ documents, onUploadDoc }: KnowledgeBaseProps) {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchDocQuery, setSearchDocQuery] = useState('');
  const [uploadTab, setUploadTab] = useState<'file' | 'paste'>('file');
  const [docType, setDocType] = useState('pitch_deck');
  const [isDragging, setIsDragging] = useState(false);
  const [activeUploads, setActiveUploads] = useState<ActiveUpload[]>([]);
  const [successToast, setSuccessToast] = useState(false);

  // Quick Paste text state
  const [docName, setDocName] = useState('');
  const [docContent, setDocContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // ── 3-STEP SOURCE INGESTION WIZARD STATE ───────────────────────────────────
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [sourceType, setSourceType] = useState<'file' | 'text' | 'url'>('file');
  const [wizardFile, setWizardFile] = useState<File | null>(null);
  const [wizardFileBase64, setWizardFileBase64] = useState<string>('');
  const [wizardDocName, setWizardDocName] = useState('');
  const [wizardTextContent, setWizardTextContent] = useState('');
  const [wizardUrl, setWizardUrl] = useState('');
  const [wizardUrlNotes, setWizardUrlNotes] = useState('');
  const [wizardDocType, setWizardDocType] = useState('pitch_deck');
  const [wizardDragging, setWizardDragging] = useState(false);
  const [ingestionStatus, setIngestionStatus] = useState<'idle' | 'uploading' | 'indexing' | 'completed' | 'failed'>('idle');
  const [ingestionError, setIngestionError] = useState<string | null>(null);

  const wizardFileInputRef = useRef<HTMLInputElement>(null);

  const openWizard = (type: 'file' | 'text' | 'url' = 'file') => {
    setSourceType(type);
    setWizardStep(1);
    setIngestionStatus('idle');
    setIngestionError(null);
    setIsWizardOpen(true);
  };

  const closeWizard = () => {
    setIsWizardOpen(false);
    if (ingestionStatus === 'completed') {
      resetWizard();
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setWizardFile(null);
    setWizardFileBase64('');
    setWizardDocName('');
    setWizardTextContent('');
    setWizardUrl('');
    setWizardUrlNotes('');
    setWizardDocType('pitch_deck');
    setIngestionStatus('idle');
    setIngestionError(null);
  };

  const handleWizardFileSelect = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const allowed = ['pdf', 'docx', 'pptx', 'csv', 'txt', 'md'];
    if (!allowed.includes(ext)) {
      setIngestionError(`Invalid file format .${ext}. Supported formats: PDF, DOCX, PPTX, CSV, TXT, MD.`);
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setIngestionError(`File size exceeds 15MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }
    setIngestionError(null);
    setWizardFile(file);
    if (!wizardDocName) {
      setWizardDocName(file.name.replace(/\.[^/.]+$/, ''));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const b64 = dataUrl.split(',')[1] || '';
      setWizardFileBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleWizardSubmit = async () => {
    setIngestionError(null);
    setIngestionStatus('uploading');

    try {
      let finalName = wizardDocName.trim();
      let finalContent = '';
      let fileB64: string | undefined = undefined;
      let mimeType: string | undefined = undefined;

      if (sourceType === 'file') {
        if (!wizardFile || !wizardFileBase64) {
          throw new Error('Please select a valid document file before submitting.');
        }
        finalName = finalName || wizardFile.name;
        fileB64 = wizardFileBase64;
        mimeType = wizardFile.type;
      } else if (sourceType === 'text') {
        if (!wizardTextContent.trim()) {
          throw new Error('Please enter text or markdown content for the document.');
        }
        finalName = finalName || 'Corporate Knowledge Note';
        finalContent = wizardTextContent.trim();
      } else if (sourceType === 'url') {
        if (!wizardUrl.trim() || !/^https?:\/\/.+/i.test(wizardUrl.trim())) {
          throw new Error('Please provide a valid URL starting with http:// or https://');
        }
        try {
          const parsed = new URL(wizardUrl.trim());
          finalName = finalName || `Web Source: ${parsed.hostname}${parsed.pathname !== '/' ? parsed.pathname : ''}`;
        } catch {
          finalName = finalName || wizardUrl.trim();
        }
        finalContent = `Source URL: ${wizardUrl.trim()}\n\nVerified Summary & Key Notes:\n${wizardUrlNotes.trim() || 'Institutional external documentation reference.'}`;
      }

      setIngestionStatus('indexing');
      await onUploadDoc(finalName, finalContent, wizardDocType, fileB64, mimeType);
      setIngestionStatus('completed');
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 4000);
    } catch (err: any) {
      console.error('Wizard ingestion error:', err);
      setIngestionStatus('failed');
      setIngestionError(err?.message || 'Failed to ingest knowledge source. Please check backend connectivity and retry.');
    }
  };

  // Selected doc
  const [selectedDocId, setSelectedDocId] = useState<string>(documents[0]?.id || '');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // ── Section 5.7: Knowledge Provenance & Disagreement State ────────────────
  const [knowledgeMode, setKnowledgeMode] = useState<'DOCUMENTS' | 'PROVENANCE_LEDGER' | 'DISAGREEMENTS'>('DOCUMENTS');
  const [provenanceFacts, setProvenanceFacts] = useState<FactProvenance[]>([
    {
      factId: 'fact_cash_live',
      key: 'cash_balance',
      label: 'Treasury Cash Balance',
      value: 4250000,
      formattedValue: '₹42,50,000',
      unit: 'INR',
      category: 'OPERATIONAL_STATE',
      department: 'Finance',
      sourceType: 'INTEGRATION',
      sourceName: 'Authoritative Bank Ledger (HDFC Corporate Treasury)',
      sourceDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      extractionTimestamp: new Date().toISOString(),
      verificationMethod: 'INTEGRATION_FEED',
      verifiedBy: 'System Direct Integration (HDFC OpenBanking)',
      freshness: 'FRESH',
      isAuthoritative: true,
      hasConflict: true,
      conflictDetails: {
        conflictingFactId: 'fact_cash_deck',
        conflictingSource: 'Financial_Model_v1_Forecast.xlsx (Uploaded 2 months ago)',
        conflictingValue: '₹72,00,000',
        conflictingDate: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString(),
        conflictingCategory: 'DESCRIPTIVE',
        severity: 'HARD_CONFLICT',
        arbitrationRule: 'Rule 1: Operational Truth Dominance (Reality > Aspiration) & Rule 2: Temporal Precedence',
        resolution: 'Live HDFC Bank Ledger (₹42.5L) used for runway calculation instead of outdated spreadsheet (₹72L). Overestimating runway prevented.'
      }
    },
    {
      factId: 'fact_cash_deck',
      key: 'cash_balance_projected',
      label: 'Q3 Projected Cash Balance (Forecast)',
      value: 7200000,
      formattedValue: '₹72,00,000',
      unit: 'INR',
      category: 'DESCRIPTIVE',
      department: 'Finance',
      sourceType: 'DOCUMENT',
      sourceName: 'Financial_Model_v1_Forecast.xlsx',
      sourceDate: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString(),
      extractionTimestamp: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString(),
      verificationMethod: 'EXTRACTED',
      verifiedBy: 'Document Ingestion Pipeline',
      freshness: 'STALE',
      staleReason: 'Extracted from spreadsheet authored 62 days ago. Does not account for recent payroll disbursements.',
      isAuthoritative: false,
      hasConflict: true,
      conflictDetails: {
        conflictingFactId: 'fact_cash_live',
        conflictingSource: 'Authoritative Bank Ledger (HDFC Corporate Treasury)',
        conflictingValue: '₹42,50,000',
        conflictingDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        conflictingCategory: 'OPERATIONAL_STATE',
        severity: 'HARD_CONFLICT',
        arbitrationRule: 'Rule 1: Operational Truth Dominance (Reality > Aspiration)',
        resolution: 'Relegated to historical forecast archive. Cannot be cited as current solvency.'
      }
    },
    {
      factId: 'fact_burn_rate',
      key: 'monthly_burn_rate',
      label: 'Monthly Net Burn Rate',
      value: 800000,
      formattedValue: '₹8,00,000 / mo',
      unit: 'INR/mo',
      category: 'OPERATIONAL_STATE',
      department: 'Finance',
      sourceType: 'SYSTEM_RECORD',
      sourceName: 'Audited Payroll Run & Cloud Invoices (RazorpayX + AWS)',
      sourceDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      extractionTimestamp: new Date().toISOString(),
      verificationMethod: 'CALCULATED',
      verifiedBy: 'CFO Agent (Autonomous Audit Engine)',
      freshness: 'FRESH',
      isAuthoritative: true,
      hasConflict: true,
      conflictDetails: {
        conflictingFactId: 'fact_burn_pitch_deck',
        conflictingSource: 'Catalyst_Seed_Pitch_Deck.pdf (Slide 14)',
        conflictingValue: '₹4,50,000 / mo',
        conflictingDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        conflictingCategory: 'DESCRIPTIVE',
        severity: 'DIVERGENT',
        arbitrationRule: 'Rule 1: Operational Truth Dominance',
        resolution: 'Live payroll and AWS telemetry reflects current active burn rate (₹8L/mo).'
      }
    },
    {
      factId: 'fact_runway',
      key: 'runway_months',
      label: 'Calculated Solvency Runway',
      value: 5.3,
      formattedValue: '5.3 Months',
      unit: 'months',
      category: 'OPERATIONAL_STATE',
      department: 'Finance',
      sourceType: 'SYSTEM_RECORD',
      sourceName: 'CatalystOS Solvency Guard (₹42.5L / ₹8L)',
      sourceDate: new Date().toISOString(),
      extractionTimestamp: new Date().toISOString(),
      verificationMethod: 'CALCULATED',
      verifiedBy: 'Institutional Solvency Engine',
      freshness: 'FRESH',
      isAuthoritative: true,
      hasConflict: false
    },
    {
      factId: 'fact_auth_feature_live',
      key: 'feature_multi_tenant_auth_status',
      label: 'Multi-Tenant Auth & SAML SSO Status',
      value: 'IN_PROGRESS',
      formattedValue: 'IN_PROGRESS (Security Review Pending)',
      category: 'OPERATIONAL_STATE',
      department: 'Engineering',
      sourceType: 'SYSTEM_RECORD',
      sourceName: 'Engineering Task Tracker (#410 "Penetration Testing & OAuth Revocation")',
      sourceDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      extractionTimestamp: new Date().toISOString(),
      verificationMethod: 'INTEGRATION_FEED',
      verifiedBy: 'GitHub & CI/CD Pipeline Telemetry',
      freshness: 'FRESH',
      isAuthoritative: true,
      hasConflict: true,
      conflictDetails: {
        conflictingFactId: 'fact_auth_feature_prd',
        conflictingSource: 'Q3_Product_Roadmap_PRD.pdf (Section 3.2)',
        conflictingValue: 'COMPLETE / Ready for Customer Launch',
        conflictingDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
        conflictingCategory: 'DESCRIPTIVE',
        severity: 'HARD_CONFLICT',
        arbitrationRule: 'Rule 1: Operational Truth Dominance (Reality > Aspiration)',
        resolution: 'Feature treated as IN_PROGRESS. Release gate BLOCKED until security testing issue #410 is closed.'
      }
    },
    {
      factId: 'fact_auth_feature_prd',
      key: 'feature_multi_tenant_auth_roadmap',
      label: 'Roadmap Target: Multi-Tenant Auth',
      value: 'COMPLETE',
      formattedValue: 'COMPLETE (Roadmap Target)',
      category: 'DESCRIPTIVE',
      department: 'Product',
      sourceType: 'DOCUMENT',
      sourceName: 'Q3_Product_Roadmap_PRD.pdf',
      sourceDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      extractionTimestamp: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      verificationMethod: 'EXTRACTED',
      verifiedBy: 'Document Ingestion Pipeline',
      freshness: 'AGING',
      staleReason: 'PRD planned completion for Sept 15; downstream engineering tickets show ongoing penetration tests.',
      isAuthoritative: false,
      hasConflict: true,
      conflictDetails: {
        conflictingFactId: 'fact_auth_feature_live',
        conflictingSource: 'Engineering Task Tracker (#410 "Penetration Testing & OAuth Revocation")',
        conflictingValue: 'IN_PROGRESS (Security Review Pending)',
        conflictingDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        conflictingCategory: 'OPERATIONAL_STATE',
        severity: 'HARD_CONFLICT',
        arbitrationRule: 'Rule 1: Operational Truth Dominance',
        resolution: 'Relegated to design specification. Cannot be cited as deployed capability.'
      }
    },
    {
      factId: 'fact_headcount',
      key: 'headcount_verified',
      label: 'Verified Team Headcount',
      value: 11,
      formattedValue: '5 Human Employees + 6 AI Executives',
      category: 'OPERATIONAL_STATE',
      department: 'HR & Talent',
      sourceType: 'SYSTEM_RECORD',
      sourceName: 'CatalystOS People Directory & Access Ledger',
      sourceDate: new Date().toISOString(),
      extractionTimestamp: new Date().toISOString(),
      verificationMethod: 'MANUALLY_CONFIRMED',
      verifiedBy: 'Founder (Siddharth)',
      freshness: 'FRESH',
      isAuthoritative: true,
      hasConflict: false
    }
  ]);

  const [disagreementCases, setDisagreementCases] = useState<DisagreementResolutionCase[]>([
    {
      id: 'case_runway_discrepancy',
      topic: 'Runway & Treasury Balance Discrepancy',
      metricOrFeature: 'Current Cash Balance & Calculated Runway',
      department: 'Finance',
      descriptiveClaim: {
        source: 'Financial_Model_v1_Forecast.xlsx (Sheet: Cash_Flow)',
        sourceType: 'DOCUMENT',
        date: new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString(),
        value: '₹72,00,000 (Yielding 9.0 Months Runway)',
        interpretation: 'Static projection prepared 2 months ago assuming delayed hiring and lower cloud spend.',
        statusBadge: 'STALE'
      },
      operationalReality: {
        source: 'Authoritative Bank Ledger (HDFC Corporate Account #8492)',
        sourceType: 'INTEGRATION',
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        value: '₹42,50,000 (Yielding 5.3 Months Runway)',
        interpretation: 'Live balance after Q3 software licenses, contractor disbursements, and ₹8L monthly payroll.',
        statusBadge: 'BANK_FEED'
      },
      arbitrationVerdict: {
        ruling: 'OPERATIONAL_TRUTH_WINS',
        ruleApplied: 'Rule 1: Operational Truth Dominance (Reality > Aspiration) & Rule 2: Temporal Precedence',
        authoritativeValue: '₹42,50,000 (5.3 Months Runway)',
        explanation: 'Bank integration feed represents current liquid assets. The 2-month-old spreadsheet is stale and does not reflect executed disbursements.',
        impactOnPlanning: 'Automated workflow allocations and hiring limits will strictly enforce the 5.3-month runway constraint to prevent unexpected insolvency.',
        arbitratedAt: new Date().toISOString(),
        arbitratedBy: 'CatalystOS Solvency Guard'
      }
    },
    {
      id: 'case_auth_module_status',
      topic: 'Feature Readiness & Release Gate Disagreement',
      metricOrFeature: 'Multi-Tenant Auth & SAML SSO Enterprise Module',
      department: 'Engineering / Product',
      descriptiveClaim: {
        source: 'Q3_Product_Roadmap_PRD.pdf (Target Milestone 4)',
        sourceType: 'DOCUMENT',
        date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
        value: 'COMPLETE / Ready for Customer Launch',
        interpretation: 'Product roadmap intended feature to be code-complete and delivered to customers by end of Q3.',
        statusBadge: 'ASPIRATIONAL_PLAN'
      },
      operationalReality: {
        source: 'Engineering Task Tracker (#410 "OAuth Security Pen-Test")',
        sourceType: 'SYSTEM_RECORD',
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        value: 'IN_PROGRESS (Security Penetration Testing Pending)',
        interpretation: 'Engineering PR merged into staging, but token revocation audit and pen-test are actively blocked on QA sign-off.',
        statusBadge: 'IN_PROGRESS'
      },
      arbitrationVerdict: {
        ruling: 'OPERATIONAL_TRUTH_WINS',
        ruleApplied: 'Rule 1: Operational Truth Dominance (Reality > Aspiration)',
        authoritativeValue: 'IN_PROGRESS (Gated on Issue #410)',
        explanation: 'Operational testing telemetry takes precedence over roadmap projections. A feature cannot be treated as ready for customer exposure until tests pass.',
        impactOnPlanning: 'Marketing announcement and sales commitments are gated. CatalystOS multi-agent orchestrator marks this milestone BLOCKED.',
        arbitratedAt: new Date().toISOString(),
        arbitratedBy: 'CatalystOS Governance Engine'
      }
    }
  ]);

  const [isLoadingProvenance, setIsLoadingProvenance] = useState<boolean>(false);
  const [queryProvenanceFacts, setQueryProvenanceFacts] = useState<FactProvenance[]>([]);
  const [queryDisagreements, setQueryDisagreements] = useState<DisagreementResolutionCase[]>([]);
  const [queryArbitrationSummary, setQueryArbitrationSummary] = useState<string | null>(null);
  const [queryHasStaleWarning, setQueryHasStaleWarning] = useState<boolean>(false);
  const [provenanceFilterDept, setProvenanceFilterDept] = useState<string>('ALL');
  const [provenanceFilterFreshness, setProvenanceFilterFreshness] = useState<string>('ALL');
  const [provenanceFilterCategory, setProvenanceFilterCategory] = useState<string>('ALL');
  const [attestationSuccess, setAttestationSuccess] = useState<string | null>(null);

  // Ask Company Knowledge
  const [query, setQuery] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryAnswer, setQueryAnswer] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { apiFetch } = useAuth();

  // Load live provenance data from backend
  const loadProvenanceData = async () => {
    try {
      setIsLoadingProvenance(true);
      const res = await apiFetch('/api/knowledge/provenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const data = await res.json();
        if (data.facts && data.facts.length > 0) setProvenanceFacts(data.facts);
        if (data.disagreements && data.disagreements.length > 0) setDisagreementCases(data.disagreements);
      }
    } catch (err) {
      console.warn('Using canonical local provenance data fallback:', err);
    } finally {
      setIsLoadingProvenance(false);
    }
  };

  useEffect(() => {
    loadProvenanceData();
  }, []);

  const handleConfirmFact = async (factId: string, confirmedValue: any) => {
    try {
      const res = await apiFetch('/api/knowledge/provenance/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factId, confirmedValue })
      });
      if (res.ok) {
        const data = await res.json();
        setProvenanceFacts(prev => prev.map(f => f.factId === factId ? data.fact : f));
        setAttestationSuccess(`Fact "${data.fact.label}" confirmed & locked by Founder!`);
        setTimeout(() => setAttestationSuccess(null), 4000);
      }
    } catch (err: any) {
      console.error('Failed to confirm fact:', err);
    }
  };

  const handleResolveDisagreement = async (caseId: string, decision: 'ACCEPT_OPERATIONAL' | 'ACCEPT_DESCRIPTIVE' | 'CUSTOM_OVERRIDE') => {
    try {
      const res = await apiFetch('/api/knowledge/provenance/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, decision })
      });
      if (res.ok) {
        const data = await res.json();
        setDisagreementCases(prev => prev.map(c => c.id === caseId ? data.disagreement : c));
        setAttestationSuccess(`Disagreement "${data.disagreement.topic}" successfully resolved!`);
        setTimeout(() => setAttestationSuccess(null), 4000);
      }
    } catch (err: any) {
      console.error('Failed to resolve disagreement:', err);
    }
  };

  // Filtered documents
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      if (activeCategory === 'strategy' && !['pitch_deck', 'business_plan'].includes(doc.type)) return false;
      if (activeCategory === 'financials' && doc.type !== 'financial_reports') return false;
      if (activeCategory === 'research' && doc.type !== 'meeting_notes') return false;
      if (activeCategory === 'product' && !['other', 'hiring_docs'].includes(doc.type)) return false;
      if (activeCategory === 'legal' && doc.type !== 'legal') return false;

      if (searchDocQuery.trim()) {
        const q = searchDocQuery.toLowerCase();
        return doc.name.toLowerCase().includes(q) || doc.summary?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [documents, activeCategory, searchDocQuery]);

  const activeDoc = documents.find(d => d.id === selectedDocId) || filteredDocuments[0] || documents[0];

  // Upload handler
  const processFiles = (files: File[]) => {
    files.forEach((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const allowed = ['pdf', 'docx', 'pptx', 'csv', 'txt', 'md'];
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      if (!allowed.includes(ext)) {
        setActiveUploads(prev => [{
          id: uploadId, name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          progress: 100, status: 'failed',
          error: 'Unsupported format. Use PDF, DOCX, PPTX, CSV, TXT, or MD.'
        }, ...prev]);
        return;
      }

      const sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
      setActiveUploads(prev => [{ id: uploadId, name: file.name, size: sizeStr, progress: 10, status: 'reading' }, ...prev]);

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          setActiveUploads(prev => prev.map(u => u.id === uploadId ? { ...u, progress: 35, status: 'uploading' } : u));
          const dataUrl = event.target?.result as string;
          const base64Data = dataUrl.split(',')[1];

          let progressVal = 35;
          const interval = setInterval(() => {
            progressVal += 10;
            if (progressVal > 85) clearInterval(interval);
            else setActiveUploads(prev => prev.map(u => u.id === uploadId ? { ...u, progress: progressVal, status: progressVal > 65 ? 'analyzing' : 'uploading' } : u));
          }, 300);

          await onUploadDoc(file.name, '', docType, base64Data, file.type);
          clearInterval(interval);
          setActiveUploads(prev => prev.map(u => u.id === uploadId ? { ...u, progress: 100, status: 'completed' } : u));
          setSuccessToast(true);
          setTimeout(() => setSuccessToast(false), 4000);
          setTimeout(() => setActiveUploads(prev => prev.filter(u => u.id !== uploadId)), 5000);
        } catch (err: any) {
          setActiveUploads(prev => prev.map(u => u.id === uploadId ? { ...u, status: 'failed', error: err.message || 'Upload failed' } : u));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files) as File[]);
  };

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName || !docContent) return;
    setIsUploading(true);
    try {
      await onUploadDoc(docName, docContent, docType);
      setDocName('');
      setDocContent('');
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuerySubmit = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const queryToRun = customQuery || query;
    if (!queryToRun.trim()) return;
    setIsQuerying(true);
    setQueryAnswer(null);
    setQueryProvenanceFacts([]);
    setQueryDisagreements([]);
    setQueryArbitrationSummary(null);
    setQueryHasStaleWarning(false);
    try {
      const res = await apiFetch('/api/knowledge/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryToRun }),
      });
      if (res.ok) {
        const data = await res.json();
        setQueryAnswer(data.answer);
        if (data.provenanceFacts) setQueryProvenanceFacts(data.provenanceFacts);
        if (data.disagreements) setQueryDisagreements(data.disagreements);
        if (data.arbitrationSummary) setQueryArbitrationSummary(data.arbitrationSummary);
        if (data.hasStaleWarning) setQueryHasStaleWarning(data.hasStaleWarning);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div id="company-knowledge-container" className="space-y-6 font-sans">
      
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <Section delay={0.05} className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold" style={{ color: 'var(--c-accent)' }}>
              Institutional Memory & Truth
            </span>
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--c-border-strong)' }} />
            <span className="text-[11px] font-mono" style={{ color: 'var(--c-muted)' }}>
              {documents.length} Grounding Sources
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--c-fg)' }}>
            Company Knowledge
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--c-muted)' }}>
            Centralized repository of corporate intelligence. Ground your executive agents with pitch decks, financial sheets, board memos, and strategy documents.
          </p>
        </div>

        {/* 3-Step Wizard Action Button */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            onClick={() => openWizard('file')}
            id="open-add-source-wizard-btn"
            className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer hover:opacity-90"
            style={{
              backgroundColor: 'var(--c-fg)',
              color: 'var(--c-bg)'
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Add Knowledge Source
          </button>
        </div>
      </Section>

      {/* ── SUCCESS TOAST ─────────────────────────────────────────────────── */}
      {successToast && (
        <div 
          className="fixed top-6 right-6 z-50 flex items-center gap-3 shadow-xl rounded-2xl px-5 py-3.5 animate-fade-in"
          style={{
            backgroundColor: 'var(--c-surface)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <p className="text-xs font-medium" style={{ color: 'var(--c-fg)' }}>Document ingested & synthesized into executive memory.</p>
          <button onClick={() => setSuccessToast(false)} className="cursor-pointer" style={{ color: 'var(--c-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── ATTESTATION SUCCESS NOTIFICATION ───────────────────────────────── */}
      {attestationSuccess && (
        <div 
          className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium animate-fade-in shadow-xs"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{attestationSuccess}</span>
          </div>
          <button onClick={() => setAttestationSuccess(null)} className="cursor-pointer text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── SECTION 5.7 VIEW MODE SWITCHER ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 rounded-2xl bg-white border border-[#141413]/10 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto p-0.5">
          {[
            { id: 'DOCUMENTS' as const, label: 'Document Vault & RAG', icon: FileText, count: documents.length },
            { id: 'PROVENANCE_LEDGER' as const, label: 'Fact Provenance Ledger', icon: ShieldCheck, badge: `${provenanceFacts.length} Facts` },
            { id: 'DISAGREEMENTS' as const, label: 'Descriptive vs. Operational Disagreements', icon: Scale, badge: `${disagreementCases.length} Active Conflicts`, alert: true },
          ].map((tab) => {
            const isActive = knowledgeMode === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setKnowledgeMode(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#141413] text-[#FDFCFA] shadow-xs'
                    : 'text-[#696969] hover:text-[#141413] hover:bg-[#141413]/05'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#FDFCFA]' : tab.alert ? 'text-amber-500' : 'text-[#696969]'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[#141413]/08 text-[#696969]'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : tab.alert
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 px-3 py-1 text-[11px] font-mono text-[#696969] shrink-0 border-t sm:border-t-0 border-[#141413]/08">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Rule 1: Reality &gt; Aspiration Enforced</span>
        </div>
      </div>

      {/* ── MODE 1: DOCUMENT VAULT & RAG ──────────────────────────────────── */}
      {knowledgeMode === 'DOCUMENTS' && (
        <div className="space-y-6 animate-fade-in">

      {/* ── CATEGORY PILLS BAR ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 overflow-x-auto pb-1">
        <div className="flex items-center gap-2">
          {CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer"
                style={{
                  backgroundColor: isSelected ? 'var(--c-fg)' : 'var(--c-surface)',
                  color: isSelected ? 'var(--c-bg)' : 'var(--c-muted)',
                  border: `1px solid ${isSelected ? 'var(--c-fg)' : 'var(--c-border)'}`
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-64 shrink-0 hidden sm:block">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-muted)' }} />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchDocQuery}
            onChange={(e) => setSearchDocQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl outline-none transition-colors"
            style={{
              backgroundColor: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              color: 'var(--c-fg)'
            }}
          />
        </div>
      </div>

      {/* ── MAIN 2-COLUMN BALANCED LAYOUT ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Add Knowledge & Document Library (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Add Knowledge Source Card */}
          <div 
            className="p-5 rounded-2xl space-y-4 transition-all"
            style={{
              backgroundColor: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--c-fg)' }}>Add Knowledge Source</h3>
                <p className="text-[11px]" style={{ color: 'var(--c-muted)' }}>Feed verified context directly into council reasoning.</p>
              </div>
              <span className="text-[10px] font-mono uppercase font-bold" style={{ color: 'var(--c-muted)' }}>Inbound</span>
            </div>

            {/* Launch Guided 3-Step Ingestion Wizard */}
            <button
              type="button"
              onClick={() => openWizard('file')}
              id="launch-source-wizard-card-btn"
              className="w-full p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer group hover:bg-[#141413]/5"
              style={{
                backgroundColor: 'rgba(20, 20, 19, 0.03)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-fg)'
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#141413] text-[#FDFCFA] shrink-0 shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-xs">Launch 3-Step Import Wizard</div>
                  <div className="text-[10px]" style={{ color: 'var(--c-muted)' }}>Choose format, drag payload & configure domain</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" style={{ color: 'var(--c-fg)' }} />
            </button>

            {/* Quick Ingest Section */}
            <div className="pt-2" style={{ borderTop: '1px solid var(--c-border)' }}>
              <div className="flex items-center justify-between pb-2">
                <span className="text-[11px] font-semibold" style={{ color: 'var(--c-muted)' }}>Quick Ingest</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setUploadTab('file')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                    style={{
                      backgroundColor: uploadTab === 'file' ? 'var(--c-fg)' : 'var(--c-surface-2)',
                      color: uploadTab === 'file' ? 'var(--c-bg)' : 'var(--c-muted)',
                      border: `1px solid ${uploadTab === 'file' ? 'var(--c-fg)' : 'var(--c-border)'}`
                    }}
                  >
                    File
                  </button>
                  <button
                    onClick={() => setUploadTab('paste')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
                    style={{
                      backgroundColor: uploadTab === 'paste' ? 'var(--c-fg)' : 'var(--c-surface-2)',
                      color: uploadTab === 'paste' ? 'var(--c-bg)' : 'var(--c-muted)',
                      border: `1px solid ${uploadTab === 'paste' ? 'var(--c-fg)' : 'var(--c-border)'}`
                    }}
                  >
                    Note / Text
                  </button>
                </div>
              </div>
            </div>

            {/* Target Domain Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold block" style={{ color: 'var(--c-muted)' }}>Target Knowledge Domain</label>
              <div className="relative">
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none appearance-none"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                >
                  {DOC_TYPES.map((dt) => (
                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--c-muted)' }} />
              </div>
            </div>

            {/* Tab: Quick File Upload */}
            {uploadTab === 'file' && (
              <div className="space-y-3">
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5"
                  style={{
                    borderColor: isDragging ? 'var(--c-fg)' : 'var(--c-border-strong)',
                    backgroundColor: isDragging ? 'rgba(20, 20, 19, 0.04)' : 'var(--c-surface-2)'
                  }}
                >
                  <UploadCloud className="w-5 h-5" style={{ color: 'var(--c-fg)' }} />
                  <p className="text-xs font-semibold" style={{ color: 'var(--c-fg)' }}>
                    Drop files here, or <span className="underline">browse</span>
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--c-muted)' }}>PDF, DOCX, PPTX, CSV, TXT, MD (Max 15MB)</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => { if (e.target.files) processFiles(Array.from(e.target.files)); }}
                  accept=".pdf,.docx,.pptx,.csv,.txt,.md"
                  className="hidden"
                />

                {/* Progress bars */}
                {activeUploads.length > 0 && (
                  <div className="space-y-2">
                    {activeUploads.map((u) => (
                      <div 
                        key={u.id} 
                        className="p-3 rounded-xl space-y-1.5 text-xs"
                        style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold truncate max-w-[70%]" style={{ color: 'var(--c-fg)' }}>{u.name}</span>
                          {u.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                          {u.status === 'failed' && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
                          {['reading', 'uploading', 'analyzing'].includes(u.status) && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--c-accent)' }} />
                          )}
                        </div>
                        <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--c-border)' }}>
                          <div
                            className="h-full transition-all duration-300"
                            style={{ 
                              width: `${u.progress}%`,
                              backgroundColor: 'var(--c-accent)'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Quick Paste */}
            {uploadTab === 'paste' && (
              <form onSubmit={handlePasteSubmit} className="space-y-2.5">
                <input
                  type="text"
                  placeholder="Document Title (e.g., Q3 Strategy Memo)"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                />
                <textarea
                  rows={4}
                  placeholder="Paste context, meeting notes, customer transcripts..."
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  className="w-full p-3 rounded-xl text-xs resize-none outline-none"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                />
                <button
                  type="submit"
                  disabled={!docName || !docContent || isUploading}
                  className="w-full py-2 rounded-xl text-xs font-semibold disabled:opacity-40 cursor-pointer transition-all"
                  style={{
                    backgroundColor: 'var(--c-fg)',
                    color: 'var(--c-bg)'
                  }}
                >
                  {isUploading ? 'Ingesting...' : 'Add to Knowledge'}
                </button>
              </form>
            )}
          </div>

          {/* Document Library List */}
          <div 
            className="p-5 rounded-2xl space-y-3 transition-all"
            style={{
              backgroundColor: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: 'var(--c-fg)' }}>Documents ({filteredDocuments.length})</h3>
              <span className="text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>Audited</span>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {filteredDocuments.map((doc) => {
                const isSelected = activeDoc?.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className="w-full p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer"
                    style={{
                      backgroundColor: isSelected ? 'var(--c-surface-2)' : 'var(--c-surface)',
                      borderColor: isSelected ? 'var(--c-fg)' : 'var(--c-border)',
                      boxShadow: isSelected ? 'var(--shadow-sm)' : 'none'
                    }}
                  >
                    <div 
                      className="p-2 rounded-lg shrink-0 mt-0.5"
                      style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold truncate" style={{ color: 'var(--c-fg)' }}>{doc.name}</h4>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>
                        <span className="uppercase">{doc.type.replace('_', ' ')}</span>
                        <span>·</span>
                        <span>{doc.size}</span>
                        <span>·</span>
                        <span>{new Date(doc.uploadDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Query Hub & Selected Document Inspection (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Ask Company Knowledge Search Hub */}
          <div 
            className="p-6 rounded-2xl space-y-4 transition-all"
            style={{
              backgroundColor: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider" style={{ color: 'var(--c-accent)' }}>
                Interactive Semantic Intelligence
              </span>
              <h3 className="text-base font-bold mt-0.5" style={{ color: 'var(--c-fg)' }}>
                Ask Company Knowledge
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
                Query grounded corporate facts across all uploaded pitch decks, financials, and transcripts.
              </p>
            </div>

            <form onSubmit={handleQuerySubmit} className="relative">
              <input
                type="text"
                placeholder="Ask anything about the company, cap table, runway, or roadmap..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-4 pr-12 py-3 rounded-xl text-xs outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--c-surface-2)',
                  border: '1px solid var(--c-border)',
                  color: 'var(--c-fg)'
                }}
              />
              <button
                type="submit"
                disabled={!query.trim() || isQuerying}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg disabled:opacity-40 transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'var(--c-fg)',
                  color: 'var(--c-bg)'
                }}
              >
                {isQuerying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </form>

            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_PROMPTS.map((qp, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setQuery(qp);
                    handleQuerySubmit(undefined, qp);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] transition-all font-medium cursor-pointer hover:border-[#141413]/30"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-muted)'
                  }}
                >
                  "{qp}"
                </button>
              ))}
            </div>

            {/* Answer Box */}
            {queryAnswer && (
              <div 
                className="p-5 rounded-xl space-y-3.5 animate-fade-in"
                style={{
                  backgroundColor: 'var(--c-surface-2)',
                  border: '1px solid var(--c-border)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--c-fg)' }}>
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <span>Synthesized Corporate Answer</span>
                  </div>
                  {queryHasStaleWarning && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      Stale Source Overridden
                    </span>
                  )}
                </div>

                <div className="text-xs leading-relaxed font-sans prose prose-sm max-w-none dark:prose-invert" style={{ color: 'var(--c-fg)' }}>
                  {queryAnswer.split('\n\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-2 last:mb-0">{paragraph}</p>
                  ))}
                </div>

                {/* ── Explicit Knowledge Provenance Card (Section 5.7) ──────── */}
                {(queryProvenanceFacts.length > 0 || queryDisagreements.length > 0) && (
                  <div className="mt-4 pt-3.5 border-t border-[#141413]/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#696969] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Grounded Knowledge Provenance
                      </span>
                      <span className="text-[10px] font-mono text-[#696969]">
                        Verified Precedence: Operational Reality &gt; Aspiration
                      </span>
                    </div>

                    {/* Provenance Facts Grid */}
                    {queryProvenanceFacts.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {queryProvenanceFacts.map((fact) => (
                          <div 
                            key={fact.factId} 
                            className="p-2.5 rounded-xl border text-[11px] space-y-1 bg-white/80 border-[#141413]/10 shadow-xs"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-[#141413] truncate">{fact.label}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${
                                fact.freshness === 'FRESH'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {fact.freshness}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#696969] flex items-center gap-1 truncate">
                              <span className="font-semibold text-[#141413]">Source:</span>
                              <span className="truncate">{fact.sourceName}</span>
                            </div>
                            <div className="text-[10px] text-[#696969] flex items-center justify-between pt-0.5 border-t border-[#141413]/05">
                              <span>Method: <strong className="text-[#141413] font-mono">{fact.verificationMethod}</strong></span>
                              <span className="font-medium text-emerald-700">{fact.category === 'OPERATIONAL_STATE' ? 'Live State' : 'Document'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Disagreement Resolution Box */}
                    {queryDisagreements.map((dis) => (
                      <div key={dis.id} className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-xs space-y-2">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <Scale className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Disagreement Resolved: {dis.topic}</span>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          {dis.arbitrationVerdict.explanation}
                        </p>
                        <div className="text-[10px] font-mono text-amber-700 pt-1 border-t border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span>Rule: <strong>{dis.arbitrationVerdict.ruleApplied}</strong></span>
                          <span className="font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded self-start sm:self-auto">
                            Authoritative: {dis.arbitrationVerdict.authoritativeValue}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Document Deep Dive */}
          {activeDoc ? (
            <div 
              className="p-6 rounded-2xl space-y-5 transition-all"
              style={{
                backgroundColor: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div className="flex items-start justify-between pb-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span 
                      className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded-md"
                      style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
                    >
                      {activeDoc.type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>{activeDoc.size}</span>
                  </div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--c-fg)' }}>{activeDoc.name}</h3>
                </div>

                <span className="text-xs font-mono flex items-center gap-1" style={{ color: 'var(--c-muted)' }}>
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(activeDoc.uploadDate).toLocaleDateString()}
                </span>
              </div>

              {/* AI Executive Summary */}
              <div className="space-y-2">
                <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--c-fg)' }}>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  Executive Synthesis & Key Takeaways
                </span>
                <p 
                  className="text-xs leading-relaxed p-4 rounded-xl"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                >
                  {activeDoc.summary || 'Document indexed and available for cross-council grounding.'}
                </p>
              </div>

              {/* Key Insights List */}
              {activeDoc.keyInsights && activeDoc.keyInsights.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--c-fg)' }}>
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    Audited Extracted Insights
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeDoc.keyInsights.map((insight, idx) => (
                      <div 
                        key={idx} 
                        className="p-3 rounded-xl text-xs"
                        style={{
                          backgroundColor: 'var(--c-surface-2)',
                          border: '1px solid var(--c-border)',
                          color: 'var(--c-fg)'
                        }}
                      >
                        {insight}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Technical / RAG Advanced Accordion */}
              <div className="pt-2" style={{ borderTop: '1px solid var(--c-border)' }}>
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="flex items-center justify-between w-full text-xs font-mono py-1 cursor-pointer transition-colors"
                  style={{ color: 'var(--c-muted)' }}
                >
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    Advanced System & Vector Grounding Details
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTechnicalDetails ? 'rotate-180' : ''}`} />
                </button>

                {showTechnicalDetails && (
                  <div 
                    className="mt-3 p-4 rounded-xl text-[11px] font-mono space-y-2 animate-fade-in"
                    style={{
                      backgroundColor: 'var(--c-surface-2)',
                      border: '1px solid var(--c-border)',
                      color: 'var(--c-muted)'
                    }}
                  >
                    <div className="flex justify-between">
                      <span>Document ID:</span>
                      <span style={{ color: 'var(--c-fg)' }}>{activeDoc.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Embedding Model:</span>
                      <span style={{ color: 'var(--c-fg)' }}>text-embedding-004 (768-dim)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Index Store:</span>
                      <span style={{ color: 'var(--c-fg)' }}>PostgreSQL / pgvector (Neon)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Grounding Status:</span>
                      <span className="text-emerald-500 font-bold">100% Vectorized & Audited</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div 
              className="p-12 text-center rounded-2xl text-xs"
              style={{ border: '1px dashed var(--c-border)', color: 'var(--c-muted)' }}
            >
              Select a document to inspect executive summaries and key findings.
            </div>
          )}

        </div>

      </div>
      </div>
      )}

      {/* ── MODE 2: FACT PROVENANCE LEDGER (Section 5.7) ─────────────────── */}
      {knowledgeMode === 'PROVENANCE_LEDGER' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Provenance Header & Policy Card */}
          <div className="p-6 rounded-2xl bg-white border border-[#141413]/10 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Section 5.7 Explicit Knowledge Provenance
                </span>
                <h2 className="text-lg font-bold text-[#141413] mt-1">
                  Institutional Ground Truth & Fact Provenance Ledger
                </h2>
                <p className="text-xs text-[#696969] mt-0.5 max-w-3xl">
                  Every critical business fact is tracked with source integration, authoring date, extraction timestamp, verification method, and freshness decay. Authoritative structured records strictly take precedence over arbitrary document fragments.
                </p>
              </div>

              <button
                onClick={loadProvenanceData}
                disabled={isLoadingProvenance}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#141413]/10 bg-white hover:bg-[#141413]/05 transition-colors flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0 shadow-xs text-[#141413]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingProvenance ? 'animate-spin' : ''}`} />
                <span>Refresh Provenance</span>
              </button>
            </div>

            {/* Provenance Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#141413]/08">
              <div className="p-3 rounded-xl bg-[#141413]/02 border border-[#141413]/06">
                <div className="text-[10px] font-mono uppercase text-[#696969]">Total Tracked Facts</div>
                <div className="text-xl font-bold text-[#141413] mt-0.5">{provenanceFacts.length}</div>
                <div className="text-[10px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Fully Audited
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#141413]/02 border border-[#141413]/06">
                <div className="text-[10px] font-mono uppercase text-[#696969]">Operational State Feeds</div>
                <div className="text-xl font-bold text-emerald-700 mt-0.5">
                  {provenanceFacts.filter(f => f.category === 'OPERATIONAL_STATE').length}
                </div>
                <div className="text-[10px] text-[#696969] font-mono mt-0.5">Bank & CI/CD Feeds</div>
              </div>

              <div className="p-3 rounded-xl bg-[#141413]/02 border border-[#141413]/06">
                <div className="text-[10px] font-mono uppercase text-[#696969]">Stale / Superseded Docs</div>
                <div className="text-xl font-bold text-amber-600 mt-0.5">
                  {provenanceFacts.filter(f => f.freshness === 'STALE' || f.freshness === 'SUPERSEDED').length}
                </div>
                <div className="text-[10px] text-amber-700 font-medium mt-0.5">&gt;60d Old (Overridden)</div>
              </div>

              <div className="p-3 rounded-xl bg-[#141413]/02 border border-[#141413]/06">
                <div className="text-[10px] font-mono uppercase text-[#696969]">Active Disagreements</div>
                <div className="text-xl font-bold text-rose-600 mt-0.5">
                  {disagreementCases.length}
                </div>
                <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Arbitration Active</div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white border border-[#141413]/10 text-xs">
            {/* Department Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="font-semibold text-[#696969] text-[11px] mr-1">Dept:</span>
              {['ALL', 'Finance', 'Engineering', 'Product', 'HR & Talent'].map((dept) => (
                <button
                  key={dept}
                  onClick={() => setProvenanceFilterDept(dept)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    provenanceFilterDept === dept
                      ? 'bg-[#141413] text-white shadow-xs'
                      : 'bg-[#141413]/04 text-[#696969] hover:text-[#141413]'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>

            {/* Freshness Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="font-semibold text-[#696969] text-[11px] mr-1">Freshness:</span>
              {['ALL', 'FRESH', 'AGING', 'STALE'].map((fr) => (
                <button
                  key={fr}
                  onClick={() => setProvenanceFilterFreshness(fr)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    provenanceFilterFreshness === fr
                      ? 'bg-[#141413] text-white shadow-xs'
                      : 'bg-[#141413]/04 text-[#696969] hover:text-[#141413]'
                  }`}
                >
                  {fr}
                </button>
              ))}
            </div>
          </div>

          {/* Facts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {provenanceFacts
              .filter(f => provenanceFilterDept === 'ALL' || f.department.toLowerCase().includes(provenanceFilterDept.toLowerCase()))
              .filter(f => provenanceFilterFreshness === 'ALL' || f.freshness === provenanceFilterFreshness)
              .map((fact) => {
                const isOp = fact.category === 'OPERATIONAL_STATE';
                return (
                  <div
                    key={fact.factId}
                    className="p-5 rounded-2xl bg-white border border-[#141413]/10 shadow-xs space-y-3.5 transition-all hover:border-[#141413]/20"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono uppercase font-bold text-[#696969]">
                            {fact.department}
                          </span>
                          <span className="text-[#141413]/20">·</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                            isOp ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}>
                            {isOp ? 'OPERATIONAL REALITY' : 'DESCRIPTIVE KNOWLEDGE'}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-[#141413]">{fact.label}</h3>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                        fact.freshness === 'FRESH'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : fact.freshness === 'AGING'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {fact.freshness}
                      </span>
                    </div>

                    {/* Authoritative Value Display */}
                    <div className="p-3.5 rounded-xl bg-[#141413]/02 border border-[#141413]/06">
                      <span className="text-[10px] font-mono uppercase text-[#696969] block mb-0.5">
                        {fact.isAuthoritative ? 'Authoritative Ground Truth Value' : 'Historical Document Value'}
                      </span>
                      <div className="text-lg font-bold text-[#141413]">
                        {fact.formattedValue || String(fact.value)}
                      </div>
                    </div>

                    {/* Granular Provenance Metadata */}
                    <div className="space-y-2 text-xs pt-1 border-t border-[#141413]/06">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#696969]">Source Document / Feed:</span>
                        <span className="font-semibold text-[#141413] truncate max-w-[65%]" title={fact.sourceName}>
                          {fact.sourceName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#696969]">Source Date:</span>
                        <span className="font-mono text-[#141413]">
                          {new Date(fact.sourceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#696969]">Extraction Timestamp:</span>
                        <span className="font-mono text-[#141413]">
                          {new Date(fact.extractionTimestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#696969]">Verification Method:</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#141413]/05 text-[#141413] border border-[#141413]/10">
                          {fact.verificationMethod}
                        </span>
                      </div>

                      {fact.verifiedBy && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#696969]">Attested By:</span>
                          <span className="font-medium text-slate-700">{fact.verifiedBy}</span>
                        </div>
                      )}
                    </div>

                    {/* Stale Warning Callout */}
                    {fact.staleReason && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>{fact.staleReason}</span>
                      </div>
                    )}

                    {/* Disagreement Warning Callout */}
                    {fact.hasConflict && fact.conflictDetails && (
                      <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200/90 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-900 flex items-center gap-1.5">
                            <Scale className="w-3.5 h-3.5 text-amber-600" />
                            Disagreement Detected
                          </span>
                          <span className="text-[10px] font-mono font-bold text-amber-700">
                            {fact.conflictDetails.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-800">
                          <strong>Conflict:</strong> {fact.conflictDetails.conflictingSource} ({fact.conflictDetails.conflictingValue})
                        </p>
                        <p className="text-[11px] text-amber-900 font-medium">
                          <strong>Arbitration:</strong> {fact.conflictDetails.resolution}
                        </p>
                      </div>
                    )}

                    {/* Action Footer */}
                    <div className="pt-2 border-t border-[#141413]/08 flex items-center justify-between">
                      <button
                        onClick={() => handleConfirmFact(fact.factId, fact.value)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#141413] hover:bg-[#262627] text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Confirm & Lock Fact</span>
                      </button>

                      {fact.hasConflict && (
                        <button
                          onClick={() => setKnowledgeMode('DISAGREEMENTS')}
                          className="text-xs font-semibold text-[#141413] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>View Arbitration</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── MODE 3: DESCRIPTIVE VS. OPERATIONAL DISAGREEMENTS (Section 5.7) ── */}
      {knowledgeMode === 'DISAGREEMENTS' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Disagreement Arbitration Policy Banner */}
          <div className="p-6 rounded-2xl bg-white border border-[#141413]/10 shadow-xs space-y-4">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                Knowledge Arbitration Engine
              </span>
              <h2 className="text-lg font-bold text-[#141413] mt-1">
                Descriptive Knowledge vs. Operational State Disagreement Resolution
              </h2>
              <p className="text-xs text-[#696969] mt-0.5 max-w-3xl leading-relaxed">
                CatalystOS formally distinguishes between <strong>Descriptive Knowledge</strong> (what company documents, pitch decks, and roadmap PRDs say) and <strong>Operational State</strong> (what is actually happening now in live bank feeds, issue trackers, and git branches). When records conflict, explicit arbitration rules prevent flawed assumptions.
              </p>
            </div>

            {/* Arbitration Precedence Rules */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#141413]/08 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Rule 1: Reality &gt; Aspiration
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Live operational state (bank ledger, active git tickets, verified payroll) always takes precedence over static documents for determining current reality.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-1">
                <div className="font-bold text-blue-950 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  Rule 2: Temporal Precedence
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Newer verified telemetry supersedes older documents. Records &gt;60 days old are marked STALE and cannot override recent disbursements.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200/80 space-y-1">
                <div className="font-bold text-purple-950 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  Rule 3: Origin Hierarchy
                </div>
                <p className="text-[11px] text-purple-800 leading-relaxed">
                  System Integration Feed &gt; Founder Direct Attestation &gt; Formally Extracted Fact &gt; Raw Semantic Document Chunk.
                </p>
              </div>
            </div>
          </div>

          {/* Active Disagreement Cases List */}
          <div className="space-y-6">
            {disagreementCases.map((caseItem) => (
              <div 
                key={caseItem.id}
                className="p-6 rounded-2xl bg-white border border-[#141413]/10 shadow-xs space-y-5"
              >
                {/* Case Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#141413]/08">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        Active Disagreement
                      </span>
                      <span className="text-xs font-mono text-[#696969]">{caseItem.department}</span>
                    </div>
                    <h3 className="text-base font-bold text-[#141413]">{caseItem.topic}</h3>
                    <p className="text-xs text-[#696969]">Contested Metric / Capability: <strong>{caseItem.metricOrFeature}</strong></p>
                  </div>

                  <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 self-start sm:self-auto flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-emerald-600" />
                    Arbitrated: {caseItem.arbitrationVerdict.ruling.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Side-by-Side Contested Positions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Descriptive Knowledge (What Documents Say) */}
                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-600" />
                        Descriptive Knowledge (What Documents Say)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        {caseItem.descriptiveClaim.statusBadge}
                      </span>
                    </div>

                    <div className="text-xl font-bold text-amber-950">
                      {caseItem.descriptiveClaim.value}
                    </div>

                    <p className="text-xs text-amber-900 leading-relaxed">
                      {caseItem.descriptiveClaim.interpretation}
                    </p>

                    <div className="text-[11px] text-amber-800/80 pt-2 border-t border-amber-200/60 font-mono space-y-0.5">
                      <div>Source: <strong>{caseItem.descriptiveClaim.source}</strong></div>
                      <div>Authored: {new Date(caseItem.descriptiveClaim.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                  </div>

                  {/* Right: Operational State (What Is Actually Happening Now) */}
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-600" />
                        Operational State (What Is Actually Happening Now)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {caseItem.operationalReality.statusBadge}
                      </span>
                    </div>

                    <div className="text-xl font-bold text-emerald-950">
                      {caseItem.operationalReality.value}
                    </div>

                    <p className="text-xs text-emerald-900 leading-relaxed">
                      {caseItem.operationalReality.interpretation}
                    </p>

                    <div className="text-[11px] text-emerald-800/80 pt-2 border-t border-emerald-200/60 font-mono space-y-0.5">
                      <div>Source: <strong>{caseItem.operationalReality.source}</strong></div>
                      <div>Telemetry: {new Date(caseItem.operationalReality.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                  </div>
                </div>

                {/* Arbitration Verdict Box (CatalystOS Precedence Ruling) */}
                <div className="p-4 rounded-xl bg-[#141413]/03 border border-[#141413]/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#141413] flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      CatalystOS Ground Truth Ruling & Arbitration Verdict
                    </span>
                    <span className="text-[10px] font-mono text-[#696969]">
                      Rule Applied: <strong>{caseItem.arbitrationVerdict.ruleApplied}</strong>
                    </span>
                  </div>

                  <p className="text-xs text-[#141413] leading-relaxed">
                    {caseItem.arbitrationVerdict.explanation}
                  </p>

                  <div className="p-3 rounded-lg bg-white border border-[#141413]/10 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-[#696969] block">
                      Enforced Value for Autonomous Multi-Agent Orchestration & Planning:
                    </span>
                    <div className="text-sm font-bold text-emerald-700">
                      {caseItem.arbitrationVerdict.authoritativeValue}
                    </div>
                    <p className="text-[11px] text-[#696969] mt-1">
                      <strong>Planning Impact:</strong> {caseItem.arbitrationVerdict.impactOnPlanning}
                    </p>
                  </div>

                  {/* Actions for Founder Override */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#141413]/08">
                    <button
                      onClick={() => handleResolveDisagreement(caseItem.id, 'ACCEPT_OPERATIONAL')}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#141413] hover:bg-[#262627] text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept Operational Truth ({caseItem.operationalReality.value})</span>
                    </button>

                    <button
                      onClick={() => {
                        const val = prompt('Enter custom authoritative value for ' + caseItem.metricOrFeature);
                        if (val) {
                          handleResolveDisagreement(caseItem.id, 'CUSTOM_OVERRIDE');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#141413]/10 hover:bg-[#141413]/05 transition-colors cursor-pointer text-[#696969] hover:text-[#141413]"
                    >
                      Founder Custom Attestation
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3-STEP INGESTION WIZARD MODAL ─────────────────────────────────── */}
      {isWizardOpen && (
        <div 
          id="knowledge-add-source-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && ingestionStatus !== 'uploading' && ingestionStatus !== 'indexing') {
              closeWizard();
            }
          }}
        >
          <div 
            className="relative w-full max-w-2xl rounded-2xl p-6 sm:p-7 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              boxShadow: 'var(--shadow-xl)'
            }}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold" style={{ color: 'var(--c-accent)' }}>
                    Institutional Knowledge Pipeline
                  </span>
                </div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--c-fg)' }}>
                  Add Knowledge Source
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
                  Ground executive reasoning with verified documents, transcripts, and operational references.
                </p>
              </div>
              <button
                onClick={closeWizard}
                disabled={ingestionStatus === 'uploading' || ingestionStatus === 'indexing'}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Progress Indicator */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { step: 1, label: 'Choose Source', desc: 'Select format' },
                { step: 2, label: 'Provide Source', desc: 'File, text, or link' },
                { step: 3, label: 'Configure & Ingest', desc: 'Category & verify' },
              ].map((s) => {
                const isActive = wizardStep === s.step;
                const isDone = wizardStep > s.step || ingestionStatus === 'completed';
                return (
                  <div 
                    key={s.step}
                    className="p-2.5 rounded-xl border text-left transition-all"
                    style={{
                      backgroundColor: isActive ? 'var(--c-surface-2)' : 'var(--c-surface)',
                      borderColor: isActive ? 'var(--c-fg)' : isDone ? 'rgba(16, 185, 129, 0.4)' : 'var(--c-border)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span 
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                          isDone 
                            ? 'bg-emerald-500 text-white' 
                            : isActive 
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' 
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isDone ? <Check className="w-3 h-3" /> : s.step}
                      </span>
                      <span className="text-xs font-bold truncate" style={{ color: 'var(--c-fg)' }}>{s.label}</span>
                    </div>
                    <span className="text-[10px] hidden sm:block mt-1 pl-7 font-mono" style={{ color: 'var(--c-muted)' }}>
                      {s.desc}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* STEP 1: CHOOSE A SOURCE */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <label className="text-xs font-semibold block" style={{ color: 'var(--c-fg)' }}>
                  Select Supported Ingestion Source
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'file' as const,
                      title: 'Document File',
                      desc: 'Upload PDF, DOCX, PPTX, CSV, TXT, or MD files (up to 15MB). Automatically parsed and chunked.',
                      icon: FileText,
                      badge: 'Structured File'
                    },
                    {
                      id: 'text' as const,
                      title: 'Direct Note / Text',
                      desc: 'Paste meeting transcripts, strategic memos, or policies for direct embedding and vector storage.',
                      icon: Layers,
                      badge: 'Raw Text'
                    },
                    {
                      id: 'url' as const,
                      title: 'Web URL Reference',
                      desc: 'Index external documentation, portal references, or regulatory guidelines with contextual excerpts.',
                      icon: Globe,
                      badge: 'Web Link'
                    },
                  ].map((opt) => {
                    const isSelected = sourceType === opt.id;
                    const Icon = opt.icon;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setSourceType(opt.id)}
                        className="p-4 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between"
                        style={{
                          backgroundColor: isSelected ? 'var(--c-surface-2)' : 'var(--c-surface)',
                          borderColor: isSelected ? 'var(--c-fg)' : 'var(--c-border)',
                          boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                          outline: isSelected ? '2px solid var(--c-fg)' : 'none'
                        }}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {opt.badge}
                            </span>
                          </div>
                          <h3 className="text-xs font-bold" style={{ color: 'var(--c-fg)' }}>{opt.title}</h3>
                          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--c-muted)' }}>{opt.desc}</p>
                        </div>
                        <div className="pt-3 flex items-center justify-between">
                          <span className="text-[10px] font-semibold" style={{ color: isSelected ? 'var(--c-fg)' : 'var(--c-muted)' }}>
                            {isSelected ? 'Selected' : 'Select'}
                          </span>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent' : 'border-slate-300'}`}>
                            {isSelected && <Check className="w-2.5 h-2.5" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 flex justify-end" style={{ borderTop: '1px solid var(--c-border)' }}>
                  <button
                    onClick={() => setWizardStep(2)}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all hover:opacity-90"
                    style={{
                      backgroundColor: 'var(--c-fg)',
                      color: 'var(--c-bg)'
                    }}
                  >
                    Continue to Step 2
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: PROVIDE THE SOURCE */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold block" style={{ color: 'var(--c-fg)' }}>
                    {sourceType === 'file' && 'Upload Document File'}
                    {sourceType === 'text' && 'Compose or Paste Content'}
                    {sourceType === 'url' && 'Provide Web Reference Details'}
                  </label>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>
                    Step 2 of 3
                  </span>
                </div>

                {/* Error Banner */}
                {ingestionError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{ingestionError}</span>
                  </div>
                )}

                {/* Subview: File Upload */}
                {sourceType === 'file' && (
                  <div className="space-y-3">
                    {!wizardFile ? (
                      <div
                        onDragOver={(e) => { e.preventDefault(); setWizardDragging(true); }}
                        onDragLeave={() => setWizardDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setWizardDragging(false);
                          const file = e.dataTransfer.files[0];
                          if (file) handleWizardFileSelect(file);
                        }}
                        onClick={() => wizardFileInputRef.current?.click()}
                        className="p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2"
                        style={{
                          borderColor: wizardDragging ? 'var(--c-fg)' : 'var(--c-border-strong)',
                          backgroundColor: wizardDragging ? 'rgba(20, 20, 19, 0.04)' : 'var(--c-surface-2)'
                        }}
                      >
                        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 mb-1">
                          <FileUp className="w-6 h-6" />
                        </div>
                        <p className="text-xs font-semibold" style={{ color: 'var(--c-fg)' }}>
                          Drag & drop your document here, or <span className="underline font-bold">browse files</span>
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--c-muted)' }}>
                          Supports PDF, DOCX, PPTX, CSV, TXT, and Markdown files up to 15MB
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                          {['PDF', 'DOCX', 'PPTX', 'CSV', 'TXT', 'MD'].map(ext => (
                            <span key={ext} className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              .{ext.toLowerCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="p-4 rounded-xl border flex items-center justify-between transition-all"
                        style={{
                          backgroundColor: 'var(--c-surface-2)',
                          borderColor: 'var(--c-border)'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold" style={{ color: 'var(--c-fg)' }}>{wizardFile.name}</h4>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>
                              <span>{(wizardFile.size / 1024).toFixed(1)} KB</span>
                              <span>·</span>
                              <span className="uppercase">{wizardFile.name.split('.').pop()}</span>
                              <span>·</span>
                              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                                <Check className="w-3 h-3" /> Ready
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setWizardFile(null);
                            setWizardFileBase64('');
                          }}
                          className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Remove File"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <input
                      ref={wizardFileInputRef}
                      type="file"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleWizardFileSelect(f);
                      }}
                      accept=".pdf,.docx,.pptx,.csv,.txt,.md"
                      className="hidden"
                    />
                  </div>
                )}

                {/* Subview: Raw Text Note */}
                {sourceType === 'text' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--c-muted)' }}>
                        Document Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Executive Strategy Memo — FY26 Milestones"
                        value={wizardDocName}
                        onChange={(e) => setWizardDocName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                        style={{
                          backgroundColor: 'var(--c-surface-2)',
                          border: '1px solid var(--c-border)',
                          color: 'var(--c-fg)'
                        }}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-semibold" style={{ color: 'var(--c-muted)' }}>
                          Markdown / Text Body
                        </label>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>
                          {wizardTextContent.length} chars
                        </span>
                      </div>
                      <textarea
                        rows={6}
                        placeholder="Paste transcripts, investor correspondence, product roadmap briefs, or customer feedback..."
                        value={wizardTextContent}
                        onChange={(e) => setWizardTextContent(e.target.value)}
                        className="w-full p-3.5 rounded-xl text-xs resize-none outline-none leading-relaxed"
                        style={{
                          backgroundColor: 'var(--c-surface-2)',
                          border: '1px solid var(--c-border)',
                          color: 'var(--c-fg)'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Subview: Web URL Reference */}
                {sourceType === 'url' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--c-muted)' }}>
                        External Source URL (Required)
                      </label>
                      <div className="relative">
                        <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-muted)' }} />
                        <input
                          type="url"
                          placeholder="https://razorpay.com/docs/payments/upi"
                          value={wizardUrl}
                          onChange={(e) => setWizardUrl(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs outline-none"
                          style={{
                            backgroundColor: 'var(--c-surface-2)',
                            border: '1px solid var(--c-border)',
                            color: 'var(--c-fg)'
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--c-muted)' }}>
                        Source Title (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., NPCI UPI Guidelines 2026"
                        value={wizardDocName}
                        onChange={(e) => setWizardDocName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                        style={{
                          backgroundColor: 'var(--c-surface-2)',
                          border: '1px solid var(--c-border)',
                          color: 'var(--c-fg)'
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--c-muted)' }}>
                        Context Notes & Excerpt (For Semantic Retrieval)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Summarize key endpoints, regulatory constraints, or pricing tables from this reference..."
                        value={wizardUrlNotes}
                        onChange={(e) => setWizardUrlNotes(e.target.value)}
                        className="w-full p-3 rounded-xl text-xs resize-none outline-none"
                        style={{
                          backgroundColor: 'var(--c-surface-2)',
                          border: '1px solid var(--c-border)',
                          color: 'var(--c-fg)'
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-4 flex justify-between items-center" style={{ borderTop: '1px solid var(--c-border)' }}>
                  <button
                    onClick={() => setWizardStep(1)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>

                  <button
                    onClick={() => {
                      if (sourceType === 'file' && !wizardFile) {
                        setIngestionError('Please select a document file to proceed.');
                        return;
                      }
                      if (sourceType === 'text' && !wizardTextContent.trim()) {
                        setIngestionError('Please provide text content to proceed.');
                        return;
                      }
                      if (sourceType === 'url' && (!wizardUrl.trim() || !/^https?:\/\/.+/i.test(wizardUrl.trim()))) {
                        setIngestionError('Please enter a valid URL (e.g. https://example.com).');
                        return;
                      }
                      setIngestionError(null);
                      setWizardStep(3);
                    }}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all hover:opacity-90"
                    style={{
                      backgroundColor: 'var(--c-fg)',
                      color: 'var(--c-bg)'
                    }}
                  >
                    Next: Configure & Confirm
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: CONFIGURE & CONFIRM */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold block" style={{ color: 'var(--c-fg)' }}>
                    Configure Metadata & Confirm Ingestion
                  </label>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>
                    Step 3 of 3
                  </span>
                </div>

                {/* Error Banner */}
                {ingestionError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{ingestionError}</span>
                  </div>
                )}

                {/* Success Banner */}
                {ingestionStatus === 'completed' && (
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3 animate-fade-in">
                    <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        Successfully Ingested & Vectorized!
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-md mx-auto">
                        Document is now indexed into corporate memory. Executive council agents and the RAG intelligence hub can immediately draw citations from it.
                      </p>
                    </div>
                    <div className="pt-2 flex justify-center gap-3">
                      <button
                        onClick={() => {
                          closeWizard();
                          resetWizard();
                        }}
                        className="px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-sm"
                        style={{
                          backgroundColor: 'var(--c-fg)',
                          color: 'var(--c-bg)'
                        }}
                      >
                        Done & View in Library
                      </button>
                      <button
                        onClick={resetWizard}
                        className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all border"
                        style={{
                          backgroundColor: 'var(--c-surface)',
                          borderColor: 'var(--c-border)',
                          color: 'var(--c-fg)'
                        }}
                      >
                        Add Another Source
                      </button>
                    </div>
                  </div>
                )}

                {ingestionStatus !== 'completed' && (
                  <>
                    {/* Document Name */}
                    <div>
                      <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--c-muted)' }}>
                        Institutional Document Name
                      </label>
                      <input
                        type="text"
                        placeholder="Enter clean display name for this source..."
                        value={wizardDocName || (sourceType === 'file' ? wizardFile?.name : '')}
                        onChange={(e) => setWizardDocName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                        style={{
                          backgroundColor: 'var(--c-surface-2)',
                          border: '1px solid var(--c-border)',
                          color: 'var(--c-fg)'
                        }}
                      />
                    </div>

                    {/* Target Domain Category */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold block" style={{ color: 'var(--c-muted)' }}>
                        Knowledge Domain Category
                      </label>
                      <div className="relative">
                        <select
                          value={wizardDocType}
                          onChange={(e) => setWizardDocType(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl text-xs outline-none appearance-none"
                          style={{
                            backgroundColor: 'var(--c-surface-2)',
                            border: '1px solid var(--c-border)',
                            color: 'var(--c-fg)'
                          }}
                        >
                          {DOC_TYPES.map((dt) => (
                            <option key={dt.value} value={dt.value}>{dt.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--c-muted)' }} />
                      </div>
                    </div>

                    {/* Ingestion Verification Summary Card */}
                    <div 
                      className="p-4 rounded-xl border space-y-2 text-xs"
                      style={{
                        backgroundColor: 'var(--c-surface-2)',
                        borderColor: 'var(--c-border)'
                      }}
                    >
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider block" style={{ color: 'var(--c-muted)' }}>
                        Source Ingestion Summary
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Source Type:</span>
                          <span className="font-semibold uppercase" style={{ color: 'var(--c-fg)' }}>
                            {sourceType === 'file' ? `Document File (.${wizardFile?.name.split('.').pop()})` : sourceType === 'text' ? 'Direct Markdown' : 'Web URL'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Domain:</span>
                          <span className="font-semibold" style={{ color: 'var(--c-fg)' }}>
                            {DOC_TYPES.find(d => d.value === wizardDocType)?.label}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Payload:</span>
                          <span className="font-semibold" style={{ color: 'var(--c-fg)' }}>
                            {sourceType === 'file' 
                              ? `${((wizardFile?.size || 0) / 1024).toFixed(1)} KB` 
                              : sourceType === 'text' 
                              ? `${wizardTextContent.length} characters`
                              : wizardUrl}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Vector Grounding:</span>
                          <span className="font-semibold text-emerald-500">
                            text-embedding-004
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress State while indexing */}
                    {(ingestionStatus === 'uploading' || ingestionStatus === 'indexing') && (
                      <div className="p-4 rounded-xl bg-[#141413]/5 border border-[#141413]/10 space-y-2 text-xs">
                        <div className="flex items-center justify-between font-semibold text-[#141413]">
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-[#141413]" />
                            {ingestionStatus === 'uploading' ? 'Uploading source payload...' : 'Chunking, embedding & vector indexing...'}
                          </span>
                          <span className="font-mono text-[10px] text-[#666562]">Neural Processing</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Extracting tokens, computing vector embeddings, and creating cross-council citations.
                        </p>
                      </div>
                    )}

                    {/* Modal Step 3 Actions */}
                    <div className="pt-4 flex justify-between items-center" style={{ borderTop: '1px solid var(--c-border)' }}>
                      <button
                        onClick={() => setWizardStep(2)}
                        disabled={ingestionStatus === 'uploading' || ingestionStatus === 'indexing'}
                        className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-40"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back
                      </button>

                      <button
                        onClick={handleWizardSubmit}
                        disabled={ingestionStatus === 'uploading' || ingestionStatus === 'indexing'}
                        id="submit-knowledge-source-btn"
                        className="px-6 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all hover:opacity-90 shadow-md disabled:opacity-50"
                        style={{
                          backgroundColor: 'var(--c-fg)',
                          color: 'var(--c-bg)'
                        }}
                      >
                        {ingestionStatus === 'uploading' || ingestionStatus === 'indexing' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Processing Ingestion...
                          </>
                        ) : ingestionStatus === 'failed' ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            Retry Ingestion
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Ingest & Index Source
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

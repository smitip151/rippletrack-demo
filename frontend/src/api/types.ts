// RippleTrack — API Types

export interface PrdEntry {
  id: string;
  filename: string;
  short_description: string;
  target_repo_id: string;
  risk_band: 'Low' | 'Medium' | 'High';
  has_full_analysis: boolean;
}

export interface Repo {
  id: string;
  name: string;
  description: string;
}

export interface RippleNode {
  id: string;
  type: 'model' | 'consumer' | 'fixture' | 'test';
  risk_flags: string[];
}

export interface RippleEdge {
  source: string;
  target: string;
}

export interface RippleMap {
  nodes: RippleNode[];
  edges: RippleEdge[];
}

export interface RiskBreakdown {
  [factor: string]: {
    weight: number;
    triggered: boolean;
    reason: string;
  };
}

export interface RunListItem {
  id: string;
  run_id: string;
  prd_id: string | null;
  feature_ticket_id: string | null;
  target_repo_id: string | null;
  mode: 'library' | 'advanced';
  risk_score: number;
  risk_band: 'Low' | 'Medium' | 'High';
  blast_radius_files: string[];
  migration_status: string | null;
  test_result: string | null;
  timestamp: string | null;
  status: string | null;
}

export interface RunDetail extends RunListItem {
  risk_score_breakdown: RiskBreakdown | null;
  ripple_map: RippleMap;
  contract_analysis: Record<string, unknown> | null;
  code_archaeology: Record<string, unknown> | null;
  test_archaeology: Record<string, unknown> | null;
  migration_payload: Record<string, unknown> | null;
  mock_updates: Record<string, unknown> | null;
  downstream_guards: Record<string, unknown> | null;
  signals: RunListItem[];
}

export interface AgentStatus {
  run_id: string;
  status: 'queued' | 'running' | 'complete' | 'error';
  agents: {
    'Contract Detective': 'pending' | 'running' | 'done';
    'Code Archaeologist': 'pending' | 'running' | 'done';
    'Test Archaeologist': 'pending' | 'running' | 'done';
  };
  error?: string;
}

export interface CiSimulateResult {
  run_id: string;
  simulated: boolean;
  platform_note?: string;
  ticket_id: string;
  before?: Array<{ test: string; result: string; before: boolean }>;
  after?: Array<{ test: string; result: string; before: boolean }>;
  overall?: string;
  passed?: boolean;
  stdout?: string;
  test_lines?: string[];
}

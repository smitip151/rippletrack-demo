// RippleTrack — API Client

import type {
  PrdEntry, Repo, RunListItem, RunDetail, AgentStatus, CiSimulateResult,
} from './types';

// In development the Vite proxy forwards /api to :3001, so BASE can be empty.
// Set VITE_API_URL to override (e.g. for production).
const BASE = import.meta.env.VITE_API_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = (data as { error?: string }).error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

// ─── PRD Library ─────────────────────────────────────────────────────────────
export async function getPrdLibrary(): Promise<{ prds: PrdEntry[]; repos: Repo[] }> {
  return request('/api/prd-library');
}

// ─── Analyze ─────────────────────────────────────────────────────────────────
export async function analyzeLibraryPrd(
  prdId: string,
  targetRepoId: string,
  demoMode = false,
): Promise<{ run_id: string; status: string; mode: string }> {
  return request('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ prd_id: prdId, target_repo_id: targetRepoId, demo_mode: demoMode }),
  });
}

export async function analyzeAdvancedUpload(
  file: File,
  targetRepoId: string,
): Promise<{ run_id: string; status: string; mode: string }> {
  const form = new FormData();
  form.append('prd_file', file);
  form.append('mode', 'advanced');
  form.append('target_repo_id', targetRepoId);

  const res = await fetch(`${BASE}/api/analyze`, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as { run_id: string; status: string; mode: string };
}

// ─── Runs ────────────────────────────────────────────────────────────────────
export async function getRuns(): Promise<{ runs: RunListItem[]; count: number }> {
  return request('/api/runs');
}

export async function getRunDetail(runId: string): Promise<RunDetail> {
  return request(`/api/runs/${runId}`);
}

export async function getRunStatus(runId: string): Promise<AgentStatus> {
  return request(`/api/runs/${runId}/status`);
}

// ─── CI Simulate ─────────────────────────────────────────────────────────────
export async function runCiSimulate(runId: string): Promise<CiSimulateResult> {
  return request(`/api/runs/${runId}/ci-simulate`, { method: 'POST' });
}

// ─── Signals ─────────────────────────────────────────────────────────────────
export async function getSignals(): Promise<{ signals: RunListItem[]; count: number }> {
  return request('/api/signals');
}

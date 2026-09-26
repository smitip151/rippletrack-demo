import { useEffect, useState, useRef, useCallback } from 'react';
import { getPrdLibrary, analyzeLibraryPrd, analyzeAdvancedUpload, getRunStatus } from '../api/client';
import type { PrdEntry, Repo, AgentStatus } from '../api/types';

interface Props {
  onRunStarted: (runId: string) => void;
}

const AGENT_NAMES = ['Contract Detective', 'Code Archaeologist', 'Test Archaeologist'] as const;
const AGENT_ICONS: Record<string, string> = {
  'Contract Detective':   '🔍',
  'Code Archaeologist':  '⛏',
  'Test Archaeologist':  '🧪',
};
const AGENT_DESCS: Record<string, string> = {
  'Contract Detective':   'Parsing PRD — extracting field constraints, optionality, defaults',
  'Code Archaeologist':  'Tracing model into downstream consumers via AST',
  'Test Archaeologist':  'Scanning fixtures and mocks for staleness',
};

function riskBadgeClass(band: string) {
  if (band === 'High') return 'badge badge-high';
  if (band === 'Medium') return 'badge badge-medium';
  return 'badge badge-low';
}

export default function NewAnalysisPage({ onRunStarted }: Props) {
  const [prds, setPrds]       = useState<PrdEntry[]>([]);
  const [repos, setRepos]     = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Run state
  const [activeRunId, setActiveRunId]   = useState<string | null>(null);
  const [agentStatus, setAgentStatus]   = useState<AgentStatus | null>(null);
  const [runningPrdId, setRunningPrdId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Advanced mode
  const [advancedOpen, setAdvancedOpen]       = useState(false);
  const [advancedFile, setAdvancedFile]       = useState<File | null>(null);
  const [advancedRepo, setAdvancedRepo]       = useState('rippletrack-demo');
  const [dragOver, setDragOver]               = useState(false);
  const [advancedRunning, setAdvancedRunning] = useState(false);

  useEffect(() => {
    getPrdLibrary()
      .then(d => { setPrds(d.prds); setRepos(d.repos); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const startPolling = useCallback((runId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await getRunStatus(runId);
        setAgentStatus(status);
        if (status.status === 'complete' || status.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current);
          if (status.status === 'complete') {
            // Short delay so the user sees all agents as done
            setTimeout(() => onRunStarted(runId), 800);
          }
        }
      } catch (_) {}
    }, 500);
  }, [onRunStarted]);

  const handleRunPrd = async (prd: PrdEntry) => {
    setRunningPrdId(prd.id);
    setActiveRunId(null);
    setAgentStatus({
      run_id: '',
      status: 'queued',
      agents: { 'Contract Detective': 'pending', 'Code Archaeologist': 'pending', 'Test Archaeologist': 'pending' },
    });
    try {
      const res = await analyzeLibraryPrd(prd.id, prd.target_repo_id);
      setActiveRunId(res.run_id);
      startPolling(res.run_id);
    } catch (e: unknown) {
      setError((e as Error).message);
      setRunningPrdId(null);
      setAgentStatus(null);
    }
  };

  const handleAdvancedRun = async () => {
    if (!advancedFile) return;
    setAdvancedRunning(true);
    setActiveRunId(null);
    setAgentStatus({
      run_id: '',
      status: 'queued',
      agents: { 'Contract Detective': 'pending', 'Code Archaeologist': 'pending', 'Test Archaeologist': 'pending' },
    });
    try {
      const res = await analyzeAdvancedUpload(advancedFile, advancedRepo);
      setActiveRunId(res.run_id);
      startPolling(res.run_id);
    } catch (e: unknown) {
      setError((e as Error).message);
      setAdvancedRunning(false);
      setAgentStatus(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setAdvancedFile(f);
  };

  const isRunning = agentStatus && (agentStatus.status === 'queued' || agentStatus.status === 'running');

  return (
    <div>
      <div className="page-header">
        <h1>New Analysis</h1>
        <p>Select a PRD from the library to run RippleTrack, or use Advanced Mode to upload your own.</p>
      </div>

      {error && (
        <div className="warning-banner" style={{ marginBottom: 20 }}>
          ⚠ {error}
          <button className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Live progress overlay */}
      {agentStatus && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">
            {isRunning ? '⏳ Analysis in progress…' : agentStatus.status === 'error' ? '✗ Analysis failed' : '✓ Analysis complete'}
          </div>
          <div className="agents-grid">
            {AGENT_NAMES.map(name => {
              const state = agentStatus.agents[name];
              return (
                <div key={name} className={`agent-card ${state}`}>
                  <div className="agent-icon">
                    {state === 'running' ? <div className="spinner" /> : AGENT_ICONS[name]}
                  </div>
                  <div className="agent-name">{name}</div>
                  <div className="agent-status">
                    {state === 'pending' ? 'Waiting…'
                    : state === 'running' ? AGENT_DESCS[name]
                    : '✓ Complete'}
                  </div>
                </div>
              );
            })}
          </div>
          {agentStatus.status === 'error' && (
            <p className="text-red mt-8">{agentStatus.error}</p>
          )}
          {isRunning && (
            <p className="text-muted mt-8" style={{ fontSize: 12 }}>
              Run ID: {activeRunId || '—'} · Polling for updates…
            </p>
          )}
        </div>
      )}

      {/* PRD Library */}
      {loading ? (
        <div className="text-muted">Loading PRD library…</div>
      ) : (
        <>
          <div className="card-title" style={{ marginBottom: 14 }}>
            PRD Library · {prds.length} documents
          </div>
          <div className="prd-grid">
            {prds.map(prd => (
              <div key={prd.id} className="prd-card">
                <div className="prd-card-header">
                  <div>
                    <div className="prd-card-title">{prd.filename}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{prd.target_repo_id}</div>
                  </div>
                  <span className={riskBadgeClass(prd.risk_band)}>{prd.risk_band}</span>
                </div>
                <div className="prd-card-desc">{prd.short_description}</div>
                <div className="prd-card-footer">
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {prd.has_full_analysis ? '● Full analysis' : '● Synthetic analysis'}
                  </span>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!!isRunning}
                    onClick={() => handleRunPrd(prd)}
                  >
                    {runningPrdId === prd.id && isRunning ? '⏳ Running…' : '▶ Run RippleTrack'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Advanced Mode */}
      <div className="advanced-section" style={{ marginTop: 28 }}>
        <div className="advanced-header" onClick={() => setAdvancedOpen(o => !o)}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            Advanced Mode — Upload custom PRD
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{advancedOpen ? '▲ collapse' : '▼ expand'}</span>
        </div>
        {advancedOpen && (
          <div className="advanced-body">
            <div className="warning-banner" style={{ marginBottom: 16 }}>
              ⚠ <strong>Experimental</strong> — Parsing and tracing accuracy isn't guaranteed on custom documents.
              The PRD Library path is recommended for the recorded demo.
            </div>

            <div
              className={`upload-area${dragOver ? ' drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('adv-file-input')?.click()}
            >
              {advancedFile ? (
                <p>📄 <strong>{advancedFile.name}</strong> ({(advancedFile.size / 1024).toFixed(1)} KB)</p>
              ) : (
                <p>Drag & drop a .docx or .pdf file, or click to browse</p>
              )}
              <input
                id="adv-file-input"
                type="file"
                accept=".docx,.pdf,.txt"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) setAdvancedFile(e.target.files[0]); }}
              />
            </div>

            <div className="flex items-center gap-12 mt-12">
              <label style={{ fontSize: 13, color: 'var(--muted)' }}>Target repo:</label>
              <select value={advancedRepo} onChange={e => setAdvancedRepo(e.target.value)}>
                {repos.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button
                className="btn btn-primary"
                disabled={!advancedFile || !!isRunning || advancedRunning}
                onClick={handleAdvancedRun}
              >
                {advancedRunning && isRunning ? '⏳ Running…' : '▶ Run Advanced Analysis'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

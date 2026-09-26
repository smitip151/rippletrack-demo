import { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getRunDetail, runCiSimulate } from '../api/client';
import type { RunDetail, RiskBreakdown, CiSimulateResult } from '../api/types';

interface Props {
  runId: string;
  onBack: () => void;
}

// ── Colour map ────────────────────────────────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
  model:   '#4f8ef7',
  consumer: '#7c5cd8',
  fixture: '#f59e0b',
  test:    '#22c55e',
};

function nodeStyle(type: string) {
  const c = NODE_COLORS[type] || '#8b92a8';
  return {
    background: `${c}22`,
    border: `1.5px solid ${c}`,
    borderRadius: 8,
    color: '#e8eaf0',
    fontSize: 11,
    padding: '6px 10px',
    maxWidth: 180,
    wordBreak: 'break-word' as const,
  };
}

// ── Risk Gauge SVG ────────────────────────────────────────────────────────────
function RiskGauge({ score }: { score: number }) {
  const r = 70;
  const cx = 90;
  const cy = 90;
  const circumference = Math.PI * r; // half circle
  const pct = Math.min(score, 100) / 100;
  const dash = pct * circumference;

  const color = score > 60 ? '#ef4444' : score > 30 ? '#f59e0b' : '#22c55e';
  const band  = score > 60 ? 'High' : score > 30 ? 'Medium' : 'Low';

  return (
    <div className="gauge-wrap">
      <svg width="180" height="108" className="gauge-svg">
        {/* Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#2e3347"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
        {/* Score */}
        <text x={cx} y={cy - 10} textAnchor="middle" fill={color} fontSize="32" fontWeight="800">
          {score}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#8b92a8" fontSize="12">
          / 100
        </text>
      </svg>
      <span className={`badge badge-${band.toLowerCase()}`} style={{ fontSize: 13, padding: '3px 12px' }}>
        {band} Risk
      </span>
    </div>
  );
}

// ── Risk Breakdown Table ──────────────────────────────────────────────────────
function RiskBreakdownTable({ breakdown }: { breakdown: RiskBreakdown }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(breakdown);
  const triggered = entries.filter(([, v]) => v.triggered);

  return (
    <div>
      <div className="expandable-header" onClick={() => setOpen(o => !o)} style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          Factor Breakdown — {triggered.length}/{entries.length} triggered
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Factor</th>
                <th>Weight</th>
                <th>Triggered</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, val]) => (
                <tr key={key} className={`breakdown-row${val.triggered ? ' triggered' : ''}`}>
                  <td>
                    {val.triggered && <span className="triggered-dot" />}
                    {key.replace(/_/g, ' ')}
                  </td>
                  <td style={{ color: 'var(--muted)' }}>+{val.weight}</td>
                  <td>
                    {val.triggered
                      ? <span className="badge badge-high">Yes</span>
                      : <span className="badge badge-muted">No</span>}
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{val.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Signal Registry Table ─────────────────────────────────────────────────────
function SignalRegistryTable({ signals, runId }: { signals: RunDetail['signals']; runId: string }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Ticket</th>
            <th>Risk</th>
            <th>Migration</th>
            <th>Test</th>
            <th>Blast Radius</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((s, i) => (
            <tr key={s.id || i} style={s.run_id === runId ? { background: 'rgba(79,142,247,0.05)' } : {}}>
              <td className="mono" style={{ fontSize: 11 }}>{s.id}</td>
              <td>{s.feature_ticket_id || '—'}</td>
              <td>
                <span className={`badge badge-${(s.risk_band || 'low').toLowerCase()}`}>
                  {s.risk_score}
                </span>
              </td>
              <td>{migrationBadge(s.migration_status)}</td>
              <td>{testBadge(s.test_result)}</td>
              <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                {s.blast_radius_files?.length
                  ? `${s.blast_radius_files.length} file${s.blast_radius_files.length > 1 ? 's' : ''}`
                  : '—'}
              </td>
              <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                {s.timestamp ? new Date(s.timestamp).toLocaleString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function migrationBadge(status: string | null) {
  if (!status || status === 'none') return <span className="badge badge-muted">none</span>;
  if (status === 'applied') return <span className="badge badge-low">applied</span>;
  if (status === 'pending') return <span className="badge badge-medium">pending</span>;
  if (status === 'failed')  return <span className="badge badge-high">failed</span>;
  return <span className="badge badge-muted">{status}</span>;
}

function testBadge(result: string | null) {
  if (!result) return <span className="badge badge-muted">—</span>;
  if (result === 'pass') return <span className="badge badge-low">pass</span>;
  if (result === 'fail') return <span className="badge badge-high">fail</span>;
  if (result === 'flaky') return <span className="badge badge-medium">flaky</span>;
  return <span className="badge badge-muted">{result}</span>;
}

// ── CI Panel ──────────────────────────────────────────────────────────────────
function CiPanel({ runId }: { runId: string }) {
  const [result, setResult] = useState<CiSimulateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await runCiSimulate(runId);
      setResult(r);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ci-panel">
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          Triggers the CI simulation script against this run's signals.
        </span>
        <button className="btn btn-primary" onClick={run} disabled={loading}>
          {loading ? '⏳ Running CI…' : '▶ Run CI Simulation'}
        </button>
      </div>

      {error && <div className="warning-banner">{error}</div>}

      {result && (
        <>
          <div className="flex items-center gap-8 mt-8">
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Overall: {result.overall === 'pass' || result.passed
                ? <span className="text-green">✓ PASS</span>
                : <span className="text-red">✗ FAIL</span>}
            </span>
            {result.simulated && (
              <span className="badge badge-muted">Simulated (Windows)</span>
            )}
            {result.platform_note && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{result.platform_note}</span>
            )}
          </div>

          {result.before && result.after && (
            <div>
              <div className="card-title" style={{ marginTop: 12 }}>Before → After</div>
              {result.before.map((t, i) => (
                <div key={i} className="ci-test-row" style={{ marginBottom: 6 }}>
                  <span className="ci-test-name">{t.test}</span>
                  <div className="flex items-center gap-8">
                    <span className={`ci-result ${result.before![i].result}`}>
                      {result.before![i].result.toUpperCase()}
                    </span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>→</span>
                    <span className={`ci-result ${result.after![i].result}`}>
                      {result.after![i].result.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.stdout && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>
                Raw output
              </summary>
              <pre className="code-block" style={{ marginTop: 6 }}>{result.stdout}</pre>
            </details>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage({ runId, onBack }: Props) {
  const [detail, setDetail]   = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ripple' | 'signals' | 'ci'>('ripple');

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  const buildFlow = useCallback((detail: RunDetail) => {
    const nm = detail.ripple_map?.nodes || [];
    const em = detail.ripple_map?.edges || [];

    // Simple left-to-right layout by type
    const typeOrder: Record<string, number> = { model: 0, consumer: 1, fixture: 2, test: 3 };
    const byType: Record<number, typeof nm> = {};
    for (const n of nm) {
      const col = typeOrder[n.type] ?? 4;
      byType[col] = byType[col] || [];
      byType[col].push(n);
    }

    const nodes: Node[] = [];
    for (const [col, group] of Object.entries(byType)) {
      group.forEach((n, row) => {
        const label = n.id.split('/').pop() || n.id;
        nodes.push({
          id:       n.id,
          position: { x: parseInt(col) * 240 + 40, y: row * 90 + 40 },
          data: {
            label: (
              <div title={n.id}>
                <div style={{ fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 10, color: NODE_COLORS[n.type] || '#8b92a8', marginTop: 2 }}>
                  {n.type}
                </div>
                {n.risk_flags.length > 0 && (
                  <div title={n.risk_flags.join('\n')} style={{ fontSize: 10, marginTop: 2, color: '#f87171' }}>
                    ⚠ {n.risk_flags.length} flag{n.risk_flags.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            ),
          },
          style: nodeStyle(n.type),
        });
      });
    }

    const edges: Edge[] = em.map((e, i) => ({
      id:     `e-${i}`,
      source: e.source,
      target: e.target,
      animated: true,
      style: { stroke: '#4f8ef7', opacity: 0.6 },
    }));

    setRfNodes(nodes);
    setRfEdges(edges);
  }, [setRfNodes, setRfEdges]);

  useEffect(() => {
    getRunDetail(runId)
      .then(d => {
        setDetail(d);
        buildFlow(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [runId, buildFlow]);

  if (loading) return <div className="text-muted">Loading dashboard…</div>;
  if (error)   return <div className="warning-banner">⚠ {error}</div>;
  if (!detail) return null;

  const prdLabel = detail.prd_id || detail.feature_ticket_id || runId;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: 8 }}>
            ← Back to Analysis
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>{prdLabel}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Run {runId.slice(0, 8)}… · {detail.mode === 'advanced' ? '⚠ Advanced Mode' : '● Library Mode'} ·{' '}
            {detail.timestamp ? new Date(detail.timestamp).toLocaleString() : '—'}
          </p>
        </div>
        <RiskGauge score={detail.risk_score} />
      </div>

      {/* Risk breakdown */}
      {detail.risk_score_breakdown && (
        <div className="card" style={{ marginBottom: 20 }}>
          <RiskBreakdownTable breakdown={detail.risk_score_breakdown} />
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab${activeTab === 'ripple' ? ' active' : ''}`} onClick={() => setActiveTab('ripple')}>
          Ripple Map
        </button>
        <button className={`tab${activeTab === 'signals' ? ' active' : ''}`} onClick={() => setActiveTab('signals')}>
          Signal Registry
        </button>
        <button className={`tab${activeTab === 'ci' ? ' active' : ''}`} onClick={() => setActiveTab('ci')}>
          CI Verification
        </button>
      </div>

      {/* Ripple Map */}
      {activeTab === 'ripple' && (
        <div>
          <div className="flex gap-8 mb-12" style={{ flexWrap: 'wrap' }}>
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <span key={type} style={{ fontSize: 11, color, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
                {type}
              </span>
            ))}
          </div>

          {rfNodes.length === 0 ? (
            <div className="card text-muted" style={{ textAlign: 'center', padding: 40 }}>
              No ripple map nodes found for this run.
            </div>
          ) : (
            <div className="flow-container">
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
                fitViewOptions={{ padding: 0.2 }}
              >
                <Background color="#2e3347" gap={20} />
                <Controls />
                <MiniMap
                  nodeColor={n => {
                    const s = n.style as { border?: string } | undefined;
                    for (const [, c] of Object.entries(NODE_COLORS)) {
                      if (s?.border?.includes(c)) return c;
                    }
                    return '#4f8ef7';
                  }}
                  style={{ background: '#1a1d27', border: '1px solid #2e3347' }}
                />
              </ReactFlow>
            </div>
          )}

          {/* Node risk flags detail */}
          {detail.ripple_map.nodes.some(n => n.risk_flags.length > 0) && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title">Risk Flags by Node</div>
              {detail.ripple_map.nodes.filter(n => n.risk_flags.length > 0).map(n => (
                <div key={n.id} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                    {n.id}
                    <span className={`badge badge-${n.type === 'model' ? 'blue' : n.type === 'consumer' ? 'purple' : 'medium'}`} style={{ marginLeft: 6, fontSize: 10 }}>
                      {n.type}
                    </span>
                  </div>
                  {n.risk_flags.map((f, i) => (
                    <div key={i} className="signal-flag" style={{ display: 'block', marginBottom: 3, padding: '2px 8px', borderRadius: 4 }}>
                      {f}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Migration payload */}
          {detail.migration_payload && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title">Migration Payload</div>
              <pre className="code-block">
                {typeof detail.migration_payload === 'string'
                  ? detail.migration_payload
                  : JSON.stringify(detail.migration_payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Signal Registry */}
      {activeTab === 'signals' && (
        <div>
          {detail.signals.length === 0 ? (
            <div className="card text-muted" style={{ textAlign: 'center', padding: 40 }}>
              No signals recorded for this run yet.
            </div>
          ) : (
            <SignalRegistryTable signals={detail.signals} runId={runId} />
          )}
        </div>
      )}

      {/* CI Panel */}
      {activeTab === 'ci' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>CI Verification</div>
          <CiPanel runId={runId} />
        </div>
      )}
    </div>
  );
}

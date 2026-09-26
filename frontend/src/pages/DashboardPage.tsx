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

// ── Node colour map — uses CSS-var-resolved values for React Flow inline styles.
// These are intentionally declared here so ReactFlow (which needs inline styles)
// can use them. All other styling goes through CSS variables.
const NODE_COLORS: Record<string, string> = {
  model:    '#DC0000',  // Ferrari red   — var(--ferrari-red)
  consumer: '#B47FFF',  // Purple        — var(--badge-purple-text)
  fixture:  '#E8B84B',  // Gold          — var(--gold)
  test:     '#00C864',  // Green         — var(--pass)
};

function nodeStyle(type: string) {
  const c = NODE_COLORS[type] || '#888888';
  return {
    background: `${c}18`,
    border: `1.5px solid ${c}`,
    borderRadius: 8,
    color: '#F0F0F0',
    fontSize: 11,
    padding: '6px 10px',
    maxWidth: 180,
    wordBreak: 'break-word' as const,
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
  };
}

// ── Rev-counter / Speedometer Gauge ──────────────────────────────────────────
// Layout:
//   - Arc sweeps 210° from 120° → 330° (gap is upper-right: 330°→120° through 0°)
//   - Score pill sits in the blank upper-right interior of the dial
//   - Risk band badge rendered as HTML below the SVG
function RiskGauge({ score }: { score: number }) {
  const W  = 260;   // viewBox width
  const cx = 130;   // horizontal centre
  const cy = 118;   // arc centre
  const r  = 96;    // arc radius
  const totalAngle = 210; // degrees of sweep

  function polarToXY(angleDeg: number, radius: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function arcPath(startDeg: number, endDeg: number, innerR: number, outerR: number) {
    const s1 = polarToXY(startDeg, outerR);
    const e1 = polarToXY(endDeg,   outerR);
    const s2 = polarToXY(endDeg,   innerR);
    const e2 = polarToXY(startDeg, innerR);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return [
      `M ${s1.x} ${s1.y}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${e1.x} ${e1.y}`,
      `L ${s2.x} ${s2.y}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${e2.x} ${e2.y}`,
      'Z',
    ].join(' ');
  }

  const arcStart = 120;                          // leftmost point of the arc
  const arcEnd   = arcStart + totalAngle;        // 330°
  const pct      = Math.min(score, 100) / 100;

  const lowEnd    = arcStart + totalAngle * 0.30;
  const medEnd    = arcStart + totalAngle * 0.60;
  const needleAngle = arcStart + totalAngle * pct;

  const band  = score > 60 ? 'High' : score > 30 ? 'Medium' : 'Low';
  const needleColor = score > 60 ? '#DC0000' : score > 30 ? '#E8B84B' : '#00C864';
  // Readable hex colors for SVG fill (CSS vars don't resolve inside SVG attributes)
  const scoreHex = score > 60 ? '#FF5555' : score > 30 ? '#E8B84B' : '#00C864';

  const needleTip = polarToXY(needleAngle, r - 8);
  const needleL   = polarToXY(needleAngle + 90, 9);
  const needleR   = polarToXY(needleAngle - 90, 9);

  // 13 tick marks across the 210° sweep
  const TICKS = 12;
  const tickAngles = Array.from({ length: TICKS + 1 }, (_, i) =>
    arcStart + (totalAngle / TICKS) * i
  );

  // ── Score pill position: upper-right blank quadrant inside the dial.
  // The arc gap sits between arcEnd (330°) and arcStart (120°) going through 0°.
  // Midpoint of the gap = (330 + 360 + 120) / 2 = 405° → 45° in standard polar.
  // Radial distance: half-way between hub and inner arc edge (~r*0.48).
  const gapMidAngle = 45; // degrees (in our polar convention: 0° = top)
  const pillCX = cx + (r * 0.50) * Math.cos(((gapMidAngle - 90) * Math.PI) / 180);
  const pillCY = cy + (r * 0.50) * Math.sin(((gapMidAngle - 90) * Math.PI) / 180);
  const pillW = 72;
  const pillH = 36;

  // The arc bottom sits at cy + r = 118 + 96 = 214. The zone labels extend
  // ~14px beyond the arc edge, so the lowest content is at ~228px.
  // Cap at 230 so the SVG height exactly matches content — no phantom space
  // for the badge to float into.
  const svgH = 230;

  return (
    <div className="gauge-wrap">
      <svg
        width={W}
        height={svgH}
        viewBox={`0 0 ${W} ${svgH}`}
        className="gauge-svg"
        style={{ overflow: 'visible', display: 'block' }}
        aria-label={`Risk score ${score} out of 100 — ${band}`}
      >
        {/* ── Outer glow ring (decorative) ── */}
        <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.25" />

        {/* ── Arc track background ── */}
        <path d={arcPath(arcStart, arcEnd, r - 18, r)} fill="#1C1C1C" />

        {/* ── Coloured zone fills ── */}
        <path d={arcPath(arcStart,    lowEnd, r - 18, r)} fill="rgba(0,200,100,0.28)" />
        <path d={arcPath(lowEnd,      medEnd, r - 18, r)} fill="rgba(232,184,75,0.28)" />
        <path d={arcPath(medEnd,  arcEnd,     r - 18, r)} fill="rgba(220,0,0,0.32)" />

        {/* ── Redline hash marks ── */}
        {[0,1,2,3,4].map(i => {
          const a = medEnd + ((arcEnd - medEnd) / 5) * i + 2;
          const p1 = polarToXY(a, r - 18);
          const p2 = polarToXY(a, r - 4);
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#DC0000" strokeWidth="2" opacity="0.7" />;
        })}

        {/* ── Tick marks ── */}
        {tickAngles.map((a, i) => {
          const isMajor = i % 3 === 0;
          const p1 = polarToXY(a, r - (isMajor ? 24 : 20));
          const p2 = polarToXY(a, r - (isMajor ? 13 : 17));
          return (
            <line key={a}
              x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke={isMajor ? '#888888' : '#3A3A3A'}
              strokeWidth={isMajor ? 1.5 : 1}
            />
          );
        })}

        {/* ── Needle ── */}
        <polygon
          points={`${needleL.x},${needleL.y} ${needleTip.x},${needleTip.y} ${needleR.x},${needleR.y}`}
          fill={needleColor}
          opacity="0.95"
        />
        {/* Hub */}
        <circle cx={cx} cy={cy} r={9}  fill="#141414" stroke="#2A2A2A" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={4}  fill={needleColor} opacity="0.9" />

        {/* ── Zone labels (outside the arc) ── */}
        {(() => {
          const lp = polarToXY(arcStart + 8,  r + 12);
          const mp = polarToXY(arcStart + totalAngle * 0.5, r + 14);
          const hp = polarToXY(arcEnd   - 8,  r + 12);
          return <>
            <text x={lp.x} y={lp.y} fill="#00C864" fontSize="9" fontFamily="'Titillium Web',sans-serif" fontWeight="700" letterSpacing="0.08em" textAnchor="middle">LOW</text>
            <text x={mp.x} y={mp.y} fill="#E8B84B" fontSize="9" fontFamily="'Titillium Web',sans-serif" fontWeight="700" letterSpacing="0.08em" textAnchor="middle">MED</text>
            <text x={hp.x} y={hp.y} fill="#FF5555" fontSize="9" fontFamily="'Titillium Web',sans-serif" fontWeight="700" letterSpacing="0.08em" textAnchor="middle">HIGH</text>
          </>;
        })()}

        {/* ── Score pill — upper-right blank quadrant of the dial ── */}
        <rect
          x={pillCX - pillW / 2}
          y={pillCY - pillH / 2}
          width={pillW}
          height={pillH}
          rx="5" ry="5"
          fill="#0A0A0A"
          stroke={needleColor}
          strokeWidth="1.5"
        />
        {/* Score number */}
        <text
          x={pillCX - 8}
          y={pillCY + 9}
          textAnchor="middle"
          fill={scoreHex}
          fontSize="26"
          fontWeight="600"
          fontFamily="'JetBrains Mono','Consolas',monospace"
        >
          {score}
        </text>
        {/* /100 — small, right-aligned inside the pill */}
        <text
          x={pillCX + pillW / 2 - 5}
          y={pillCY + 12}
          textAnchor="end"
          fill="#5A5A5A"
          fontSize="9"
          fontFamily="'Titillium Web',sans-serif"
          letterSpacing="0.06em"
        >
          /100
        </text>
      </svg>

      {/* ── Risk band badge — rendered in HTML, clearly below the SVG ── */}
      <span
        className={`badge badge-${band.toLowerCase()}`}
        style={{ fontSize: 12, padding: '4px 14px', display: 'inline-block' }}
      >
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
        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
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
                  <td style={{ color: 'var(--muted-light)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>+{val.weight}</td>
                  <td>
                    {val.triggered
                      ? <span className="badge badge-high">Yes</span>
                      : <span className="badge badge-muted">No</span>}
                  </td>
                  <td style={{ color: 'var(--muted-light)', fontSize: 12 }}>{val.reason}</td>
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
            <tr
              key={s.id || i}
              style={s.run_id === runId ? { background: 'var(--ferrari-red-subtle)' } : {}}
            >
              <td className="mono" style={{ fontSize: 11 }}>{s.id}</td>
              <td>{s.feature_ticket_id || '—'}</td>
              <td>
                <span className={`badge badge-${(s.risk_band || 'low').toLowerCase()}`}>
                  {s.risk_score}
                </span>
              </td>
              <td>{migrationBadge(s.migration_status)}</td>
              <td>{testBadge(s.test_result)}</td>
              <td style={{ fontSize: 11, color: 'var(--muted-light)', fontFamily: 'var(--font-mono)' }}>
                {s.blast_radius_files?.length
                  ? `${s.blast_radius_files.length} file${s.blast_radius_files.length > 1 ? 's' : ''}`
                  : '—'}
              </td>
              <td style={{ fontSize: 11, color: 'var(--muted-light)', fontFamily: 'var(--font-mono)' }}>
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
  if (result === 'pass')  return <span className="badge badge-low">pass</span>;
  if (result === 'fail')  return <span className="badge badge-high">fail</span>;
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
        <span style={{ fontSize: 13, color: 'var(--muted-light)' }}>
          Triggers the CI simulation script against this run's signals.
        </span>
        <button className="btn btn-primary" onClick={run} disabled={loading}>
          {loading ? (
            <>
              <span className="spinner" style={{ width: 14, height: 14 }} />
              Running CI…
            </>
          ) : '▶ Run CI Simulation'}
        </button>
      </div>

      {/* Checkered-flag progress bar while CI runs */}
      {loading && <div className="ci-progress-bar" />}

      {error && <div className="warning-banner">{error}</div>}

      {result && (
        <>
          <div className="flex items-center gap-8 mt-8">
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-display)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Overall:{' '}
              {result.overall === 'pass' || result.passed
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
                <div style={{ fontSize: 10, color: NODE_COLORS[n.type] || 'var(--muted-light)', marginTop: 2 }}>
                  {n.type}
                </div>
                {n.risk_flags.length > 0 && (
                  <div title={n.risk_flags.join('\n')} style={{ fontSize: 10, marginTop: 2, color: 'var(--risk-high-text)' }}>
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
      style: { stroke: 'var(--ferrari-red)', opacity: 0.5 },
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

  if (loading) return (
    <div className="flex items-center gap-12" style={{ color: 'var(--muted-light)', padding: 40 }}>
      <div className="spinner" />
      <span>Loading dashboard…</span>
    </div>
  );
  if (error)   return <div className="warning-banner">⚠ {error}</div>;
  if (!detail) return null;

  const prdLabel = detail.prd_id || detail.feature_ticket_id || runId;

  return (
    <div>
      {/* ── Header: checkered-flag strip left, gauge right ── */}
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <div className="f1-page-header" style={{ flex: 1, marginBottom: 0, paddingTop: 20 }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: 8, marginTop: 0 }}>
            ← Back
          </button>
          <h1 style={{ marginTop: 10 }}>{prdLabel}</h1>
          <p>
            RUN {runId.slice(0, 8)}… ·{' '}
            {detail.mode === 'advanced' ? '⚠ ADVANCED' : '● LIBRARY'} ·{' '}
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

      {/* ── Race-track divider above tabs ── */}
      <div className="f1-track-divider" style={{ margin: '0 0 0' }} />

      {/* Tabs */}
      <div className="tabs" style={{ marginTop: 0 }}>
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
              <span key={type} style={{ fontSize: 11, color, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
                <Background color="var(--border)" gap={20} />
                <Controls />
                <MiniMap
                  nodeColor={n => {
                    const s = n.style as { border?: string } | undefined;
                    for (const [, c] of Object.entries(NODE_COLORS)) {
                      if (s?.border?.includes(c)) return c;
                    }
                    return NODE_COLORS.model;
                  }}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                />
              </ReactFlow>
            </div>
          )}

          {/* Node risk flags */}
          {detail.ripple_map.nodes.some(n => n.risk_flags.length > 0) && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title">Risk Flags by Node</div>
              {detail.ripple_map.nodes.filter(n => n.risk_flags.length > 0).map(n => (
                <div key={n.id} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: 4 }}>
                    {n.id}
                    <span
                      className={`badge badge-${n.type === 'model' ? 'high' : n.type === 'consumer' ? 'purple' : 'medium'}`}
                      style={{ marginLeft: 6, fontSize: 10 }}
                    >
                      {n.type}
                    </span>
                  </div>
                  {n.risk_flags.map((f, i) => (
                    <div key={i} className="signal-flag" style={{ display: 'block', marginBottom: 3 }}>
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
          {/* Pit-stop label replaces the plain card title */}
          <span className="f1-pit-label">
            {/* Wrench / pit-stop SVG icon */}
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2a3.5 3.5 0 0 0-3.46 4.04L2 10.09 3.91 12l4.05-4.04A3.5 3.5 0 1 0 9.5 2z" />
            </svg>
            Pit Stop — CI Verification
          </span>
          <CiPanel runId={runId} />
        </div>
      )}
    </div>
  );
}

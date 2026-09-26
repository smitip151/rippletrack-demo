import { useEffect, useState } from 'react';
import { getRuns } from '../api/client';
import type { RunListItem } from '../api/types';

interface Props {
  onOpenRun: (runId: string) => void;
}

type SortKey = 'timestamp' | 'risk_score' | 'mode' | 'test_result';
type SortDir = 'asc' | 'desc';

export default function RunHistoryPage({ onOpenRun }: Props) {
  const [runs, setRuns]       = useState<RunListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    getRuns()
      .then(d => setRuns(d.runs))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...runs].sort((a, b) => {
    let va: string | number = a[sortKey] ?? '';
    let vb: string | number = b[sortKey] ?? '';
    if (sortKey === 'risk_score') { va = a.risk_score; vb = b.risk_score; }
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortIcon = ({ key: k }: { key: SortKey }) =>
    sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅';

  if (loading) return <div className="text-muted">Loading run history…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Run History</h1>
        <p>{runs.length} total runs recorded in the Signal Registry.</p>
      </div>

      {error && <div className="warning-banner" style={{ marginBottom: 16 }}>⚠ {error}</div>}

      {runs.length === 0 ? (
        <div className="card text-muted" style={{ textAlign: 'center', padding: 40 }}>
          No runs yet. Start an analysis from the New Analysis page.
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Run ID</th>
                <th>PRD / Ticket</th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('mode')}
                >
                  Mode <SortIcon key="mode" />
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('risk_score')}
                >
                  Risk <SortIcon key="risk_score" />
                </th>
                <th>Blast Radius</th>
                <th>Migration</th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('test_result')}
                >
                  Tests <SortIcon key="test_result" />
                </th>
                <th
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => handleSort('timestamp')}
                >
                  Timestamp <SortIcon key="timestamp" />
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((run, i) => (
                <tr key={run.id || i}>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {run.run_id ? run.run_id.slice(0, 8) + '…' : run.id?.slice(0, 10)}
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>{run.prd_id || run.feature_ticket_id || '—'}</div>
                    {run.target_repo_id && (
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{run.target_repo_id}</div>
                    )}
                  </td>
                  <td>
                    {run.mode === 'advanced'
                      ? <span className="badge badge-yellow" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>⚠ Advanced</span>
                      : <span className="badge badge-blue">Library</span>}
                  </td>
                  <td>
                    <span className={`badge badge-${(run.risk_band || 'low').toLowerCase()}`}>
                      {run.risk_score} · {run.risk_band}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {run.blast_radius_files?.length
                      ? `${run.blast_radius_files.length} file${run.blast_radius_files.length !== 1 ? 's' : ''}`
                      : '—'}
                  </td>
                  <td>
                    {run.migration_status === 'applied' && <span className="badge badge-low">applied</span>}
                    {run.migration_status === 'pending' && <span className="badge badge-medium">pending</span>}
                    {run.migration_status === 'failed'  && <span className="badge badge-high">failed</span>}
                    {run.migration_status === 'none'    && <span className="badge badge-muted">none</span>}
                    {!run.migration_status              && <span className="text-muted">—</span>}
                  </td>
                  <td>
                    {run.test_result === 'pass'  && <span className="badge badge-low">pass</span>}
                    {run.test_result === 'fail'  && <span className="badge badge-high">fail</span>}
                    {run.test_result === 'flaky' && <span className="badge badge-medium">flaky</span>}
                    {run.test_result === 'pending' && <span className="badge badge-muted">pending</span>}
                    {(!run.test_result || run.test_result === '') && <span className="text-muted">—</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {run.timestamp ? new Date(run.timestamp).toLocaleString() : '—'}
                  </td>
                  <td>
                    {run.run_id && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onOpenRun(run.run_id!)}
                      >
                        View →
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 20 }}>
        <span><span className="badge badge-blue" style={{ marginRight: 4 }}>Library</span>Used the PRD Library path (demo-safe)</span>
        <span><span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', marginRight: 4 }}>⚠ Advanced</span>Custom upload (accuracy not guaranteed)</span>
      </div>
    </div>
  );
}

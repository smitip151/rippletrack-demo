import { useState } from 'react';
import './index.css';
import NewAnalysisPage from './pages/NewAnalysisPage';
import DashboardPage from './pages/DashboardPage';
import RunHistoryPage from './pages/RunHistoryPage';

type Page = 'analyze' | 'history' | { dashboard: string };

export default function App() {
  const [page, setPage] = useState<Page>('analyze');

  const goToDashboard = (runId: string) => setPage({ dashboard: runId });
  const goToAnalyze = () => setPage('analyze');
  const goToHistory = () => setPage('history');

  const activePage =
    page === 'analyze' ? 'analyze'
    : page === 'history' ? 'history'
    : 'dashboard';

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="navbar-brand">
          <span>◈</span> RippleTrack
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400, marginLeft: 4 }}>
            Tifosi CodeWorks
          </span>
        </div>
        <div className="navbar-links">
          <button
            className={`nav-link${activePage === 'analyze' ? ' active' : ''}`}
            onClick={goToAnalyze}
          >
            New Analysis
          </button>
          <button
            className={`nav-link${activePage === 'history' ? ' active' : ''}`}
            onClick={goToHistory}
          >
            Run History
          </button>
          {activePage === 'dashboard' && (
            <button className="nav-link active">
              Dashboard
            </button>
          )}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
          IBM Bob 2.0 Hackathon
        </div>
      </nav>

      <main className="main-content">
        {page === 'analyze' && (
          <NewAnalysisPage onRunStarted={goToDashboard} />
        )}
        {page === 'history' && (
          <RunHistoryPage onOpenRun={goToDashboard} />
        )}
        {typeof page === 'object' && 'dashboard' in page && (
          <DashboardPage runId={page.dashboard} onBack={goToAnalyze} />
        )}
      </main>
    </div>
  );
}

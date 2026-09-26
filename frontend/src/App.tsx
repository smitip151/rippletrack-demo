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
        {/* ── Brand block — clickable, navigates home ── */}
        <button
          className="navbar-brand"
          onClick={goToAnalyze}
          aria-label="Go to home — RippleTrack by Tifosi CodeWorks"
        >
          {/*
            Logo slot: replace the div below with:
              <img src="/logo.png" alt="Tifosi CodeWorks logo" />
            The slot is 34×34 px with a red background and ◈ placeholder.
          */}
          <div className="navbar-logo-slot" aria-hidden="true" />

          <div className="navbar-brand-text">
            <span className="navbar-brand-product">RippleTrack</span>
            <span className="navbar-brand-team">Tifosi CodeWorks</span>
          </div>
        </button>

        {/* ── Nav links ── */}
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

        {/* ── Right meta label ── */}
        <div className="navbar-meta">
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

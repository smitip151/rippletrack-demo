import { useState } from 'react';
import './index.css';
import rippleTrackLogo from './assets/RippleTrack_Primary_Logo.png';
import NewAnalysisPage from './pages/NewAnalysisPage';
import DashboardPage from './pages/DashboardPage';
import RunHistoryPage from './pages/RunHistoryPage';
import HomePage from './pages/HomePage';

type Page = 'home' | 'analyze' | 'history' | { dashboard: string };

export default function App() {
  const [page, setPage] = useState<Page>('home');

  const goToDashboard = (runId: string) => setPage({ dashboard: runId });
  const goToAnalyze = () => setPage('analyze');
  const goToHistory = () => setPage('history');
  const goToHome = () => setPage('home');

  const activePage =
    page === 'home' ? 'home'
    : page === 'analyze' ? 'analyze'
    : page === 'history' ? 'history'
    : 'dashboard';

  return (
    <div className="layout">
      <nav className="navbar">
        {/* ── Brand block — clickable, navigates home ── */}
        <button
          className="navbar-brand"
          onClick={goToHome}
          aria-label="Go to home — RippleTrack by Tifosi CodeWorks"
        >
          {/*
            Logo slot: replace the div below with:
              <img src="/logo.png" alt="Tifosi CodeWorks logo" />
            The slot is 34×34 px with a red background and ◈ placeholder.
          */}
          <div className="navbar-logo-slot" aria-hidden="true">
            <img src={rippleTrackLogo} alt="RippleTrack logo" />
          </div>

          <div className="navbar-brand-text">
            <span className="navbar-brand-product">RippleTrack</span>
            <span className="navbar-brand-team">Tifosi CodeWorks</span>
          </div>
        </button>

        {/* ── Nav links ── */}
        <div className="navbar-links">
          <button
            className={`nav-link${activePage === 'home' ? ' active' : ''}`}
            onClick={goToHome}
            aria-label="Home"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{display:'block'}}>
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
              <polyline points="9 21 9 12 15 12 15 21"/>
            </svg>
          </button>
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

      <main className={page === 'home' ? '' : 'main-content'}>
        {page === 'home' && (
          <HomePage onLaunchDemo={goToAnalyze} />
        )}
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

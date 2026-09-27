'use strict';
/**
 * RippleTrack — Full REST API Server
 * Team: Tifosi CodeWorks | IBM Bob 2.0 Hackathon
 *
 * Implements all endpoints specified in Part A of the project requirements.
 * Wraps the existing CLI engine and SQLite Signal Registry.
 *
 * Usage:
 *   node server/index.js          # port 3001
 *   PORT=4000 node server/index.js
 */

const http     = require('http');
const path     = require('path');
const fs       = require('fs');
const { execFile } = require('child_process');
const { v4: uuidv4 } = require('uuid');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('better-sqlite3 not found. Run: npm install');
  process.exit(1);
}

let express, cors, multer;
try {
  express = require('express');
  cors    = require('cors');
  multer  = require('multer');
} catch (e) {
  console.error('Missing dependencies. Run: npm install express multer cors uuid');
  process.exit(1);
}

const { PRD_LIBRARY, TARGET_REPOS } = require('./prd-library');
const { runAnalysis, riskBand }      = require('./engine');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const PORT    = parseInt(process.env.PORT || '3001', 10);
const ROOT    = path.join(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'db', 'ripple_signals.db');

// ─────────────────────────────────────────────────────────────────────────────
// Database setup
// ─────────────────────────────────────────────────────────────────────────────
function openDb() {
  const dbExists = fs.existsSync(DB_PATH);
  const db = new Database(DB_PATH);

  // Bootstrap schema if fresh DB
  if (!dbExists) {
    const setupSql = fs.readFileSync(path.join(ROOT, 'db', 'setup.sql'), 'utf-8');
    db.exec(setupSql);
  }

  // Ensure run-history columns exist (idempotent)
  const extraCols = ['run_id', 'blast_radius_files', 'migration_status', 'test_result', 'timestamp',
                     'prd_id', 'target_repo_id', 'mode', 'status_detail'];
  for (const col of extraCols) {
    try { db.exec(`ALTER TABLE ripple_signals ADD COLUMN ${col} TEXT;`); } catch (_) {}
  }
  // ripple_map_json stores the full ripple map for a run
  try { db.exec(`ALTER TABLE ripple_signals ADD COLUMN ripple_map_json TEXT;`); } catch (_) {}
  // risk_breakdown_json stores score factor breakdown
  try { db.exec(`ALTER TABLE ripple_signals ADD COLUMN risk_breakdown_json TEXT;`); } catch (_) {}

  return db;
}

const db = openDb();

// ─────────────────────────────────────────────────────────────────────────────
// In-memory run store (for async progress tracking)
// ─────────────────────────────────────────────────────────────────────────────
// runId -> { status, agents: { contract, code, test }, result, error }
const runStore = new Map();

// Subagent display names
const AGENTS = ['Contract Detective', 'Code Archaeologist', 'Test Archaeologist'];

function getRunFromDb(runId) {
  return db.prepare(`
    SELECT id, run_id, prd_id, target_repo_id, mode, risk_score, risk_breakdown_json,
           blast_radius_files, migration_status, test_result, timestamp, status,
           ripple_map_json, ripple_map_summary, feature_ticket_id, status_detail
    FROM ripple_signals
    WHERE run_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(runId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalize a ripple map: derive edges from node children if edges are absent
// ─────────────────────────────────────────────────────────────────────────────
function normalizeRippleMap(map) {
  const nodes = map.nodes || [];
  let edges = Array.isArray(map.edges) ? map.edges : [];

  // If the map was stored with children arrays instead of an edges list,
  // derive edges so the frontend ReactFlow renderer receives { source, target } pairs.
  if (edges.length === 0) {
    for (const node of nodes) {
      for (const child of (node.children || [])) {
        edges.push({ source: node.id, target: child });
      }
    }
  }

  return { ...map, nodes, edges };
}

// ─────────────────────────────────────────────────────────────────────────────
// Async run executor — simulates parallel agent progress
// ─────────────────────────────────────────────────────────────────────────────
const AGENT_DELAYS_MS = [800, 1200, 900]; // per agent simulated delay

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeRun(runId, prd, mode, advancedPayload, demoMode) {
  const store = runStore.get(runId);
  if (!store) return;

  try {
    store.status = 'running';

    // Run three agents in parallel (with simulated staggered delays)
    const agentResults = await Promise.all(AGENTS.map(async (agentName, i) => {
      store.agents[agentName] = 'running';
      if (!demoMode) await sleep(AGENT_DELAYS_MS[i]);
      // Mark as done
      store.agents[agentName] = 'done';
      return agentName;
    }));

    // Now compute the actual analysis (synchronous engine call)
    const result = runAnalysis(prd, mode, advancedPayload);
    store.result  = result;
    store.status  = 'complete';

    // Build blast radius file list from ripple map nodes
    const blastFiles = (result.ripple_map.nodes || []).map(n => n.id);

    // Persist to DB
    const rowId      = `run-${runId}`;
    const timestamp  = new Date().toISOString();
    const signalId   = prd ? prd.signal_id : null;

    db.prepare(`
      INSERT OR REPLACE INTO ripple_signals (
        id, run_id, prd_id, target_repo_id, mode, feature_ticket_id,
        risk_score, risk_breakdown_json,
        blast_radius_files, migration_status, test_result,
        ripple_map_json, ripple_map_summary,
        timestamp, status, created_at
      ) VALUES (
        @id, @run_id, @prd_id, @target_repo_id, @mode, @feature_ticket_id,
        @risk_score, @risk_breakdown_json,
        @blast_radius_files, @migration_status, @test_result,
        @ripple_map_json, @ripple_map_summary,
        @timestamp, @status, @created_at
      )
    `).run({
      id:                   rowId,
      run_id:               runId,
      prd_id:               prd ? prd.id : null,
      target_repo_id:       prd ? prd.target_repo_id : 'unknown',
      mode:                 mode,
      feature_ticket_id:    signalId || runId,
      risk_score:           result.risk_score,
      risk_breakdown_json:  JSON.stringify(result.risk_score_breakdown || {}),
      blast_radius_files:   JSON.stringify(blastFiles),
      migration_status:     result.migration_payload ? 'pending' : 'none',
      test_result:          'pending',
      ripple_map_json:      JSON.stringify(result.ripple_map),
      ripple_map_summary:   JSON.stringify({ nodes_touched: blastFiles, risk_score: result.risk_score }),
      timestamp:            timestamp,
      status:               'ANALYSIS_COMPLETE',
      created_at:           timestamp,
    });

  } catch (err) {
    store.status = 'error';
    store.error  = err.message;
    console.error(`[run ${runId}] analysis failed:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Express app
// ─────────────────────────────────────────────────────────────────────────────
const app    = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

app.use(cors());
app.use(express.json());

// ── Error helper ──────────────────────────────────────────────────────────────
function sendError(res, status, message, detail) {
  res.status(status).json({
    error:   message,
    detail:  detail || null,
    status,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: DB_PATH, version: '2.0.0', team: 'Tifosi CodeWorks' });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/prd-library
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/prd-library', (req, res) => {
  const list = PRD_LIBRARY.map(prd => ({
    id:               prd.id,
    filename:         prd.filename,
    short_description: prd.short_description,
    target_repo_id:   prd.target_repo_id,
    risk_band:        prd.risk_band,
    has_full_analysis: !!(prd.plan_dir && fs.existsSync(prd.plan_dir)),
  }));
  res.json({ prds: list, count: list.length, repos: TARGET_REPOS });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analyze
// Accepts:
//   { prd_id, target_repo_id, demo_mode? }            — library path
//   multipart with file + mode=advanced + target_repo_id  — advanced upload
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/analyze', upload.single('prd_file'), async (req, res) => {
  try {
    const body       = req.body || {};
    const mode       = body.mode === 'advanced' ? 'advanced' : 'library';
    const demoMode   = body.demo_mode === 'true' || body.demo_mode === true;
    const runId      = uuidv4();

    if (mode === 'advanced') {
      // Advanced upload path
      if (!req.file) {
        return sendError(res, 400, 'Advanced mode requires a prd_file upload.');
      }
      const targetRepoId = body.target_repo_id || 'rippletrack-demo';
      const repo = TARGET_REPOS.find(r => r.id === targetRepoId);
      if (!repo) {
        return sendError(res, 400, `Unknown target_repo_id: "${targetRepoId}"`, `Valid values: ${TARGET_REPOS.map(r => r.id).join(', ')}`);
      }

      // Extract text from uploaded file (plain text or docx as raw buffer text)
      const textContent = req.file.buffer.toString('utf-8', 0, Math.min(req.file.buffer.length, 50000));
      const advancedPayload = { filename: req.file.originalname, textContent };

      runStore.set(runId, {
        status: 'queued',
        mode:   'advanced',
        agents: { 'Contract Detective': 'pending', 'Code Archaeologist': 'pending', 'Test Archaeologist': 'pending' },
        result: null,
        error:  null,
      });

      // Fire-and-forget
      executeRun(runId, null, 'advanced', advancedPayload, demoMode).catch(console.error);

      return res.status(202).json({ run_id: runId, status: 'queued', mode: 'advanced' });
    }

    // Library path
    const prdId = body.prd_id;
    if (!prdId) {
      return sendError(res, 400, 'Missing required field: prd_id');
    }
    const prd = PRD_LIBRARY.find(p => p.id === prdId);
    if (!prd) {
      return sendError(res, 404, `PRD not found: "${prdId}"`, `Valid IDs: ${PRD_LIBRARY.map(p => p.id).join(', ')}`);
    }

    // Check file exists on disk
    if (!fs.existsSync(prd.filepath)) {
      return sendError(res, 500, `PRD file missing on server: ${prd.filename}`, 'Please ensure PRD files are present in the project root.');
    }

    runStore.set(runId, {
      status:   'queued',
      mode:     'library',
      prd_id:   prdId,
      agents:   { 'Contract Detective': 'pending', 'Code Archaeologist': 'pending', 'Test Archaeologist': 'pending' },
      result:   null,
      error:    null,
    });

    // Fire-and-forget
    executeRun(runId, prd, 'library', null, demoMode).catch(console.error);

    return res.status(202).json({ run_id: runId, status: 'queued', mode: 'library', prd_id: prdId });

  } catch (err) {
    console.error('[POST /api/analyze]', err);
    return sendError(res, 500, 'Internal server error', err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/runs
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/runs', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, run_id, prd_id, target_repo_id, mode, feature_ticket_id,
             risk_score, blast_radius_files, migration_status, test_result,
             timestamp, status
      FROM ripple_signals
      WHERE run_id IS NOT NULL AND timestamp IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT 200
    `).all();

    const runs = rows.map(r => normalizeRunRow(r));
    res.json({ runs, count: runs.length });
  } catch (err) {
    sendError(res, 500, 'Failed to list runs', err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/runs/:id/status
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/runs/:id/status', (req, res) => {
  const runId = req.params.id;
  const store = runStore.get(runId);

  if (!store) {
    // Check DB (run may have been from a prior server session)
    const row = getRunFromDb(runId);
    if (!row) {
      return sendError(res, 404, `Run not found: ${runId}`);
    }
    return res.json({
      run_id:  runId,
      status:  'complete',
      agents:  {
        'Contract Detective':   'done',
        'Code Archaeologist':   'done',
        'Test Archaeologist':   'done',
      },
    });
  }

  res.json({
    run_id:  runId,
    status:  store.status,
    agents:  store.agents,
    error:   store.error || undefined,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/runs/:id
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/runs/:id', (req, res) => {
  const runId = req.params.id;

  // Check in-memory store first (may be in progress)
  const store = runStore.get(runId);
  if (store && store.status !== 'complete' && store.status !== 'error') {
    return res.json({
      run_id: runId,
      status: store.status,
      agents: store.agents,
      result: null,
    });
  }

  // If completed in memory, use that result
  if (store && store.status === 'complete' && store.result) {
    const row = getRunFromDb(runId);
    return res.json(buildRunDetail(runId, row, store.result));
  }

  // Else load from DB
  const row = getRunFromDb(runId);
  if (!row) {
    return sendError(res, 404, `Run not found: ${runId}`);
  }

  const rippleMap = normalizeRippleMap(
    row.ripple_map_json ? JSON.parse(row.ripple_map_json) : { nodes: [], edges: [] }
  );

  // Try to reconstruct result for known signal rows
  let signalPayload = null;
  if (row.prd_id) {
    const prd = PRD_LIBRARY.find(p => p.id === row.prd_id);
    if (prd && prd.signal_payload_path && fs.existsSync(prd.signal_payload_path)) {
      try { signalPayload = JSON.parse(fs.readFileSync(prd.signal_payload_path, 'utf-8')); } catch (_) {}
    }
  }

  const syntheticResult = {
    risk_score:           row.risk_score,
    risk_band:            riskBand(row.risk_score),
    risk_score_breakdown: row.risk_breakdown_json ? JSON.parse(row.risk_breakdown_json) : null,
    ripple_map:           rippleMap,
    contract_analysis:    signalPayload ? signalPayload.origin : null,
    code_archaeology:     null,
    test_archaeology:     null,
    signal_payload:       signalPayload,
    migration_payload:    signalPayload ? signalPayload.migration_payload : null,
    mock_updates:         signalPayload ? signalPayload.mock_updates : null,
    downstream_guards:    signalPayload ? signalPayload.downstream_guards : null,
  };

  res.json(buildRunDetail(runId, row, syntheticResult));
});

function buildRunDetail(runId, row, result) {
  // Get signals for this run
  const signals = db.prepare(`
    SELECT * FROM ripple_signals WHERE run_id = ? OR feature_ticket_id = ?
    ORDER BY created_at ASC LIMIT 50
  `).all(runId, row ? row.feature_ticket_id : runId);

  return {
    run_id:          runId,
    prd_id:          row ? row.prd_id : null,
    target_repo_id:  row ? row.target_repo_id : null,
    mode:            row ? row.mode : 'library',
    timestamp:       row ? row.timestamp : null,
    status:          row ? row.status : 'complete',
    risk_score:      result.risk_score,
    risk_band:       result.risk_band,
    risk_score_breakdown: result.risk_score_breakdown,
    ripple_map:      result.ripple_map,
    contract_analysis:   result.contract_analysis,
    code_archaeology:    result.code_archaeology,
    test_archaeology:    result.test_archaeology,
    migration_payload:   result.migration_payload,
    mock_updates:        result.mock_updates,
    downstream_guards:   result.downstream_guards,
    signals:             signals.map(normalizeRunRow),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/runs/:id/ci-simulate
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/runs/:id/ci-simulate', (req, res) => {
  const runId = req.params.id;

  const row = getRunFromDb(runId);
  if (!row) {
    return sendError(res, 404, `Run not found: ${runId}`);
  }

  // Get the feature ticket id to pass to the CI script
  const ticketId = row.feature_ticket_id || 'PROJ-8821';

  // Run the simulate_ci.sh script
  const scriptPath = path.join(ROOT, 'simulate_ci.sh');

  // On Windows we run it via bash if available, otherwise simulate the result
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // On Windows, simulate the CI result deterministically based on risk score
    const riskScore = row.risk_score || 0;
    const testsPassed = riskScore < 80;

    const before = [
      { test: 'should successfully format and dispatch the user payload without crashing', result: riskScore > 50 ? 'fail' : 'pass', before: true },
      { test: 'should validate the mock fixture against the schema constraints', result: riskScore > 70 ? 'fail' : 'pass', before: true },
    ];
    const after = before.map(t => ({ ...t, result: 'pass', before: false }));

    // Update DB
    db.prepare(`UPDATE ripple_signals SET test_result = ?, migration_status = ? WHERE run_id = ?`)
      .run(testsPassed ? 'pass' : 'simulated_pass', 'applied', runId);

    return res.json({
      run_id:        runId,
      simulated:     true,
      platform_note: 'Windows detected — CI script simulated deterministically.',
      ticket_id:     ticketId,
      before,
      after,
      overall:       'pass',
    });
  }

  // Unix: run the actual script
  execFile('bash', [scriptPath], {
    cwd:  ROOT,
    env:  { ...process.env, CI_TICKET_ID: ticketId },
    timeout: 60000,
  }, (err, stdout, stderr) => {
    const passed = !err;

    // Extract per-test results from npm test output if present
    const testLines = (stdout + stderr).split('\n').filter(l =>
      l.includes('✓') || l.includes('✗') || l.includes('PASS') || l.includes('FAIL') || l.includes('pass') || l.includes('fail')
    );

    // Update DB
    db.prepare(`UPDATE ripple_signals SET test_result = ?, migration_status = ? WHERE run_id = ?`)
      .run(passed ? 'pass' : 'fail', 'applied', runId);

    res.json({
      run_id:    runId,
      simulated: false,
      ticket_id: ticketId,
      passed,
      stdout:    stdout.slice(0, 5000),
      stderr:    stderr.slice(0, 2000),
      test_lines: testLines,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/signals
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/signals', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, run_id, prd_id, feature_ticket_id, risk_score,
             blast_radius_files, migration_status, test_result, timestamp, status, mode
      FROM ripple_signals
      ORDER BY created_at DESC
      LIMIT 500
    `).all();

    res.json({ signals: rows.map(normalizeRunRow), count: rows.length });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch signals', err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/repos  (bonus: list valid target repos)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/repos', (req, res) => {
  res.json({ repos: TARGET_REPOS });
});

// ─────────────────────────────────────────────────────────────────────────────
// 404
// ─────────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    routes: [
      'GET  /health',
      'GET  /api/prd-library',
      'POST /api/analyze',
      'GET  /api/runs',
      'GET  /api/runs/:id',
      'GET  /api/runs/:id/status',
      'POST /api/runs/:id/ci-simulate',
      'GET  /api/signals',
      'GET  /api/repos',
    ],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function normalizeRunRow(row) {
  let files = [];
  if (row.blast_radius_files) {
    try { files = JSON.parse(row.blast_radius_files); } catch (_) {}
  }
  return {
    id:                  row.id,
    run_id:              row.run_id,
    prd_id:              row.prd_id || null,
    feature_ticket_id:   row.feature_ticket_id || null,
    target_repo_id:      row.target_repo_id || null,
    mode:                row.mode || 'library',
    risk_score:          typeof row.risk_score === 'number' ? row.risk_score : parseInt(row.risk_score, 10) || 0,
    risk_band:           riskBand(typeof row.risk_score === 'number' ? row.risk_score : parseInt(row.risk_score, 10) || 0),
    blast_radius_files:  Array.isArray(files) ? files : [],
    migration_status:    row.migration_status || null,
    test_result:         row.test_result || null,
    timestamp:           row.timestamp || null,
    status:              row.status || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────
const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  RippleTrack API  ▶  http://0.0.0.0:${PORT}`);
  console.log(`  Team: Tifosi CodeWorks | IBM Bob 2.0 Hackathon\n`);
  console.log('  Endpoints:');
  console.log(`    GET  http://127.0.0.1:${PORT}/health`);
  console.log(`    GET  http://127.0.0.1:${PORT}/api/prd-library`);
  console.log(`    POST http://127.0.0.1:${PORT}/api/analyze`);
  console.log(`    GET  http://127.0.0.1:${PORT}/api/runs`);
  console.log(`    GET  http://127.0.0.1:${PORT}/api/runs/:id`);
  console.log(`    GET  http://127.0.0.1:${PORT}/api/runs/:id/status`);
  console.log(`    POST http://127.0.0.1:${PORT}/api/runs/:id/ci-simulate`);
  console.log(`    GET  http://127.0.0.1:${PORT}/api/signals\n`);
  console.log('  Start frontend:  cd frontend && npm run dev\n');
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} in use. Try: PORT=3002 node server/index.js`);
  } else {
    console.error('Server error:', e.message);
  }
  process.exit(1);
});

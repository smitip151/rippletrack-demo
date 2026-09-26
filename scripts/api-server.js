#!/usr/bin/env node
/**
 * RippleTrack — Local JSON API Server
 * Team: Tifosi CodeWorks | IBM Bob 2.0 Hackathon
 *
 * Serves ripple_signals CI run history as JSON.
 * No external dependencies — uses Node stdlib http + better-sqlite3
 * (already a project dependency).
 *
 * Usage:
 *   node scripts/api-server.js           # default port 3001
 *   PORT=4000 node scripts/api-server.js
 *
 * Endpoints:
 *   GET /api/runs          – all CI run rows, ordered by timestamp ASC
 *   GET /api/runs/latest   – the single most recent run row
 *   GET /health            – liveness check
 */

'use strict';

const http = require('http');
const path = require('path');

// better-sqlite3 is already in project dependencies
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('better-sqlite3 not found. Run: npm install');
  process.exit(1);
}

const PORT    = parseInt(process.env.PORT || '3001', 10);
const DB_PATH = path.join(__dirname, '..', 'db', 'ripple_signals.db');

// ─────────────────────────────────────────────────────────────────────────────
// Open DB (read-only so the API never mutates state)
// ─────────────────────────────────────────────────────────────────────────────
let db;
try {
  db = new Database(DB_PATH, { readonly: true });
} catch (e) {
  console.error(`Cannot open database at ${DB_PATH}: ${e.message}`);
  console.error('Run the seed script first: node scripts/seed-history.js');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Query helpers
// ─────────────────────────────────────────────────────────────────────────────
function getAllRuns() {
  const rows = db.prepare(`
    SELECT
      id,
      run_id,
      feature_ticket_id,
      risk_score,
      blast_radius_files,
      migration_status,
      test_result,
      timestamp
    FROM ripple_signals
    WHERE run_id IS NOT NULL
      AND timestamp IS NOT NULL
    ORDER BY timestamp ASC
  `).all();

  return rows.map(normalizeRow);
}

function getLatestRun() {
  const row = db.prepare(`
    SELECT
      id,
      run_id,
      feature_ticket_id,
      risk_score,
      blast_radius_files,
      migration_status,
      test_result,
      timestamp
    FROM ripple_signals
    WHERE run_id IS NOT NULL
      AND timestamp IS NOT NULL
    ORDER BY timestamp DESC
    LIMIT 1
  `).get();

  return row ? normalizeRow(row) : null;
}

/**
 * Ensure blast_radius_files is always parsed to an array,
 * and risk_score is always a number.
 */
function normalizeRow(row) {
  let files = [];
  if (row.blast_radius_files) {
    try {
      files = JSON.parse(row.blast_radius_files);
    } catch (_) {
      files = [];
    }
  }
  return {
    id:                   row.id,
    run_id:               row.run_id,
    feature_ticket_id:    row.feature_ticket_id || null,
    risk_score:           typeof row.risk_score === 'number' ? row.risk_score : parseInt(row.risk_score, 10) || 0,
    blast_radius_files:   Array.isArray(files) ? files : [],
    migration_status:     row.migration_status || null,
    test_result:          row.test_result || null,
    timestamp:            row.timestamp,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP server
// ─────────────────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS — allow dashboard.html opened from file:// to hit localhost
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  const url = req.url.split('?')[0]; // ignore query string

  if (url === '/health') {
    sendJson(res, 200, { status: 'ok', db: DB_PATH });
    return;
  }

  if (url === '/api/runs') {
    try {
      const runs = getAllRuns();
      sendJson(res, 200, { runs, count: runs.length });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  if (url === '/api/runs/latest') {
    try {
      const run = getLatestRun();
      if (!run) {
        sendJson(res, 404, { error: 'No runs found. Run the seed script first.' });
      } else {
        sendJson(res, 200, run);
      }
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found', routes: ['/api/runs', '/api/runs/latest', '/health'] });
});

function sendJson(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type':  'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\nRippleTrack API server running at http://127.0.0.1:${PORT}`);
  console.log(`  GET http://127.0.0.1:${PORT}/api/runs`);
  console.log(`  GET http://127.0.0.1:${PORT}/api/runs/latest`);
  console.log(`  GET http://127.0.0.1:${PORT}/health`);
  console.log(`\nOpen dashboard.html in your browser, then Ctrl+C to stop.\n`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try: PORT=3002 node scripts/api-server.js`);
  } else {
    console.error('Server error:', e.message);
  }
  process.exit(1);
});

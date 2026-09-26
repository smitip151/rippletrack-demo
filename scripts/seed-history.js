#!/usr/bin/env node
/**
 * RippleTrack — Historical Data Seed Script
 * Team: Tifosi CodeWorks | IBM Bob 2.0 Hackathon
 *
 * Inserts 14 synthetic CI run rows into ripple_signals that tell a believable
 * before→after RippleTrack story. Idempotent: skips rows whose run_id already
 * exists so it is safe to run multiple times.
 *
 * Usage:
 *   node scripts/seed-history.js
 */

'use strict';

const path = require('path');
const fs   = require('fs');

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('better-sqlite3 not found. Run: npm install');
  process.exit(1);
}

const DB_PATH  = path.join(__dirname, '..', 'db', 'ripple_signals.db');
const SETUP_SQL = path.join(__dirname, '..', 'db', 'setup.sql');

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap DB if it doesn't exist yet
// ─────────────────────────────────────────────────────────────────────────────
const dbExists = fs.existsSync(DB_PATH);
const db = new Database(DB_PATH);

if (!dbExists) {
  const sql = fs.readFileSync(SETUP_SQL, 'utf8');
  db.exec(sql);
  console.log('Bootstrapped Signal Registry from db/setup.sql');
}

// ─────────────────────────────────────────────────────────────────────────────
// Ensure all run-history columns exist (idempotent ALTER TABLE)
// ─────────────────────────────────────────────────────────────────────────────
const newCols = ['run_id', 'blast_radius_files', 'migration_status', 'test_result', 'timestamp'];
for (const col of newCols) {
  try {
    db.exec(`ALTER TABLE ripple_signals ADD COLUMN ${col} TEXT;`);
  } catch (_) {
    // column already exists — fine
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Synthetic seed data
//
// Timestamps spread across the last ~36 hours, strictly increasing.
// Base time: 36 hours ago, each row ~2.5 h apart → 14 rows ≈ 35 h span.
// ─────────────────────────────────────────────────────────────────────────────
const now      = Date.now();
const BASE     = now - 36 * 60 * 60 * 1000; // 36 h ago
const STEP_MS  = 2.5 * 60 * 60 * 1000;      // 2 h 30 min apart

function ts(i) {
  return new Date(BASE + i * STEP_MS).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// File lists for blast_radius tests
const NO_FILES     = [];
const SMALL_FILES  = ['src/models/UserProfile.ts', 'src/api/router.ts'];
const LARGE_FILES  = [
  'src/models/UserProfile.ts',
  'src/api/router.ts',
  'src/analytics/eventTracker.ts',
  'src/services/notificationService.ts',
  'src/middleware/authGuard.ts',
  'tests/mocks/userFixture.json',
];

const rows = [
  // ── PRE-RIPPLETRACK (runs 0-3): high risk, failures ─────────────────────
  {
    run_id:            'seed-run-001',
    risk_score:        92,
    blast_radius_files: LARGE_FILES,
    migration_status:  'failed',
    test_result:       'fail',
    idx: 0,
  },
  {
    run_id:            'seed-run-002',
    risk_score:        85,
    blast_radius_files: LARGE_FILES,
    migration_status:  'failed',
    test_result:       'fail',
    idx: 1,
  },
  {
    run_id:            'seed-run-003',
    risk_score:        78,
    blast_radius_files: SMALL_FILES,
    migration_status:  'pending',
    test_result:       'fail',
    idx: 2,
  },
  {
    run_id:            'seed-run-004',
    risk_score:        61,   // exact band edge: 61 = high
    blast_radius_files: LARGE_FILES,
    migration_status:  'pending',
    test_result:       'flaky',   // flaky edge case
    idx: 3,
  },

  // ── TRANSITION RUN (run 4): RippleTrack introduced ───────────────────────
  {
    run_id:            'seed-run-005',
    risk_score:        60,   // exact band edge: 60 = medium
    blast_radius_files: SMALL_FILES,
    migration_status:  'applied',  // RippleTrack kicks in
    test_result:       'pass',     // flips to pass
    idx: 4,
  },

  // ── POST-RIPPLETRACK (runs 5-13): steady low risk ────────────────────────
  {
    run_id:            'seed-run-006',
    risk_score:        31,   // exact band edge: 31 = medium-low
    blast_radius_files: SMALL_FILES,
    migration_status:  'applied',
    test_result:       'pass',
    idx: 5,
  },
  {
    run_id:            'seed-run-007',
    risk_score:        30,   // exact band edge: 30 = low
    blast_radius_files: NO_FILES,  // empty blast radius
    migration_status:  'applied',
    test_result:       'pass',
    idx: 6,
  },
  {
    run_id:            'seed-run-008',
    risk_score:        24,
    blast_radius_files: SMALL_FILES,
    migration_status:  'applied',
    test_result:       'pass',
    idx: 7,
  },
  {
    run_id:            'seed-run-009',
    risk_score:        18,
    blast_radius_files: NO_FILES,  // another empty blast radius
    migration_status:  'rolled_back',  // rolled_back edge case
    test_result:       'pass',
    idx: 8,
  },
  {
    run_id:            'seed-run-010',
    risk_score:        20,
    blast_radius_files: SMALL_FILES,
    migration_status:  'applied',
    test_result:       'pass',
    idx: 9,
  },
  {
    run_id:            'seed-run-011',
    risk_score:        12,
    blast_radius_files: LARGE_FILES,  // large file list, but low risk
    migration_status:  'applied',
    test_result:       'pass',
    idx: 10,
  },
  {
    run_id:            'seed-run-012',
    risk_score:        15,
    blast_radius_files: SMALL_FILES,
    migration_status:  'applied',
    test_result:       'pass',
    idx: 11,
  },
  {
    run_id:            'seed-run-013',
    risk_score:        8,
    blast_radius_files: NO_FILES,
    migration_status:  'applied',
    test_result:       'pass',
    idx: 12,
  },
  {
    run_id:            'seed-run-014',
    risk_score:        10,
    blast_radius_files: SMALL_FILES,
    migration_status:  'applied',
    test_result:       'pass',
    idx: 13,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Insert with IGNORE on existing run_id (idempotent)
// ─────────────────────────────────────────────────────────────────────────────
const stmt = db.prepare(`
  INSERT OR IGNORE INTO ripple_signals (
    id,
    feature_ticket_id,
    run_id,
    risk_score,
    blast_radius_files,
    migration_status,
    test_result,
    timestamp,
    ripple_map_summary,
    status,
    created_at
  ) VALUES (
    @id,
    @feature_ticket_id,
    @run_id,
    @risk_score,
    @blast_radius_files,
    @migration_status,
    @test_result,
    @timestamp,
    @ripple_map_summary,
    @status,
    @created_at
  )
`);

const insertAll = db.transaction((rows) => {
  let inserted = 0;
  let skipped  = 0;
  for (const row of rows) {
    const timestamp = ts(row.idx);
    const result = stmt.run({
      id:                   `seed-${row.run_id}`,
      feature_ticket_id:    'PROJ-8821',
      run_id:               row.run_id,
      risk_score:           row.risk_score,
      blast_radius_files:   JSON.stringify(row.blast_radius_files),
      migration_status:     row.migration_status,
      test_result:          row.test_result,
      timestamp:            timestamp,
      ripple_map_summary:   '{}',
      status:               'MOUNTED_IN_CI',
      created_at:           timestamp,
    });
    if (result.changes > 0) {
      inserted++;
      console.log(`  ✔ inserted ${row.run_id}  risk=${row.risk_score}  ${row.test_result}  ${row.migration_status}  ${timestamp}`);
    } else {
      skipped++;
      console.log(`  – skipped  ${row.run_id}  (already exists)`);
    }
  }
  return { inserted, skipped };
});

console.log('\nRippleTrack — seeding historical CI run data...\n');
const { inserted, skipped } = insertAll(rows);

const total = db.prepare(`SELECT COUNT(*) AS n FROM ripple_signals WHERE run_id IS NOT NULL`).get().n;
console.log(`\nDone. Inserted: ${inserted}, skipped: ${skipped}. Total CI run rows in DB: ${total}\n`);

db.close();

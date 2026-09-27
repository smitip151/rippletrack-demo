#!/usr/bin/env node
/**
 * RippleTrack — Production PostgreSQL Seed Script
 * Team: Tifosi CodeWorks | IBM Bob 2.0 Hackathon
 *
 * Inserts 14 synthetic CI run rows into the production PostgreSQL database.
 * Run locally with Render's DATABASE_URL.
 *
 * Usage:
 *   DATABASE_URL="postgresql://user:pass@host:port/db" node scripts/seed-production.js
 */

'use strict';

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load ripple map for seeded runs
const RIPPLE_MAP_PATH = path.join(__dirname, '..', 'plan', 'ripple_map.json');
let RIPPLE_MAP_JSON = '{}';
let RISK_BREAKDOWN_JSON = null;
try {
  const rippleMapData = JSON.parse(fs.readFileSync(RIPPLE_MAP_PATH, 'utf8'));
  RIPPLE_MAP_JSON = JSON.stringify(rippleMapData);
  if (rippleMapData.risk_score_breakdown) {
    RISK_BREAKDOWN_JSON = JSON.stringify(rippleMapData.risk_score_breakdown);
  }
} catch (_) {
  console.warn('plan/ripple_map.json not found — ripple map will be empty for seeded rows');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Usage: DATABASE_URL="postgresql://..." node scripts/seed-production.js');
  process.exit(1);
}

// File lists for blast_radius tests
const NO_FILES = [];
const SMALL_FILES = ['src/models/UserProfile.ts', 'src/api/router.ts'];
const LARGE_FILES = [
  'src/models/UserProfile.ts',
  'src/api/router.ts',
  'src/analytics/eventTracker.ts',
  'src/services/notificationService.ts',
  'src/middleware/authGuard.ts',
  'tests/mocks/userFixture.json',
];

// Synthetic seed data - timestamps spread across ~36 hours
const now = Date.now();
const BASE = now - 36 * 60 * 60 * 1000; // 36 hours ago
const STEP_MS = 2.5 * 60 * 60 * 1000;   // 2.5 hours apart

function ts(i) {
  return new Date(BASE + i * STEP_MS).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

const rows = [
  // PRE-RIPPLETRACK (runs 0-3): high risk, failures
  {
    run_id: 'seed-run-001',
    risk_score: 92,
    blast_radius_files: LARGE_FILES,
    migration_status: 'failed',
    test_result: 'fail',
    timestamp: ts(0),
    status: 'ANALYSIS_COMPLETE',
    feature_ticket_id: 'PROJ-8821',
    prd_id: 'PRD-001',
    target_repo_id: 'rippletrack-demo',
    mode: 'library',
  },
  {
    run_id: 'seed-run-002',
    risk_score: 88,
    blast_radius_files: LARGE_FILES,
    migration_status: 'failed',
    test_result: 'fail',
    timestamp: ts(1),
    status: 'ANALYSIS_COMPLETE',
    feature_ticket_id: 'PROJ-8821',
    prd_id: 'PRD-001',
    target_repo_id: 'rippletrack-demo',
    mode: 'library',
  },
  {
    run_id: 'seed-run-003',
    risk_score: 85,
    blast_radius_files: LARGE_FILES,
    migration_status: 'pending',
    test_result: 'fail',
    timestamp: ts(2),
    status: 'ANALYSIS_COMPLETE',
    feature_ticket_id: 'PROJ-8821',
    prd_id: 'PRD-001',
    target_repo_id: 'rippletrack-demo',
    mode: 'library',
  },
  {
    run_id: 'seed-run-004',
    risk_score: 82,
    blast_radius_files: LARGE_FILES,
    migration_status: 'pending',
    test_result: 'fail',
    timestamp: ts(3),
    status: 'ANALYSIS_COMPLETE',
    feature_ticket_id: 'PROJ-8821',
    prd_id: 'PRD-001',
    target_repo_id: 'rippletrack-demo',
    mode: 'library',
  },
  // TRANSITION (runs 4-6): risk dropping, first passes
  {
    run_id: 'seed-run-005',
    risk_score: 72,
    blast_radius_files: SMALL_FILES,
    migration_status: 'applied',
    test_result: 'pass',
    timestamp: ts(4),
    status: 'ANALYSIS_COMPLETE',
    feature_ticket_id: 'PROJ-8821',
    prd_id: 'PRD-001',
    target_repo_id: 'rippletrack-demo',
    mode: 'library',
  },
  {
    run_id: 'seed-run-006',
    risk_score: 65,
    blast_radius_files: SMALL_FILES,
    migration_status: 'applied',
    test_result: 'pass',
    timestamp: ts(5),
    status: 'ANALYSIS_COMPLETE',
    feature_ticket_id: 'PROJ-8821',
    prd_id: 'PRD-001',
    target_repo_id: 'rippletrack-demo',
    mode: 'library',
  },
  {
    run_id: 'seed-run-007',
    risk_score: 58,
    blast_radius_files: SMALL_FILES,
    migration_status: 'applied',
    test_result: 'pass',
    timestamp: ts(6),
    status: 'ANALYSIS_COMPLETE',
    feature_ticket_id: 'PROJ-8821',
    prd_id: 'PRD-001',
    target_repo_id: 'rippletrack-demo',
    mode: 'library',
  },
  // POST-RIPPLETRACK (runs 7-13): low risk, all passing
  {
    run_id: 'seed-run-008',
    risk_score: 42,
    blast_radius_files: SMALL_FILES,
    migration_status: 'applied',
    test_result: 'pass',
    timestamp: ts(7),
    status: 'ANALYSIS_COMPLETE',
    feature_ticket_id: 'PROJ-8821',
    prd_id: 'PRD-001',
    target_repo_id: 'rippletrack-demo',
    mode: 'library',
  },
  {
    run_id: 'seed-run-009',
    risk_score: 35,
    blast_radius_files: SMALL_FILES,
    migration_status: 'applied',
    test_result: 'pass',
    timestamp: ts(8),
    status: 'ANALYSIS_COMPLETE',
    feature_ticket_id: 'PROJ-8821',
    prd_id: 'PRD-001',
    target_repo_id: 'rippletrack-demo',
    mode: 'library',
  },
  {
    run_id: 'seed-run-010',
    risk_score: 28,
    blast_radius_files: NO_FILES,
    migration_status: 'applied',
    test_result: 'pass',
    timestamp: ts(9),
    status: 'ANALYSIS_COMPLETE',
    feature_ticket_id: 'PROJ-8821',
    prd_id: 'PRD-001',
    target_repo_id: 'rippletrack-demo',
    mode: 'library',
  },
  {
    run_id: 'seed-run-011',
    risk_score: 22,
    blast_radius_files: NO_FILES,
    migration_status: 'applied',
    test_result: 'pass',
    timestamp: ts(10),
    status: 'ANALYSIS_COMPLETE',
    feature_ticket_id: 'PROJ-8821',
    prd_id: 'PRD-001',
    target_repo_id: 'rippletrack-demo',
    mode: 'library',
  },
  {
    run_id: 'seed-run-012',
    risk_score: 18,
    blast_radius_files: NO_FILES,
    migration_status: 'applied',
    test_result: 'pass',
    timestamp: ts(11),
    status: 'ANALYSIS_COMPLETE',
    feature_ticket_id: 'PROJ-8821',
    prd_id: 'PRD-001',
    target_repo_id: 'rippletrack-demo',
    mode: 'library',
  },
  {
    run_id: 'seed-run-013',
    risk_score: 12,
    blast_radius_files: NO_FILES,
    migration_status: 'applied',
    test_result: 'pass',
    timestamp: ts(12),
    status: 'ANALYSIS_COMPLETE',
    feature_ticket_id: 'PROJ-8821',
    prd_id: 'PRD-001',
    target_repo_id: 'rippletrack-demo',
    mode: 'library',
  },
  {
    run_id: 'seed-run-014',
    risk_score: 8,
    blast_radius_files: NO_FILES,
    migration_status: 'applied',
    test_result: 'pass',
    timestamp: ts(13),
    status: 'ANALYSIS_COMPLETE',
    feature_ticket_id: 'PROJ-8821',
    prd_id: 'PRD-001',
    target_repo_id: 'rippletrack-demo',
    mode: 'library',
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding production PostgreSQL database...');
    
    let inserted = 0;
    let skipped = 0;

    for (const run of rows) {
      const rowId = `run-${run.run_id}`;
      
      // Check if already exists
      const existing = await client.query(
        'SELECT 1 FROM ripple_signals WHERE run_id = $1 LIMIT 1',
        [run.run_id]
      );
      
      if (existing.rows.length > 0) {
        console.log(`  ⏭  Skipping ${run.run_id} (already exists)`);
        skipped++;
        continue;
      }

      await client.query(
        `INSERT INTO ripple_signals (
          id, run_id, prd_id, target_repo_id, mode, feature_ticket_id,
          risk_score, risk_breakdown_json,
          blast_radius_files, migration_status, test_result,
          ripple_map_json, ripple_map_summary,
          timestamp, status, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (id) DO NOTHING`,
        [
          rowId,
          run.run_id,
          run.prd_id,
          run.target_repo_id,
          run.mode,
          run.feature_ticket_id,
          run.risk_score,
          RISK_BREAKDOWN_JSON || '{}',
          JSON.stringify(run.blast_radius_files),
          run.migration_status,
          run.test_result,
          RIPPLE_MAP_JSON,
          JSON.stringify({ nodes_touched: run.blast_radius_files, risk_score: run.risk_score }),
          run.timestamp,
          run.status,
          run.timestamp,
        ]
      );
      
      console.log(`  ✅ Inserted ${run.run_id} (risk: ${run.risk_score}, test: ${run.test_result})`);
      inserted++;
    }

    console.log(`\n🎉 Seeding complete: ${inserted} inserted, ${skipped} skipped`);
    
    // Verify
    const count = await client.query('SELECT COUNT(*) FROM ripple_signals WHERE run_id IS NOT NULL');
    console.log(`📊 Total CI run history rows: ${count.rows[0].count}`);
    
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
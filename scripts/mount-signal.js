#!/usr/bin/env node
/**
 * Signal Sync — CI-side mount step (Phase 3).
 * Reads a ripple_signals row for a ticket and mounts what it holds
 * onto disk before the test suite runs:
 *   1. mock_updates      -> merged into the target fixture file(s)
 *   2. downstream_guards -> written as full replacement file content
 *                           for the guarded consumer file(s)
 *   3. migration_payload -> logged (expand-phase only, per PRD 7.4;
 *                           apply against your real DB here if needed)
 *
 * Requires: npm i better-sqlite3
 * Usage:    node scripts/mount-signal.js <feature_ticket_id>
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const ticketId = process.argv[2];
if (!ticketId) {
  console.error('Usage: node mount-signal.js <feature_ticket_id>');
  process.exit(1);
}

const db = new Database(path.join(__dirname, '..', 'db', 'ripple_signals.db'));
const row = db
  .prepare(
    'SELECT * FROM ripple_signals WHERE feature_ticket_id = ? ORDER BY created_at DESC LIMIT 1'
  )
  .get(ticketId);

if (!row) {
  console.error(`✗ No ripple_signals row for ${ticketId}`);
  process.exit(1);
}

console.log(`✔ Found signal row ${row.id} — risk score ${row.risk_score}/100`);

// 1. Mount mock/fixture updates (merged into existing JSON, if any)
const mockUpdates = JSON.parse(row.mock_updates || '{}');
for (const [fixturePath, patch] of Object.entries(mockUpdates)) {
  const fullPath = path.join(__dirname, '..', fixturePath);
  const current = fs.existsSync(fullPath)
    ? JSON.parse(fs.readFileSync(fullPath, 'utf8'))
    : {};
  fs.writeFileSync(fullPath, JSON.stringify({ ...current, ...patch }, null, 2));
  console.log(`  ↳ mounted mock update: ${fixturePath}`);
}

// 2. Mount downstream guards (full replacement file content, keyed by path)
const guards = JSON.parse(row.downstream_guards || '{}');
for (const [filePath, patchedContent] of Object.entries(guards)) {
  const fullPath = path.join(__dirname, '..', filePath);
  fs.writeFileSync(fullPath, patchedContent);
  console.log(`  ↳ mounted guard: ${filePath}`);
}

// 3. Log the expand-phase migration (apply against your app DB here
//    if the demo needs a real schema change, not just the log line)
if (row.migration_payload) {
  console.log(`  ↳ migration (${row.migration_strategy}): ${row.migration_payload}`);
}

db.prepare("UPDATE ripple_signals SET status = 'MOUNTED_IN_CI' WHERE id = ?").run(row.id);
console.log(`✔ Signal ${row.id} marked MOUNTED_IN_CI`);
#!/usr/bin/env node
/**
 * sync-signal-registry.js
 *
 * Signal Sync (ingestion side): takes a Ripple Map / risk-scored payload
 * produced by Bob's Agent Mode analysis and writes it into the local
 * `ripple_signals` table (the "Signal Registry").
 *
 * Usage:
 *   node scripts/sync-signal-registry.js signals/RT-8821/signal_payload.json [--db ./ripple_track.db]
 *
 * Requires: better-sqlite3
 *   npm install better-sqlite3
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function parseArgs(argv) {
    const args = { payloadPath: null, dbPath: './ripple_track.db' };
    const rest = argv.slice(2);
    for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--db') {
            args.dbPath = rest[++i];
        } else if (!args.payloadPath) {
            args.payloadPath = rest[i];
        }
    }
    return args;
}

function loadPayload(payloadPath) {
    const resolved = path.resolve(process.cwd(), payloadPath);
    if (!fs.existsSync(resolved)) {
        console.error(`Signal payload not found: ${resolved}`);
        console.error('Create the JSON file first (see signal_payload.json.example) or check the path.');
        process.exit(1);
    }
    const raw = fs.readFileSync(resolved, 'utf-8');
    try {
        return JSON.parse(raw);
    } catch (err) {
        console.error(`Payload at ${resolved} is not valid JSON: ${err.message}`);
        process.exit(1);
    }
}

function validatePayload(payload) {
    const required = ['requirement_id', 'origin', 'target_model', 'nodes', 'risk_score'];
    const missing = required.filter((key) => payload[key] === undefined);
    if (missing.length) {
        console.error(`Payload is missing required field(s): ${missing.join(', ')}`);
        process.exit(1);
    }
}

function ensureSchema(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS ripple_signals (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      requirement_id   TEXT NOT NULL,
      origin           TEXT NOT NULL,
      target_model     TEXT NOT NULL,
      nodes_json       TEXT NOT NULL,
      risk_score       INTEGER NOT NULL,
      risk_band        TEXT NOT NULL,
      migration_sql     TEXT,
      mock_patch_json  TEXT,
      guard_snippet    TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function riskBand(score) {
    if (score <= 30) return 'Low';
    if (score <= 60) return 'Medium';
    return 'High';
}

function insertSignal(db, payload) {
    const stmt = db.prepare(`
    INSERT INTO ripple_signals
      (requirement_id, origin, target_model, nodes_json, risk_score, risk_band,
       migration_sql, mock_patch_json, guard_snippet)
    VALUES
      (@requirement_id, @origin, @target_model, @nodes_json, @risk_score, @risk_band,
       @migration_sql, @mock_patch_json, @guard_snippet)
  `);

    const result = stmt.run({
        requirement_id: payload.requirement_id,
        origin: typeof payload.origin === 'string' ? payload.origin : JSON.stringify(payload.origin),
        target_model: payload.target_model,
        nodes_json: JSON.stringify(payload.nodes),
        risk_score: payload.risk_score,
        risk_band: riskBand(payload.risk_score),
        migration_sql: payload.migration_sql || null,
        mock_patch_json: payload.mock_patch ? JSON.stringify(payload.mock_patch) : null,
        guard_snippet: payload.guard_snippet || null,
    });

    return result.lastInsertRowid;
}

function main() {
    const { payloadPath, dbPath } = parseArgs(process.argv);

    if (!payloadPath) {
        console.error('Usage: node scripts/sync-signal-registry.js <path-to-signal_payload.json> [--db <path>]');
        process.exit(1);
    }

    const payload = loadPayload(payloadPath);
    validatePayload(payload);

    const db = new Database(dbPath);
    ensureSchema(db);
    const rowId = insertSignal(db, payload);
    db.close();

    console.log(`Signal synced -> ripple_signals row #${rowId}`);
    console.log(`  requirement_id: ${payload.requirement_id}`);
    console.log(`  target_model:   ${payload.target_model}`);
    console.log(`  risk_score:     ${payload.risk_score} (${riskBand(payload.risk_score)})`);
}

main();
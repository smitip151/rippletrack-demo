-- RippleTrack — Signal Registry setup
-- Team: Tifosi CodeWorks | IBM Bob 2.0 Hackathon (Lablab)
-- Run with: sqlite3 ripple_track.db < setup.sql

-- 5.1 Database Schema — ripple_signals
CREATE TABLE IF NOT EXISTS ripple_signals (
    id                  TEXT PRIMARY KEY,
    feature_ticket_id   TEXT NOT NULL,
    target_commit_sha   TEXT,
    ripple_map_summary  JSON NOT NULL,          -- serialized dependency graph
    risk_score          INTEGER NOT NULL,       -- 0-100

    -- Safe migration artifact
    migration_payload   TEXT,                   -- e.g. ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT 'en-US'
    migration_strategy  TEXT,                   -- 'EXPAND_PHASE_ONLY'

    -- Mock & fixture sync
    mock_updates        JSON,                   -- path -> fixture mapping for CI mounting

    -- Defensive runtime guards
    downstream_guards   JSON,                   -- AST-targeted null-safety patches for consumers

    status              TEXT DEFAULT 'PENDING',  -- PENDING | MOUNTED_IN_CI | DEPLOYED
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9.5 Sample seed row (demo scenario: PROJ-8821 / preferredLanguage)
-- De-risks the CI Signal Sync demo by not depending on a live, possibly-flaky Bob call.
INSERT OR IGNORE INTO ripple_signals (
    id,
    feature_ticket_id,
    target_commit_sha,
    ripple_map_summary,
    risk_score,
    migration_payload,
    migration_strategy,
    mock_updates,
    downstream_guards,
    status
) VALUES (
    'RT-8821',
    'PROJ-8821',
    'demo-sha-0001',
    '{"origin":"requirements_v3.docx","nodes":[{"id":"UserProfileModel","type":"model","children":["ApiRouter","Analytics","MockServer"]},{"id":"ApiRouter","type":"consumer","delivery":"direct_pr","risk_flags":[]},{"id":"Analytics","type":"consumer","delivery":"signal_registry","risk_flags":["untyped_consumer"]},{"id":"MockServer","type":"test_fixture","delivery":"signal_registry","risk_flags":["stale_contract"]}]}',
    75,
    'ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT ''en-US'';',
    'EXPAND_PHASE_ONLY',
    '{"mocks/userFixture.json":{"preferredLanguage":"en-US"}}',
    '{"analytics/eventTracker.ts":"guard preferredLanguage access with null-safe default ''en-US''"}',
    'PENDING'
);

-- Manual verification (per Phase 0 checklist: "schema created and verified with a manual insert/select")
SELECT * FROM ripple_signals WHERE feature_ticket_id = 'PROJ-8821';
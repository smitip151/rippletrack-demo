'use strict';
/**
 * RippleTrack — Analysis Engine
 *
 * Wraps the existing CLI engine outputs (plan/*.json, signals/*.json).
 * For the primary demo PRD (prd-rt-8821 / RT-8821) it loads the real
 * pre-computed analysis from disk.
 *
 * For other library PRDs that don't yet have full plan dirs, it runs a
 * deterministic synthetic analysis that produces plausible results based
 * on the PRD's declared risk band so the demo is always coherent.
 *
 * For Advanced Mode (arbitrary upload), it does a best-effort text scan
 * of the uploaded content and applies the same risk scoring heuristics.
 *
 * The engine is intentionally synchronous-looking but wrapped in Promises
 * so the API layer can add realistic async delays for live progress UX.
 */

const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function readJsonSafe(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch (_) {
    return null;
  }
}

function riskBand(score) {
  if (score <= 30) return 'Low';
  if (score <= 60) return 'Medium';
  return 'High';
}

// Deterministic per-PRD synthetic results for library PRDs without full plan dirs.
// Keyed by prd.id.
const SYNTHETIC_PROFILES = {
  'prd-low-risk': {
    risk_score: 12,
    field_name: 'displayName',
    target_model: 'src/models/UserProfile.ts',
    nodes: [
      {
        id: 'src/models/UserProfile.ts',
        type: 'model',
        children: [],
        risk_flags: ['COPY_CHANGE_ONLY: No structural field change detected — display label update only.'],
      },
    ],
    contract: {
      field_name: 'displayName',
      optional: true,
      default_value: null,
      constraints: ['Display-label rename only; no type or optionality change.'],
    },
    code_archaeology: {
      typed_consumers: 2,
      untyped_consumers: 0,
      consumers: [],
    },
    test_archaeology: {
      stale_risk: false,
      fixture_fields: ['id', 'username', 'email', 'displayName'],
    },
    migration: null,
    mock_updates: null,
    downstream_guards: null,
  },
  'prd-high-risk': {
    risk_score: 94,
    field_name: 'paymentDetails',
    target_model: 'src/models/OrderModel.ts',
    nodes: [
      {
        id: 'src/models/OrderModel.ts',
        type: 'model',
        children: [
          'src/api/orderRouter.ts',
          'src/services/paymentService.ts',
          'src/analytics/revenueTracker.ts',
          'src/workers/invoiceWorker.ts',
          'src/reports/orderReport.ts',
          'src/webhooks/paymentWebhook.ts',
        ],
        risk_flags: [
          'BREAKING_CHANGE: 2 fields removed (legacyPaymentRef, oldCurrency). 6 consumers reference them.',
          'STRUCTURAL_CHANGE: paymentDetails sub-object restructured — nested fields shifted.',
          'SHARED_MODEL: 6 active consumers; any field removal is immediately breaking.',
        ],
      },
      { id: 'src/api/orderRouter.ts', type: 'consumer', children: [], risk_flags: ['DIRECT_FIELD_ACCESS: Reads removed field legacyPaymentRef on line 34.'] },
      { id: 'src/services/paymentService.ts', type: 'consumer', children: [], risk_flags: ['DIRECT_FIELD_ACCESS: Uses oldCurrency in payment calculation.'] },
      { id: 'src/analytics/revenueTracker.ts', type: 'consumer', children: [], risk_flags: ['UNTYPED: Record<string,any> — no compile-time binding.'] },
      { id: 'src/workers/invoiceWorker.ts', type: 'consumer', children: [], risk_flags: ['QUEUE_CONSUMER: Async worker will crash on deserialization of restructured payload.'] },
      { id: 'src/reports/orderReport.ts', type: 'consumer', children: [], risk_flags: ['STALE_QUERY: SQL query selects legacy_payment_ref column that no longer maps to the model.'] },
      { id: 'src/webhooks/paymentWebhook.ts', type: 'consumer', children: [], risk_flags: ['EXTERNAL_CONTRACT: Webhook payload sent to partner — breaking change needs coordinated release.'] },
      { id: 'tests/mocks/orderFixture.json', type: 'fixture', children: ['tests/orderRouter.test.ts'], risk_flags: ['FIXTURE_DRIFT: 3 stale fields. No schema validator installed.'] },
      { id: 'tests/orderRouter.test.ts', type: 'test', children: [], risk_flags: ['NO_COVERAGE: Removed fields not asserted on in any test — silent pass before prod crash.'] },
    ],
    contract: {
      field_name: 'paymentDetails',
      optional: false,
      default_value: null,
      constraints: ['Remove legacyPaymentRef and oldCurrency.', 'Restructure paymentDetails as nested object.'],
    },
    code_archaeology: { typed_consumers: 0, untyped_consumers: 6, consumers: [] },
    test_archaeology: { stale_risk: true, fixture_fields: ['id', 'orderId', 'legacyPaymentRef'] },
    migration: 'ALTER TABLE orders DROP COLUMN legacy_payment_ref; ALTER TABLE orders DROP COLUMN old_currency;',
    mock_updates: { 'tests/mocks/orderFixture.json': { paymentDetails: { amount: 99.99, currency: 'USD' } } },
    downstream_guards: null,
  },
  'prd-schema-drift': {
    risk_score: 58,
    field_name: 'catalogEntry',
    target_model: 'src/models/ProductCatalog.ts',
    nodes: [
      {
        id: 'src/models/ProductCatalog.ts',
        type: 'model',
        children: ['src/api/catalogRouter.ts', 'src/search/catalogSearch.ts'],
        risk_flags: [
          'SCHEMA_DRIFT: 3 undeclared fields in production (sku, tags[], imageUrl) not in interface.',
          'CONTRACT_FORMALISE: PRD is retroactively formalising active production fields.',
        ],
      },
      { id: 'src/api/catalogRouter.ts', type: 'consumer', children: [], risk_flags: ['FIELD_AHEAD_OF_INTERFACE: Uses sku and tags fields not declared in interface.'] },
      { id: 'src/search/catalogSearch.ts', type: 'consumer', children: [], risk_flags: ['UNTYPED: Accepts any — blindly passes all fields to Elasticsearch.'] },
      { id: 'tests/mocks/catalogFixture.json', type: 'fixture', children: [], risk_flags: ['FIXTURE_DRIFT: Missing sku, tags, imageUrl fields.'] },
    ],
    contract: {
      field_name: 'catalogEntry',
      optional: false,
      default_value: null,
      constraints: ['Formalise sku (required, string)', 'Formalise tags (optional, string[])', 'Formalise imageUrl (optional, string)'],
    },
    code_archaeology: { typed_consumers: 0, untyped_consumers: 2, consumers: [] },
    test_archaeology: { stale_risk: true, fixture_fields: ['id', 'name', 'price'] },
    migration: "ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(64) NOT NULL DEFAULT ''; ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;",
    mock_updates: { 'tests/mocks/catalogFixture.json': { sku: 'SKU-001', tags: ['electronics'], imageUrl: null } },
    downstream_guards: null,
  },
  'prd-mock-drift': {
    risk_score: 44,
    field_name: 'channelPreference',
    target_model: 'src/models/NotificationPayload.ts',
    nodes: [
      {
        id: 'src/models/NotificationPayload.ts',
        type: 'model',
        children: ['src/services/notificationService.ts', 'src/workers/emailWorker.ts'],
        risk_flags: [
          'OPTIONAL_FIELD_ADD: channelPreference is optional with default "email".',
          'SHARED_MODEL: 2 consumers — both need null-safe access.',
        ],
      },
      { id: 'src/services/notificationService.ts', type: 'consumer', children: [], risk_flags: ['UNTYPED: Destructures payload with no type annotation.'] },
      { id: 'src/workers/emailWorker.ts', type: 'consumer', children: [], risk_flags: ['OPTIONAL_NOT_GUARDED: Accesses channelPreference without null guard.'] },
      { id: 'tests/mocks/notificationFixture.json', type: 'fixture', children: ['tests/notification.test.ts'], risk_flags: ['FIXTURE_DRIFT: 3 sprints stale — channelPreference absent.'] },
      { id: 'tests/notification.test.ts', type: 'test', children: [], risk_flags: ['NO_COVERAGE_NEW_FIELD: No assertion on channelPreference.'] },
    ],
    contract: {
      field_name: 'channelPreference',
      optional: true,
      default_value: 'email',
      constraints: ['Optional field. Default: "email". Valid values: email | sms | push.'],
    },
    code_archaeology: { typed_consumers: 0, untyped_consumers: 2, consumers: [] },
    test_archaeology: { stale_risk: true, fixture_fields: ['id', 'userId', 'message'] },
    migration: "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel_preference VARCHAR(10) DEFAULT 'email';",
    mock_updates: { 'tests/mocks/notificationFixture.json': { channelPreference: 'email' } },
    downstream_guards: null,
  },
  'prd-no-risk': {
    risk_score: 0,
    field_name: null,
    target_model: null,
    nodes: [],
    contract: {
      field_name: null,
      optional: null,
      default_value: null,
      constraints: ['Documentation-only change. No model, code, or test modifications required.'],
    },
    code_archaeology: { typed_consumers: 0, untyped_consumers: 0, consumers: [] },
    test_archaeology: { stale_risk: false, fixture_fields: [] },
    migration: null,
    mock_updates: null,
    downstream_guards: null,
  },
  'prd-ambiguous': {
    risk_score: 47,
    field_name: 'subscriptionTier',
    target_model: 'src/models/AccountModel.ts',
    nodes: [
      {
        id: 'src/models/AccountModel.ts',
        type: 'model',
        children: ['src/api/accountRouter.ts'],
        risk_flags: [
          'AMBIGUOUS_CONTRACT: Section 2.1 declares subscriptionTier as optional; Section 4.3 says it is required. Contract Detective cannot resolve without human clarification.',
          'CONFLICTING_DEFAULTS: Section 2.1 says default="free"; Section 4.3 says no default (required field).',
        ],
      },
      { id: 'src/api/accountRouter.ts', type: 'consumer', children: [], risk_flags: ['UNRESOLVED_OPTIONALITY: Cannot generate safe guard until contract conflict is resolved.'] },
    ],
    contract: {
      field_name: 'subscriptionTier',
      optional: null,
      default_value: null,
      constraints: [
        '⚠ CONFLICT: Section 2.1 marks field optional with default "free".',
        '⚠ CONFLICT: Section 4.3 marks field required with no default.',
        'Human clarification required before proceeding.',
      ],
    },
    code_archaeology: { typed_consumers: 0, untyped_consumers: 1, consumers: [] },
    test_archaeology: { stale_risk: false, fixture_fields: ['id', 'email'] },
    migration: null,
    mock_updates: null,
    downstream_guards: null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Run a real analysis from plan files (prd-rt-8821)
// ─────────────────────────────────────────────────────────────────────────────
function analyzeFromPlanFiles(prd) {
  const planDir = prd.plan_dir;
  const contract    = readJsonSafe(path.join(planDir, 'contract_analysis.json'));
  const codeArch    = readJsonSafe(path.join(planDir, 'code_archaeology.json'));
  const testArch    = readJsonSafe(path.join(planDir, 'test_archaeology.json'));
  const rippleMap   = readJsonSafe(path.join(planDir, 'ripple_map.json'));
  const signalPayload = prd.signal_payload_path ? readJsonSafe(prd.signal_payload_path) : null;

  if (!rippleMap) throw new Error(`ripple_map.json not found in ${planDir}`);

  const riskScore = rippleMap.risk_score || 100;
  const nodes     = rippleMap.nodes || [];

  // Build edges list from nodes children arrays
  const edges = [];
  for (const node of nodes) {
    for (const childId of (node.children || [])) {
      edges.push({ source: node.id, target: childId });
    }
  }

  return {
    risk_score:           riskScore,
    risk_band:            riskBand(riskScore),
    risk_score_breakdown: rippleMap.risk_score_breakdown || null,
    ripple_map: {
      nodes: nodes.map(n => ({
        id:         n.id,
        type:       n.type,
        risk_flags: n.risk_flags || [],
      })),
      edges,
    },
    contract_analysis:   contract,
    code_archaeology:    codeArch,
    test_archaeology:    testArch,
    signal_payload:      signalPayload,
    migration_payload:   signalPayload ? signalPayload.migration_payload : null,
    mock_updates:        signalPayload ? signalPayload.mock_updates : null,
    downstream_guards:   signalPayload ? signalPayload.downstream_guards : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Synthetic analysis for library PRDs without plan dirs
// ─────────────────────────────────────────────────────────────────────────────
function analyzeFromSyntheticProfile(prd) {
  const profile = SYNTHETIC_PROFILES[prd.id];
  if (!profile) throw new Error(`No synthetic profile for PRD id: ${prd.id}`);

  const nodes  = profile.nodes || [];
  const edges  = [];
  for (const node of nodes) {
    for (const childId of (node.children || [])) {
      edges.push({ source: node.id, target: childId });
    }
  }

  return {
    risk_score:           profile.risk_score,
    risk_band:            riskBand(profile.risk_score),
    risk_score_breakdown: null,
    ripple_map: { nodes, edges },
    contract_analysis: {
      ticket_id:           prd.id,
      target_model:        profile.target_model,
      field_name:          profile.field_name,
      optional:            profile.contract.optional,
      default_value:       profile.contract.default_value,
      prd_stated_constraints: profile.contract.constraints,
    },
    code_archaeology: {
      target_model:       profile.target_model,
      typed_consumers:    profile.code_archaeology.typed_consumers,
      untyped_consumers:  profile.code_archaeology.untyped_consumers,
      consumers:          profile.code_archaeology.consumers,
    },
    test_archaeology: {
      target_fixture: null,
      stale_risk:      profile.test_archaeology.stale_risk,
      fixture_fields:  profile.test_archaeology.fixture_fields,
    },
    signal_payload:      null,
    migration_payload:   profile.migration ? { sql: profile.migration } : null,
    mock_updates:        profile.mock_updates || null,
    downstream_guards:   profile.downstream_guards || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Advanced mode — best-effort scan of arbitrary uploaded file content
// ─────────────────────────────────────────────────────────────────────────────
function analyzeAdvancedUpload(filename, textContent) {
  const lower = textContent.toLowerCase();

  // Detect field name from common patterns
  const fieldMatch =
    lower.match(/field[:\s]+["`']?([a-z_][a-zA-Z0-9_]+)/i) ||
    lower.match(/add(?:ing)?\s+(?:a\s+)?(?:new\s+)?field\s+["`']?([a-z_][a-zA-Z0-9_]+)/i) ||
    lower.match(/["`']([a-zA-Z][a-zA-Z0-9_]{2,})["`']\s+field/i);
  const fieldName = fieldMatch ? fieldMatch[1] : 'unknownField';

  // Detect optionality
  const isOptional = lower.includes('optional') && !lower.includes('required');

  // Detect default
  const defaultMatch = lower.match(/default[:\s]+["`']?([a-zA-Z0-9_\-\.]+)/i);
  const defaultValue = defaultMatch ? defaultMatch[1] : null;

  // Heuristic risk scoring
  let score = 20;
  if (lower.includes('breaking')) score += 30;
  if (lower.includes('required') && !lower.includes('optional')) score += 15;
  if (lower.includes('migrat')) score += 10;
  if (lower.includes('downstream')) score += 10;
  if (lower.includes('consumer')) score += 5;
  if (lower.includes('remove') || lower.includes('delete')) score += 20;
  if (lower.includes('rename')) score += 10;
  if (lower.includes('schema')) score += 5;
  if (lower.includes('fixture') || lower.includes('mock')) score += 5;
  score = Math.min(score, 100);

  const nodes = [
    {
      id: `models/DetectedModel.ts`,
      type: 'model',
      children: [],
      risk_flags: [
        `PARSED_FROM_UPLOAD: Contract Detective extracted field "${fieldName}" from ${filename}.`,
        isOptional ? 'OPTIONAL_FIELD: Marked optional in PRD.' : 'REQUIRED_FIELD: Marked required in PRD.',
        defaultValue ? `DEFAULT_DETECTED: Default value "${defaultValue}" specified.` : 'NO_DEFAULT: No default value detected.',
      ],
    },
  ];

  return {
    risk_score: score,
    risk_band:  riskBand(score),
    risk_score_breakdown: null,
    ripple_map: { nodes, edges: [] },
    contract_analysis: {
      ticket_id:   `advanced-${Date.now()}`,
      target_model: 'DetectedModel (advanced upload)',
      field_name:  fieldName,
      optional:    isOptional,
      default_value: defaultValue,
      prd_stated_constraints: [
        `⚠ Advanced Mode: results are heuristic — accuracy not guaranteed on custom documents.`,
        `Parsed from: ${filename}`,
      ],
    },
    code_archaeology:  { target_model: null, typed_consumers: 0, untyped_consumers: 0, consumers: [] },
    test_archaeology:  { stale_risk: false, fixture_fields: [] },
    signal_payload:    null,
    migration_payload: null,
    mock_updates:      null,
    downstream_guards: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main dispatch
// ─────────────────────────────────────────────────────────────────────────────
function runAnalysis(prd, mode, advancedPayload) {
  if (mode === 'advanced' && advancedPayload) {
    return analyzeAdvancedUpload(advancedPayload.filename, advancedPayload.textContent);
  }
  if (prd.plan_dir && fs.existsSync(prd.plan_dir)) {
    return analyzeFromPlanFiles(prd);
  }
  return analyzeFromSyntheticProfile(prd);
}

module.exports = { runAnalysis, riskBand };

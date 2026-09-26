'use strict';
/**
 * RippleTrack — PRD Library Manifest
 * Describes each pre-validated PRD file, its expected risk band, and the
 * target repo it was validated against.
 *
 * Each entry also references a `plan_dir` containing the pre-computed
 * analysis outputs (contract_analysis.json, code_archaeology.json,
 * test_archaeology.json, ripple_map.json) that were produced from the PRD
 * by the CLI engine.  For the demo, those plan files are loaded directly
 * rather than re-running the full agent pipeline on every request.
 */

const path = require('path');
const ROOT = path.join(__dirname, '..');
const REQUIREMENTS_DIR = path.join(ROOT, 'requirements');

const PRD_LIBRARY = [
  {
    id: 'prd-rt-8821',
    filename: 'requirements_v3.docx',
    filepath: path.join(REQUIREMENTS_DIR, 'requirements_v3.docx'),
    short_description:
      'UserProfile · preferredLanguage — adds an optional locale field with en-US default. ' +
      'Touches 2 consumers, 1 stale fixture, and 1 migration (expand-phase only).',
    target_repo_id: 'rippletrack-demo',
    risk_band: 'High',
    plan_dir: path.join(ROOT, 'plan'),
    signal_id: 'RT-8821',
    signal_payload_path: path.join(ROOT, 'signals', 'RT-8821', 'signal_payload.json'),
  },
  {
    id: 'prd-low-risk',
    filename: 'requirements_prd1_low_risk.docx',
    filepath: path.join(REQUIREMENTS_DIR, 'requirements_prd1_low_risk.docx'),
    short_description:
      'Minor copy-only update to the User Profile display name field. ' +
      'No model changes, no downstream consumers impacted. Expected risk: Low.',
    target_repo_id: 'rippletrack-demo',
    risk_band: 'Low',
    plan_dir: null,
    signal_id: null,
    signal_payload_path: null,
  },
  {
    id: 'prd-high-risk',
    filename: 'requirements_prd2_high_risk.docx',
    filepath: path.join(REQUIREMENTS_DIR, 'requirements_prd2_high_risk.docx'),
    short_description:
      'Multi-field breaking change on OrderModel — removes deprecated fields and ' +
      'restructures the payment sub-object. Affects 6 downstream consumers. Expected risk: High.',
    target_repo_id: 'rippletrack-demo',
    risk_band: 'High',
    plan_dir: null,
    signal_id: null,
    signal_payload_path: null,
  },
  {
    id: 'prd-schema-drift',
    filename: 'requirements_prd3_schema_drift.docx',
    filepath: path.join(REQUIREMENTS_DIR, 'requirements_prd3_schema_drift.docx'),
    short_description:
      'ProductCatalog schema drift — 3 undeclared fields in production code that are ' +
      'not in the interface. PRD formalises them. Contract Detective detects all 3 gaps.',
    target_repo_id: 'rippletrack-demo',
    risk_band: 'Medium',
    plan_dir: null,
    signal_id: null,
    signal_payload_path: null,
  },
  {
    id: 'prd-mock-drift',
    filename: 'requirements_prd4_mock_drift.docx',
    filepath: path.join(REQUIREMENTS_DIR, 'requirements_prd4_mock_drift.docx'),
    short_description:
      'NotificationService payload update — adds an optional `channelPreference` field. ' +
      'Test fixtures are 3 sprints stale. Test Archaeologist flags mock drift.',
    target_repo_id: 'rippletrack-demo',
    risk_band: 'Medium',
    plan_dir: null,
    signal_id: null,
    signal_payload_path: null,
  },
  {
    id: 'prd-no-risk',
    filename: 'requirements_prd5_no_risk.docx',
    filepath: path.join(REQUIREMENTS_DIR, 'requirements_prd5_no_risk.docx'),
    short_description:
      'Documentation-only PRD update. No model, code, or test changes required. ' +
      'All three subagents complete with zero findings. Expected risk: 0.',
    target_repo_id: 'rippletrack-demo',
    risk_band: 'Low',
    plan_dir: null,
    signal_id: null,
    signal_payload_path: null,
  },
  {
    id: 'prd-ambiguous',
    filename: 'requirements_prd6_ambiguous.docx',
    filepath: path.join(REQUIREMENTS_DIR, 'requirements_prd6_ambiguous.docx'),
    short_description:
      'Ambiguous requirement — field constraints are contradictory (optional AND required ' +
      'in different sections). Contract Detective surfaces the conflict. Risk band uncertain.',
    target_repo_id: 'rippletrack-demo',
    risk_band: 'Medium',
    plan_dir: null,
    signal_id: null,
    signal_payload_path: null,
  },
];

const TARGET_REPOS = [
  { id: 'rippletrack-demo', name: 'rippletrack-demo', description: 'Primary demo repository (UserProfile model)' },
];

module.exports = { PRD_LIBRARY, TARGET_REPOS };

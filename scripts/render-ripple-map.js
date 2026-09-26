#!/usr/bin/env node
/**
 * render-ripple-map.js
 *
 * Reads plan/ripple_map.json, prints ASCII tree to terminal,
 * optionally emits a Mermaid flowchart block (for README / pitch deck).
 *
 * Generic over node shape. Auto-detects common key names so it doesn't
 * hardcode one scenario's schema. Override via CLI flags if needed.
 *
 * Usage:
 *   node render-ripple-map.js [path/to/ripple_map.json]
 *   node render-ripple-map.js --mermaid [path/to/ripple_map.json]
 *   node render-ripple-map.js --mermaid --out README_SNIPPET.md
 *   node render-ripple-map.js --name-key label --children-key kids --risk-key score
 */

const fs = require('fs');
const path = require('path');

// ---------- CLI parsing ----------
function parseArgs(argv) {
  const args = { mermaid: false, out: null, file: null, nameKey: null, childrenKey: null, riskKey: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mermaid') args.mermaid = true;
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--name-key') args.nameKey = argv[++i];
    else if (a === '--children-key') args.childrenKey = argv[++i];
    else if (a === '--risk-key') args.riskKey = argv[++i];
    else if (!a.startsWith('--')) args.file = a;
  }
  return args;
}

// ---------- shape detection ----------
// Try common key names in priority order so we don't hardcode one scenario.
const NAME_KEYS = ['name', 'label', 'id', 'title', 'symbol', 'file', 'node'];
const CHILDREN_KEYS = ['children', 'kids', 'nodes', 'dependents', 'consumers', 'edges'];
const RISK_KEYS = ['risk', 'riskScore', 'risk_score', 'score'];
const TYPE_KEYS = ['type', 'kind', 'category'];

function firstPresentKey(obj, candidates, override) {
  if (override) return override;
  for (const k of candidates) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) return k;
  }
  return null;
}

function getNodeName(node, keys) {
  const k = firstPresentKey(node, NAME_KEYS, keys.nameKey);
  return k ? String(node[k]) : '(unnamed)';
}

function getNodeLabel(node, keys) {
  let label = getNodeName(node, keys);

  const riskKey = firstPresentKey(node, RISK_KEYS, keys.riskKey);
  const typeKey = firstPresentKey(node, TYPE_KEYS, null);

  const tags = [];
  if (typeKey && node[typeKey]) tags.push(String(node[typeKey]));
  if (riskKey && node[riskKey] !== undefined && node[riskKey] !== null) {
    tags.push(`risk:${node[riskKey]}`);
  }
  if (tags.length) label += ` [${tags.join(', ')}]`;
  return label;
}

function getChildren(node, keys) {
  const k = firstPresentKey(node, CHILDREN_KEYS, keys.childrenKey);
  if (!k) return [];
  const val = node[k];
  if (Array.isArray(val)) return val;
  return [];
}

// ---------- ASCII tree ----------
function renderAscii(node, keys, prefix = '', isLast = true, isRoot = true) {
  let out = '';
  const connector = isRoot ? '' : (isLast ? '└── ' : '├── ');
  out += prefix + connector + getNodeLabel(node, keys) + '\n';

  const children = getChildren(node, keys);
  const childPrefix = prefix + (isRoot ? '' : (isLast ? '    ' : '│   '));

  children.forEach((child, i) => {
    const last = i === children.length - 1;
    out += renderAscii(child, keys, childPrefix, last, false);
  });

  return out;
}

// ---------- Mermaid ----------
function sanitizeId(str, seen) {
  let base = String(str).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40) || 'node';
  let id = base;
  let n = 1;
  while (seen.has(id)) {
    id = `${base}_${n++}`;
  }
  seen.add(id);
  return id;
}

function renderMermaid(root, keys) {
  const lines = ['```mermaid', 'flowchart TD'];
  const seenIds = new Set();

  function walk(node, parentId) {
    const name = getNodeName(node, keys);
    const label = getNodeLabel(node, keys).replace(/"/g, "'");
    const id = sanitizeId(name, seenIds);
    lines.push(`  ${id}["${label}"]`);
    if (parentId) lines.push(`  ${parentId} --> ${id}`);

    const children = getChildren(node, keys);
    children.forEach((child) => walk(child, id));
  }

  walk(root, null);
  lines.push('```');
  return lines.join('\n');
}

// ---------- main ----------
function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = path.resolve(args.file || 'plan/ripple_map.json');

  if (!fs.existsSync(filePath)) {
    console.error(`ripple map not found: ${filePath}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`failed to parse JSON at ${filePath}: ${err.message}`);
    process.exit(1);
  }

  // Accept either a bare node, or a wrapper object with a "root" key.
  const root = data.root && typeof data.root === 'object' ? data.root : data;

  const keys = { nameKey: args.nameKey, childrenKey: args.childrenKey, riskKey: args.riskKey };

  const ascii = renderAscii(root, keys);
  console.log(ascii);

  if (args.mermaid) {
    const mermaid = renderMermaid(root, keys);
    if (args.out) {
      fs.writeFileSync(path.resolve(args.out), mermaid + '\n', 'utf-8');
      console.log(`mermaid block written to ${args.out}`);
    } else {
      console.log('\n' + mermaid);
    }
  }
}

main();
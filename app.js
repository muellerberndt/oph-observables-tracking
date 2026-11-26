'use strict';

// Prefer the classified public ledger and retain the dated research audit as an independent source.
const REPO = 'FloatingPragma/observer-patch-holography';
const PATH = 'docs/registers/OBSERVABLES.json';
const BLOB = `https://github.com/${REPO}/blob/`;
const AUDIT = 'snapshots/2026-11-26/';
const PUBLIC_LEDGER = BLOB + 'main/' + PATH;
const CLASSES = new Set(['observable', 'formalism', 'comparison', 'prediction', 'question']);
const STATUSES = ['Demonstrated', 'Conditional', 'Partial', 'Open'];
const GLYPH = { Demonstrated: '●', Conditional: '◐', Partial: '◔', Open: '○' };
const BASE = { Demonstrated: 1, Conditional: 0, Partial: 0.25, Open: 0 };

const CREDIT_SCOPES = new Set(['apparatus', 'candidate and apparatus', 'conditional construction', 'restricted evidence']);

const state = { kind: 'observable', statuses: new Set(STATUSES), query: '' };
let SOURCE;
let ROWS = [];
let BY_ID = new Map();
let WAITING = new Map(); // premise id -> observable rows that wait on it

const $ = (id) => document.getElementById(id);
function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
}
const glyph = (s) => el('span', { class: `g ${s}`, 'aria-label': s, title: s, text: GLYPH[s] || '?' });
const pct = (x) => `${(100 * x).toFixed(1)}%`;
const WEIGHTING = 'Progress across physical targets. A conditional proof earns the score of its weakest physical premise. Demonstrated contributes 1, partial contributes 1/4, open and comparison-only evidence contribute 0. Formal results, predictions, benchmark comparisons and questions are listed separately.';
const tip = (text) => el('span', { class: 'tip', tabindex: '0', role: 'note', 'aria-label': text, 'data-tip': text, text: '?' });

async function get(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  if (!response.ok) throw new Error(`could not load ${url} (HTTP ${response.status})`);
  return response;
}

function classified(data) {
  const observables = data.rows?.filter((row) => row.kind === 'observable') || [];
  return observables.length > 0 && observables.every((row) =>
    CLASSES.has(row.target_class) && typeof row.scope === 'string' && row.scope.trim());
}

async function publicLedger() {
  let commit;
  try {
    const api = `https://api.github.com/repos/${REPO}/commits?sha=main&path=${PATH}&per_page=1`;
    const entries = await (await get(api, { signal: AbortSignal.timeout(3000) })).json();
    const latest = entries[0];
    if (latest && /^[0-9a-f]{40}$/.test(latest.sha)) commit = latest.sha;
  } catch { /* Raw public main remains available when the commit API is unavailable. */ }
  const revision = commit || 'main';
  const response = await get(`https://raw.githubusercontent.com/${REPO}/${revision}/${PATH}`,
    { signal: AbortSignal.timeout(6000) });
  const data = await response.json();
  if (!Array.isArray(data.rows) || !data.rows.length) throw new Error('Public ledger has no rows');
  return { data, source: { kind: 'public', revision, url: BLOB + revision + '/' + PATH } };
}

async function auditLedger() {
  const url = AUDIT + 'OBSERVABLES.json';
  const [response, manifestResponse] = await Promise.all([get(url), get(AUDIT + 'evidence.json')]);
  const bytes = await response.arrayBuffer();
  const manifest = await manifestResponse.json();
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const checksum = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
  if (checksum !== manifest.ledger_sha256) throw new Error('Audit snapshot checksum mismatch');
  return { data: JSON.parse(new TextDecoder().decode(bytes)), source: { kind: 'audit', url, manifest } };
}

async function load() {
  const params = new URLSearchParams(location.search);
  const local = params.get('data');
  if (local && /^[\w./-]+$/.test(local) && !local.includes('..')) {
    const url = new URL(local, location.href);
    if (url.origin === location.origin) {
      return { data: await (await get(url)).json(), source: { kind: 'preview', url: url.href } };
    }
  }
  const choice = params.get('source');
  if (choice === 'audit') return auditLedger();
  if (choice === 'public') return publicLedger();
  try {
    const current = await publicLedger();
    if (classified(current.data)) return current;
  } catch { /* The frozen audit is available independently of GitHub. */ }
  return auditLedger();
}

function renderSource(data) {
  const auditLink = el('a', { href: '?source=audit', text: '26 November 2026 audit' });
  const liveLink = el('a', { href: '?source=public', text: 'public main ledger' });
  const label = SOURCE.kind === 'audit' ? 'Local research audit · 26 November 2026'
    : SOURCE.kind === 'public' ? 'Public main ledger' : 'Local preview';
  let detail;
  if (SOURCE.kind === 'audit') {
    detail = ['Evidence links open files verified byte for byte at ',
      el('a', { href: `https://github.com/${REPO}/tree/${SOURCE.manifest.public_revision}`,
        text: SOURCE.manifest.public_revision.slice(0, 9) }),
      '. Other cited files are marked as local. ', liveLink];
  } else if (SOURCE.kind === 'public') {
    detail = [classified(data) ? 'The public ledger supplies the target classifications.' :
      'This public revision predates target classifications. A physical-target score is unavailable.',
      ' ', auditLink];
  } else {
    detail = ['Local preview data. ', auditLink, ' · ', liveLink];
  }
  $('source-title').textContent = label;
  $('source-detail').replaceChildren(...detail);
  $('source').href = SOURCE.url;
  $('source').textContent = SOURCE.kind === 'audit' ? 'Audited ledger JSON' : 'Ledger JSON';
  if (SOURCE.kind === 'audit') {
    $('meta').replaceChildren(el('a', { href: AUDIT + 'evidence.json', text: 'Audit checksums and evidence provenance' }));
  } else if (SOURCE.kind === 'public') {
    $('meta').textContent = SOURCE.revision === 'main' ? 'Latest public main' : `Public ledger revision ${SOURCE.revision}`;
  } else {
    $('meta').textContent = 'Preview';
  }
}

// Rows written before the short schema carry long texts and one code list; read both forms.
function normalize(r) {
  const code = r.code || [];
  const isLean = (p) => /^Lean\//.test(p) || /\.lean$/.test(p);
  return {
    ...r,
    what: r.what || r.statement || r.why || '',
    why: r.what ? (r.why || '') : '',
    lean: r.lean || code.filter(isLean),
    model: r.model || code.filter((p) => !isLean(p)),
    papers: r.papers || [],
    premises: r.premises || [],
  };
}

function score(r, upgraded) {
  if (r.kind === 'observable' && !CREDIT_SCOPES.has(r.scope)) return 0;
  if (r.id === upgraded) return 1;
  if (r.status !== 'Conditional') return BASE[r.status] ?? 0;
  const ps = r.premises.map((p) => BY_ID.get(p)).filter(Boolean);
  const physical = ps.filter((p) => ['derivable', 'calibration'].includes(p.premise_kind) || p.status !== 'Demonstrated');
  return physical.length ? Math.min(...physical.map((p) => p.id === upgraded ? 1 : BASE[p.status] ?? 0)) : 0;
}

function targets(rows) {
  return rows.filter((r) => r.target_class === 'observable');
}

function counts(rows) {
  const c = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of rows) if (r.status in c) c[r.status] += 1;
  return c;
}

function bar(rows) {
  const c = counts(rows);
  const node = el('div', { class: 'bar', id: 'bar', role: 'img' });
  const label = [];
  for (const s of STATUSES) {
    if (!c[s]) continue;
    label.push(`${s.toLowerCase()} ${c[s]}`);
    const seg = el('span', { title: `${s.toLowerCase()}: ${c[s]} of ${rows.length}` });
    seg.style.flex = `${c[s]} 1 0`;
    seg.style.background = `var(--s-${s})`;
    node.append(seg);
  }
  node.setAttribute('aria-label', label.join(', '));
  return node;
}

function renderTally(data) {
  const obs = ROWS.filter((r) => r.kind === 'observable');

  const physical = classified(data) ? targets(obs) : [];
  const c = counts(obs);
  const completion = physical.reduce((a, r) => a + score(r), 0) / (physical.length || 1);
  const stat = (v, small, l, help) => el('div', { class: 'stat' }, el('span', { class: 'v' }, v, small ? el('small', { text: small }) : null), el('span', { class: 'l' }, l, help ? tip(help) : null));
  $('stats').replaceChildren(
    stat(physical.length ? pct(completion) : '—', null, 'physical target progress', WEIGHTING),
    stat(physical.length ? String(physical.filter((r) => r.status === 'Demonstrated' && score(r) === 1).length) : '—', `/ ${physical.length || '—'}`, 'physical targets demonstrated'),
    stat(String(c.Conditional), null, 'conditional rows'),
  );
  $('bar').replaceWith(bar(obs));
  $('legend').replaceChildren(...STATUSES.map((s) => {
    const b = el('button', { 'aria-pressed': 'true', 'data-status': s }, glyph(s), ` ${s.toLowerCase()} `, el('b', { text: String(c[s]) }));
    b.addEventListener('click', () => toggleStatus(s));
    return b;
  }));
  const blockers = (physical.length ? [...WAITING.entries()] : [])
    .map(([p, rs]) => [BY_ID.get(p), targets(rs).reduce((gain, row) => gain + score(row, p) - score(row), 0)])
    .filter(([p, gain]) => p && p.premise_kind === 'derivable' && p.status !== 'Demonstrated' && gain > 0)
    .sort((a, b) => b[1] - a[1] || a[0].id.localeCompare(b[0].id)).slice(0, 5);
  $('blocking').replaceChildren(...(blockers.length ? [
    el('span', { class: 'h', text: 'single-premise gains in physical target progress' }),
    el('ol', {}, blockers.map(([p, n]) => el('li', {},
      el('span', { class: 'n', text: pct(n / physical.length) }),
      el('span', {}, glyph(p.status), ' ', el('a', { href: `#${p.id}`, text: p.name }))))),
  ] : []));
  const rules = data.statuses || {};
  const funded = ROWS.filter((r) => r.kind === 'premise' && r.status === 'Demonstrated');
  $('rules').replaceChildren(el('dt', { text: 'premise coverage' }), el('dd', { text: `${funded.filter((r) => WAITING.has(r.id)).length} of ${funded.length} demonstrated premises are cited directly by observables.` }), ...STATUSES.flatMap((s) => [
    el('dt', {}, glyph(s), ` ${s.toLowerCase()}`), el('dd', { text: rules[s] || '' }),
  ]));
  $('n-observable').textContent = obs.length;
  $('n-premise').textContent = ROWS.filter((r) => r.kind === 'premise').length;
  $('tally').hidden = false;
  $('switch').hidden = false;
}

function toggleStatus(s) {
  if (state.statuses.has(s) && state.statuses.size === STATUSES.length) state.statuses = new Set([s]);
  else if (state.statuses.has(s)) state.statuses.delete(s);
  else state.statuses.add(s);
  if (!state.statuses.size) state.statuses = new Set(STATUSES);
  for (const b of document.querySelectorAll('.legend button')) b.setAttribute('aria-pressed', String(state.statuses.has(b.dataset.status)));
  renderList();
}

function fileLink(path) {
  if (/^https?:\/\//.test(path)) return el('a', { href: path, title: path, text: path.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48) });
  let shown = path;
  if (/\.(tex)$/.test(path)) shown = path.replace(/\.tex$/, '');
  const base = shown.split('/').filter(Boolean).pop() || shown;
  if (SOURCE.kind === 'audit' && Object.hasOwn(SOURCE.manifest.public_blobs, path.split('#')[0])) {
    return el('a', { href: BLOB + SOURCE.manifest.public_revision + '/' + path, title: path, text: base });
  }
  if (SOURCE.kind === 'public') return el('a', { href: BLOB + SOURCE.revision + '/' + path, title: path, text: base });
  return el('span', { class: 'local-ref', title: path, text: path + ' (local)' });
}

function refs(r) {
  const dl = el('dl', { class: 'refs' });
  const add = (label, nodes) => { if (nodes.length) dl.append(el('dt', { text: label }), el('dd', {}, nodes)); };
  const waits = r.premises.map((p) => BY_ID.get(p)).filter(Boolean)
    .map((p) => el('a', { href: `#${p.id}`, title: p.status }, `${GLYPH[p.status]} ${p.name}`));
  add('premises', waits);
  if (r.kind === 'premise') {
    add('needed by', (WAITING.get(r.id) || []).map((o) => el('a', { href: `#${o.id}`, title: o.status }, `${GLYPH[o.status]} ${o.name}`)));
  }
  if (r.scope) add('scope', [r.scope]);
  if (r.theorem) add('theorem', [fileLink(r.theorem.split('#')[0]), ' ', r.theorem.split('#')[1]]);
  add('lean', r.lean.map(fileLink));
  add('model', r.model.map(fileLink));
  add('papers', r.papers.map(fileLink));
  return dl;
}

function item(r) {
  const node = el('details', { class: 'item', id: r.id },
    el('summary', {}, glyph(r.status), el('span', { class: 'name', text: r.name }), el('span', { class: 'st', text: r.status.toLowerCase() })));
  node.addEventListener('toggle', () => {
    if (!node.open || node.querySelector('.body')) return;
    node.append(el('div', { class: 'body' },
      r.what ? el('p', { class: 'what', text: r.what }) : null,
      r.why ? el('p', { class: 'why', text: r.why }) : null,
      r.assessment ? el('p', { text: r.assessment }) : null,
      refs(r)));
  });
  return node;
}

function matches(r) {
  if (r.kind !== state.kind || !state.statuses.has(r.status)) return false;
  if (!state.query) return true;
  const hay = [r.id, r.name, r.what, r.why, r.category].join(' ').toLowerCase();
  return state.query.split(/\s+/).every((w) => hay.includes(w));
}

function renderList() {
  const groups = new Map();
  for (const r of ROWS.filter(matches)) {
    if (!groups.has(r.category)) groups.set(r.category, []);
    groups.get(r.category).push(r);
  }
  $('list').replaceChildren(...[...groups].map(([cat, items]) => {
    const whole = ROWS.filter((r) => r.kind === state.kind && r.category === cat);
    const included = state.kind === 'observable' ? (classified({ rows: ROWS }) ? targets(whole) : []) : whole;
    const share = included.reduce((a, r) => a + score(r), 0) / (included.length || 1);
    return el('section', { class: 'group' },
      el('h2', { title: `progress over ${included.length} eligible rows` }, cat.toUpperCase(), el('span', { class: 'n', text: included.length ? pct(share) : '—' }), tip(WEIGHTING)),
      items.map(item));
  }));
  $('empty').hidden = groups.size > 0;
}

function setKind(kind) {
  state.kind = kind;
  for (const b of document.querySelectorAll('.switch button')) b.setAttribute('aria-pressed', String(b.dataset.kind === kind));
  renderList();
}

function openHash() {
  const r = BY_ID.get(decodeURIComponent(location.hash.slice(1)));
  if (!r) return;
  if (!matches(r)) {
    state.statuses = new Set(STATUSES);
    state.query = '';
    $('search').value = '';
    for (const b of document.querySelectorAll('.legend button')) b.setAttribute('aria-pressed', 'true');
    setKind(r.kind);
  }
  const node = document.getElementById(r.id);
  if (node) { node.open = true; node.scrollIntoView({ block: 'start' }); }
}

async function main() {
  try {
    const { data, source } = await load();
    SOURCE = source;
    ROWS = (data.rows || []).map(normalize);
    BY_ID = new Map(ROWS.map((r) => [r.id, r]));
    WAITING = new Map();
    for (const r of ROWS) {
      if (r.kind !== 'observable') continue;
      for (const p of r.premises) {
        if (!WAITING.has(p)) WAITING.set(p, []);
        WAITING.get(p).push(r);
      }
    }
    renderSource(data);
    renderTally(data);
    renderList();
    for (const b of document.querySelectorAll('.switch button')) b.addEventListener('click', () => setKind(b.dataset.kind));
    $('search').addEventListener('input', (e) => { state.query = e.target.value.trim().toLowerCase(); renderList(); });
    window.addEventListener('hashchange', openHash);
    openHash();
  } catch (e) {
    $('source-title').textContent = 'Ledger unavailable';
    $('source-detail').replaceChildren(e.message, ' · ', el('a', { href: '?source=audit', text: 'Open the dated audit' }));
    $('meta').replaceChildren(el('a', { href: PUBLIC_LEDGER, text: 'Public main ledger' }));
  }
}

main();

'use strict';

// The ledger lives in the OPH repository; this page reads it on every visit.
const REPO = 'FloatingPragma/observer-patch-holography';
const PATH = 'docs/registers/OBSERVABLES.json';
const BLOB = `https://github.com/${REPO}/blob/main/`;
const STATUSES = ['Demonstrated', 'Conditional', 'Partial', 'Open'];
const GLYPH = { Demonstrated: '●', Conditional: '◐', Partial: '◔', Open: '○' };
const BASE = { Demonstrated: 1, Conditional: 0.5, Partial: 0.25, Open: 0 };

const state = { kind: 'observable', statuses: new Set(STATUSES), query: '' };
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
const WEIGHTING = 'Weighted completion: each observable scores demonstrated 1, partial 1/4, open 0. A conditional one scores 1/2 plus half the mean score of the premises it waits on (premises score on the same scale), so it rises as those premises are demonstrated. The figure is the mean score over the rows.';
const tip = (text) => el('span', { class: 'tip', tabindex: '0', role: 'note', 'aria-label': text, 'data-tip': text, text: '?' });

async function load() {
  // Local preview: ?data=<same-origin relative path>.
  const local = new URLSearchParams(location.search).get('data');
  if (local && /^[\w./-]+$/.test(local) && !local.includes('..')) {
    return { data: await (await fetch(local, { cache: 'no-store' })).json(), commit: null };
  }
  let commit = null;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/commits?path=${PATH}&per_page=1`);
    if (r.ok) {
      const c = (await r.json())[0];
      if (c) commit = { sha: c.sha, date: c.commit.committer.date, url: c.html_url };
    }
  } catch (e) { /* the API is optional */ }
  const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${commit ? commit.sha : 'main'}/${PATH}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`ledger request failed (${r.status})`);
  return { data: await r.json(), commit };
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

function score(r) {
  if (r.status !== 'Conditional') return BASE[r.status] ?? 0;
  const ps = r.premises.map((p) => BY_ID.get(p)).filter(Boolean);
  const mean = ps.length ? ps.reduce((a, p) => a + (BASE[p.status] ?? 0), 0) / ps.length : 0;
  return 0.5 + 0.5 * mean;
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

  const c = counts(obs);
  const completion = obs.reduce((a, r) => a + score(r), 0) / (obs.length || 1);
  const stat = (v, small, l, help) => el('div', { class: 'stat' }, el('span', { class: 'v' }, v, small ? el('small', { text: small }) : null), el('span', { class: 'l' }, l, help ? tip(help) : null));
  $('stats').replaceChildren(
    stat(pct(completion), null, 'completion', WEIGHTING),
    stat(String(c.Demonstrated), `/ ${obs.length}`, 'observables demonstrated'),
    stat(String(c.Demonstrated + c.Conditional), `/ ${obs.length}`, 'demonstrated or derived'),
  );
  $('bar').replaceWith(bar(obs));
  $('legend').replaceChildren(...STATUSES.map((s) => {
    const b = el('button', { 'aria-pressed': 'true', 'data-status': s }, glyph(s), ` ${s.toLowerCase()} `, el('b', { text: String(c[s]) }));
    b.addEventListener('click', () => toggleStatus(s));
    return b;
  }));
  const blockers = [...WAITING.entries()]
    .map(([p, rs]) => [BY_ID.get(p), rs.filter((r) => r.status !== 'Demonstrated').length])
    .filter(([p, n]) => p && p.status !== 'Demonstrated' && n > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  $('blocking').replaceChildren(...(blockers.length ? [
    el('span', { class: 'h', text: 'premises holding up the most observables' }),
    el('ol', {}, blockers.map(([p, n]) => el('li', {},
      el('span', { class: 'n', text: String(n) }),
      el('span', {}, glyph(p.status), ' ', el('a', { href: `#${p.id}`, text: p.name }))))),
  ] : []));
  const rules = data.statuses || {};
  $('rules').replaceChildren(...STATUSES.flatMap((s) => [
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
  return el('a', { href: BLOB + path, title: path, text: base });
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
    const share = whole.reduce((a, r) => a + score(r), 0) / (whole.length || 1);
    return el('section', { class: 'group' },
      el('h2', { title: `weighted completion of ${whole.length} rows` }, cat.toUpperCase(), el('span', { class: 'n', text: `${Math.round(100 * share)}%` }), tip(WEIGHTING)),
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
    const { data, commit } = await load();
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
    $('meta').replaceChildren(...(commit
      ? ['updated ', el('a', { href: commit.url, text: new Date(commit.date).toISOString().slice(0, 10) })]
      : ['']));
    renderTally(data);
    renderList();
    for (const b of document.querySelectorAll('.switch button')) b.addEventListener('click', () => setKind(b.dataset.kind));
    $('search').addEventListener('input', (e) => { state.query = e.target.value.trim().toLowerCase(); renderList(); });
    window.addEventListener('hashchange', openHash);
    openHash();
  } catch (e) {
    $('meta').replaceChildren(`the ledger could not be loaded (${e.message}); read it at `, el('a', { href: BLOB + PATH, text: PATH }));
  }
}

main();

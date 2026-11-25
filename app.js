'use strict';

// The ledger lives in the OPH repository; this page reads it on every visit.
const REPO = 'FloatingPragma/observer-patch-holography';
const PATH = 'docs/registers/OBSERVABLES.json';
const BLOB = `https://github.com/${REPO}/blob/main/`;
const STATUSES = ['Demonstrated', 'Conditional', 'Partial', 'Open'];

const state = { kind: 'observable', statuses: new Set(STATUSES), category: '', query: '' };
let ROWS = [];
let BY_ID = new Map();
let WAITING = new Map(); // premise id -> observable rows that list it

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

async function load() {
  // Local testing: ?data=<same-origin relative path>.
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
  const ref = commit ? commit.sha : 'main';
  const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${ref}/${PATH}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`ledger request failed (${r.status})`);
  return { data: await r.json(), commit };
}

function counts(rows) {
  const c = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of rows) if (r.status in c) c[r.status] += 1;
  return c;
}

function segbar(rows, tall) {
  const c = counts(rows);
  const total = rows.length || 1;
  const bar = el('div', { class: `segbar ${tall ? 'tall' : 'thin'}`, role: 'img' });
  const parts = [];
  for (const s of STATUSES) {
    if (!c[s]) continue;
    const share = Math.round((100 * c[s]) / total);
    parts.push(`${s} ${c[s]} (${share}%)`);
    const seg = el('span', { class: `seg-${s}`, title: `${s}: ${c[s]} of ${rows.length} (${share}%)` });
    seg.style.flex = `${c[s]} 1 0`;
    if (tall && c[s] / total >= 0.07) seg.textContent = `${share}%`;
    bar.append(seg);
  }
  bar.setAttribute('aria-label', parts.join(', '));
  return bar;
}

function renderSummary(data) {
  const obs = ROWS.filter((r) => r.kind === 'observable');
  const prem = ROWS.filter((r) => r.kind === 'premise');
  const c = counts(obs);
  $('hero-value').textContent = `${c.Demonstrated} of ${obs.length}`;
  $('hero-label').textContent = 'observables demonstrated';
  $('segbar').replaceWith(Object.assign(segbar(obs, true), { id: 'segbar' }));
  $('legend').replaceChildren(...STATUSES.map((s) =>
    el('li', {}, el('span', { class: `dot ${s}` }), el('span', {}, el('b', { text: s }), ` ${c[s]}`))));
  const open = prem.filter((r) => r.status !== 'Demonstrated').length;
  $('premise-line').replaceChildren(
    el('b', { text: String(open) }),
    ` of ${prem.length} finite-theorem premises need confirmation by the executable model. `,
    el('a', { href: '#', id: 'to-premises', text: 'Show premises' }));
  $('to-premises').addEventListener('click', (e) => { e.preventDefault(); setKind('premise'); });
  const rules = data.statuses || {};
  $('rules').replaceChildren(...STATUSES.flatMap((s) => [
    el('dt', {}, el('span', { class: `dot ${s}` }), s),
    el('dd', { text: rules[s] || '' }),
  ]));
  $('n-observable').textContent = obs.length;
  $('n-premise').textContent = prem.length;
  $('summary').hidden = false;
  $('controls').hidden = false;
}

function renderChips() {
  const rows = ROWS.filter((r) => r.kind === state.kind);
  const c = counts(rows);
  $('chips').replaceChildren(...STATUSES.map((s) => {
    const b = el('button', { class: 'chip', 'aria-pressed': String(state.statuses.has(s)) },
      el('span', { class: `dot ${s}` }), s, el('span', { class: 'n', text: String(c[s]) }));
    b.addEventListener('click', () => {
      if (state.statuses.has(s) && state.statuses.size === STATUSES.length) state.statuses = new Set([s]);
      else if (state.statuses.has(s)) state.statuses.delete(s);
      else state.statuses.add(s);
      if (!state.statuses.size) state.statuses = new Set(STATUSES);
      renderChips();
      renderList();
    });
    return b;
  }));
  const cats = [...new Set(rows.map((r) => r.category))];
  if (!cats.includes(state.category)) state.category = '';
  $('category').replaceChildren(el('option', { value: '', text: 'All categories' }),
    ...cats.map((cat) => el('option', { value: cat, text: cat })));
  $('category').value = state.category;
}

function link(path) {
  if (/^https?:\/\//.test(path)) return el('a', { class: 'ref', href: path, text: path.replace(/^https?:\/\//, '') });
  return el('a', { class: 'ref mono', href: BLOB + path, text: path });
}

function rowRef(id) {
  const r = BY_ID.get(id);
  if (!r) return el('span', { class: 'ref mono', text: id });
  return el('a', { class: 'ref', href: `#${id}` }, el('span', { class: `dot ${r.status}` }), r.name);
}

function section(title, nodes) {
  if (!nodes || !nodes.length) return null;
  return [el('h3', { text: title }), el('div', { class: 'refs' }, nodes)];
}

function detail(r) {
  const d = el('div', { class: 'detail' });
  if (r.summary) d.append(el('p', { class: 'lead', text: r.summary }));
  if (r.kind === 'premise' && r.statement) d.append(el('p', {}, el('b', { text: 'Premise. ' }), r.statement));
  if (r.why) d.append(el('p', { text: r.why }));
  const kv = [];
  if (r.value) kv.push(el('dt', { text: 'OPH' }), el('dd', { text: r.value }));
  if (r.observed) kv.push(el('dt', { text: 'Observed' }), el('dd', { text: r.observed }));
  if (r.premise_kind) kv.push(el('dt', { text: 'Kind' }), el('dd', { text: r.premise_kind }));
  if (kv.length) d.append(el('dl', { class: 'kv' }, kv));
  d.append(...(section('Waits on premises', (r.premises || []).map(rowRef)) || []));
  if (r.kind === 'premise') {
    d.append(...(section('Observables waiting on this premise', (WAITING.get(r.id) || []).map((o) => rowRef(o.id))) || []));
    d.append(...(section('Used by', (r.used_by || []).map((u) => (/[/.]/.test(u) && !/\s/.test(u) ? link(u) : el('span', { class: 'ref mono', text: u })))) || []));
  }
  d.append(...(section('Papers', (r.papers || []).map(link)) || []));
  d.append(...(section('Proofs and code', (r.code || []).map(link)) || []));
  d.append(...(section('Claims', (r.claims || []).map((c) => el('span', { class: 'ref mono', text: c }))) || []));
  const foot = [el('span', { class: 'id mono', text: r.id })];
  if (r.tags && r.tags.length) foot.push(' · ', el('span', { class: 'tags', text: r.tags.join(', ') }));
  d.append(el('p', {}, foot));
  return d;
}

function rowNode(r) {
  const node = el('details', { class: 'row', id: r.id },
    el('summary', {},
      el('span', { class: 'name', text: r.name }),
      el('span', { class: 'badge' }, el('span', { class: `dot ${r.status}` }), r.status)));
  node.addEventListener('toggle', () => {
    if (node.open && !node.querySelector('.detail')) node.append(detail(r));
  }, { once: false });
  return node;
}

function matches(r) {
  if (r.kind !== state.kind || !state.statuses.has(r.status)) return false;
  if (state.category && r.category !== state.category) return false;
  if (!state.query) return true;
  const hay = [r.id, r.name, r.summary, r.why, r.statement, r.category, ...(r.tags || []), ...(r.claims || [])]
    .join(' ').toLowerCase();
  return state.query.split(/\s+/).every((w) => hay.includes(w));
}

function renderList() {
  const rows = ROWS.filter(matches);
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.category)) groups.set(r.category, []);
    groups.get(r.category).push(r);
  }
  const all = ROWS.filter((r) => r.kind === state.kind);
  $('list').replaceChildren(...[...groups].map(([cat, items]) => {
    const whole = all.filter((r) => r.category === cat);
    const done = whole.filter((r) => r.status === 'Demonstrated').length;
    return el('section', { class: 'group' },
      el('div', { class: 'group-head' },
        el('h2', {}, cat, el('span', { class: 'n', text: `${done} of ${whole.length} demonstrated` })),
        segbar(whole, false)),
      items.map(rowNode));
  }));
  $('empty').hidden = rows.length > 0;
}

function setKind(kind) {
  state.kind = kind;
  for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.kind === kind));
  state.statuses = new Set(STATUSES);
  renderChips();
  renderList();
}

function openHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const r = BY_ID.get(id);
  if (!r) return;
  if (r.kind !== state.kind || !matches(r)) {
    state.statuses = new Set(STATUSES);
    state.category = '';
    state.query = '';
    $('search').value = '';
    setKind(r.kind);
  }
  const node = document.getElementById(id);
  if (node) {
    node.open = true;
    node.scrollIntoView({ block: 'start' });
  }
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

async function main() {
  try {
    const { data, commit } = await load();
    ROWS = data.rows || [];
    BY_ID = new Map(ROWS.map((r) => [r.id, r]));
    WAITING = new Map();
    for (const r of ROWS) {
      if (r.kind !== 'observable') continue;
      for (const p of r.premises || []) {
        if (!WAITING.has(p)) WAITING.set(p, []);
        WAITING.get(p).push(r);
      }
    }
    const meta = $('meta');
    if (commit) {
      meta.replaceChildren('Ledger updated ', el('a', { href: commit.url, text: formatDate(commit.date) }), '.');
    } else {
      meta.textContent = '';
    }
    renderSummary(data);
    renderChips();
    renderList();
    for (const b of document.querySelectorAll('.tabs button')) b.addEventListener('click', () => setKind(b.dataset.kind));
    $('category').addEventListener('change', (e) => { state.category = e.target.value; renderList(); });
    $('search').addEventListener('input', (e) => { state.query = e.target.value.trim().toLowerCase(); renderList(); });
    window.addEventListener('hashchange', openHash);
    openHash();
  } catch (e) {
    $('meta').replaceChildren(`The ledger could not be loaded (${e.message}). It is available at `,
      el('a', { href: BLOB + PATH, text: PATH }), '.');
  }
}

main();

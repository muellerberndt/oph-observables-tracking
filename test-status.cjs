const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const code = fs.readFileSync(__dirname + '/app.js', 'utf8').replace(/\nmain\(\);\s*$/, '');
const directory = __dirname + '/snapshots/2026-11-26/';
const audit = fs.readFileSync(directory + 'OBSERVABLES.json');
const manifest = fs.readFileSync(directory + 'evidence.json');
const classifiedLedger = JSON.parse(audit);
const oldLedger = { rows: [{ kind: 'observable', status: 'Open' }] };

function script(upstream, search = '') {
  const fetch = async (path) => {
    if (path.startsWith('https://api.github.com/')) return Response.json([]);
    if (path.startsWith('https://raw.githubusercontent.com/')) {
      if (!upstream) throw Error('offline');
      return Response.json(upstream);
    }
    if (path.endsWith('/OBSERVABLES.json')) return new Response(audit);
    if (path.endsWith('/evidence.json')) return new Response(manifest);
    throw Error('Unexpected path ' + path);
  };
  const context = vm.createContext({
    fetch, AbortSignal, URLSearchParams, TextDecoder, crypto: webcrypto,
    location: { search, href: 'https://status.floatingpragma.ai/' + search },
  });
  vm.runInContext(code, context);
  return (expression) => vm.runInContext(expression, context);
}

test('choose the classified upstream, with dated audit fallback and explicit source overrides', async () => {
  for (const [upstream, query, expected] of [
    [oldLedger, '', 'audit'], [null, '', 'audit'],
    [classifiedLedger, '', 'public'], [oldLedger, '?source=public', 'public'],
    [classifiedLedger, '?source=audit', 'audit'],
  ]) {
    const result = await script(upstream, query)('load()');
    assert.equal(result.source.kind, expected);
  }
});

test('score validated physical scopes and keep missing or unknown evidence out of credit', async () => {
  const run = script(null, '?source=audit');
  const [total, units, demonstrated] = await run(`(async () => {
    ROWS = (await load()).data.rows;
    BY_ID = new Map(ROWS.map(r => [r.id, r]));
    const eligible = targets(ROWS.filter(r => r.kind === 'observable'));
    return [eligible.length, eligible.reduce((v, r) => v + score(r), 0),
      eligible.filter(r => r.status === 'Demonstrated' && score(r) === 1).length];
  })()`);
  assert.deepEqual([total, units, demonstrated], [146, 10.75, 1]);
  for (const scope of ['formalism', 'unestablished', 'comparison', 'state calculation', 'apparatuz', '']) {
    assert.equal(run(`score({kind:'observable', scope:${JSON.stringify(scope)}, status:'Demonstrated'})`), 0);
    assert.equal(run(`score({kind:'observable', scope:${JSON.stringify(scope)}, status:'Conditional', premises:['PR-52']})`), 0);
  }
  assert.equal(run("score({kind:'premise', status:'Demonstrated'})"), 1);
});

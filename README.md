# OPH observable status

The page behind [status.floatingpragma.ai](https://status.floatingpragma.ai/): every observable Observer
Patch Holography must reproduce, and every premise of its finite theorems that the executable model has to
confirm. Each row opens to one sentence on what it is, one on why it matters, and links to the Lean proofs,
executable model evidence and papers.

The ledger lives in the OPH repository as
[`docs/registers/OBSERVABLES.json`](https://github.com/FloatingPragma/observer-patch-holography/blob/main/docs/registers/OBSERVABLES.json),
documented in its `docs/registers/README.md`. This page holds no copy: on every visit it asks the GitHub API
for the last commit that touched the ledger and reads the file at that commit (falling back to `main`).

## Completion

Each observable scores demonstrated 1, partial 1/4, open 0. A conditional observable scores 1/2 plus half
the mean score of the premises it waits on. Completion is the mean over all observables. The page also lists
the premises that hold up the most observables.

## Files

`index.html`, `style.css` and `app.js` are the whole site, with no build step. `CNAME` binds the custom
domain for GitHub Pages. Local preview: serve the folder (`python3 -m http.server`) and open `index.html`,
or pass a same-origin copy of the ledger with `?data=<file>.json`.

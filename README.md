# OPH observable status

The page behind [status.floatingpragma.ai](https://status.floatingpragma.ai/): the completion ledger of
Observer Patch Holography. It lists every observable the theory must reproduce and every premise of its
finite theorems that the executable model has to confirm, each with its status and the papers, Lean proofs
and code it rests on.

The ledger itself lives in the OPH repository as
[`docs/registers/OBSERVABLES.json`](https://github.com/FloatingPragma/observer-patch-holography/blob/main/docs/registers/OBSERVABLES.json).
This page holds no copy. On every visit it asks the GitHub API for the last commit that touched the ledger
and reads the file at that commit, so a push to the OPH repository shows here at once. Without the API it
falls back to the file on `main`.

## Statuses

| Status | Meaning |
| --- | --- |
| Demonstrated | A theorem or derivation chain whose premises need no confirmation from the executable model, or a committed executable result whose observer records exhibit the observable. |
| Conditional | Proved, with at least one premise that the executable model does not yet confirm. The row names those premises. |
| Partial | Part of the observable is shown: some clauses, a restricted domain, or a retrospective comparison. |
| Open | No result in the current material. |

The ledger file carries the binding wording of these definitions in its `statuses` field.

## Files

`index.html`, `style.css` and `app.js` are the whole site, with no build step. `CNAME` binds the custom
domain for GitHub Pages. For a local preview, serve the folder (`python3 -m http.server`) and open
`index.html`, or pass a same-origin copy of the ledger with `?data=<file>.json`.

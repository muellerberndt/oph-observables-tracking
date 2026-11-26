# OPH observable status

[OPH observable status](https://status.floatingpragma.ai/) lists the program's physical targets, formal results, comparisons, predictions, questions and theorem premises. Expand a row to see its claim, evidence scope and references.

The default view reads the latest public research ledger. A public revision with target classes and scopes for every observable takes precedence automatically. While public main uses the earlier schema, or when GitHub is unavailable, the site displays the dated local research audit. Each view identifies its source above the score.

- [26 November 2026 local audit](https://status.floatingpragma.ai/?source=audit). The site serves the exact audited ledger with its SHA-256 verified against the [evidence manifest](snapshots/2026-11-26/evidence.json). The manifest identifies the local base, the immutable public comparison revision and the Git blob hash of every cited file. Of the 2,311 distinct evidence paths, 1,741 matched the public file byte for byte and link to that revision. The other 570 are labelled local and include files whose public counterparts differ.
- [Ongoing public main](https://status.floatingpragma.ai/?source=public). The site requests the latest commit touching [the research ledger](https://github.com/FloatingPragma/observer-patch-holography/blob/main/docs/registers/OBSERVABLES.json) and loads its JSON. References use that commit. When the GitHub commit API is unavailable, the raw main branch serves the public view. Older ledgers show row statuses without a physical-target percentage.

## Completion

The denominator contains physical observable targets. A demonstrated target with a qualifying evidence scope receives one unit. A partial target with a qualifying scope receives one quarter. A conditional physical target receives the value of its weakest physical or unfulfilled premise. Comparisons, state calculations, purely formal evidence and unestablished evidence receive zero physical credit. Formal targets, forecasts, benchmark comparisons and philosophical questions have their own rows outside the denominator.

## Preview

There is no build step. Serve the repository with `python3 -m http.server`. The default, `?source=audit` and `?source=public` routes work on localhost. To inspect an alternate same-origin ledger, use `?data=<file>.json`. GitHub Pages serves the main branch at the custom domain in `CNAME`.

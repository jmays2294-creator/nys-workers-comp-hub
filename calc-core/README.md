# calc-core: the single source of truth for every calculation

`calc-core.js` is The Comp Desk's one calculation engine for New York State workers' compensation: the WCB maximum
and minimum weekly rates by date of accident, average weekly wage, TT/TPD rates, schedule loss of use (with the
protracted healing credit), LWEC, CCP and award periods, Section 32 settlements (with liens), Burns, and the
attorney fee and its splits.

Everything computes from this one file: the Comp Desk website and app calculators, the Pro Workspace, the Chrome
extension, Comp Buddy, and this hub's calculation tools (the hub's server runs a generated copy of it). No skill keeps
its own rate table or formula. That is what lets a user rely on the hub's figures without re-checking them.

## Where it comes from

| | |
|---|---|
| Source | `www/js/calc-core.js` in the private `thecompdesk-app` repository |
| Copied from commit | `ed399f14737d4532dd9a780b705f1b1a01e564c8` (2026-11-16) |
| SHA-256 | `b83020ffff66dd0f3bbd6a32719a01753c72f97d557759b0a489acb9735cc0c1` |

Do not edit this copy. A change is made in the source file, tested there, and then copied here with this table
updated. This folder is outside the plugin (`nys-workers-comp-hub/`), so the installed plugin is not changed by it.

## Checks (sync targets)

Independent checks, such as Fee Calculator 6.0 and the fee-calc formula sync, MTG sync and statute drift sync, run
against this file as tests. They verify calc-core; they are never the basis for a figure. If a check disagrees with
calc-core, the run fails and the difference is resolved in the source before anything ships.

## Using it

Plain JavaScript, no dependencies, no network. In Node: `const Calc = require('./calc-core.js')`. In a browser it
attaches to `window.CD.Calc`. Examples (date of accident 2025-09-15):

```js
Calc.maxRateForDOA('2025-09-15');                // 1222.42
Calc.minRateForDOA('2025-09-15');                // 325
Calc.getCappedTT(2400, 1222.42, 325);            // 1222.42 (capped at the maximum)
Calc.computeSLU({ rows: [{ bp: 'Arm', pct: 25 }], tt: 800 }); // 78 weeks, $62,400 gross, $9,360 fee, $53,040 net
```

## Locked: changes need the maintainers' approval

Once the maintainers have confirmed every calculation, `calc-core.js` and the tests that check it are locked. Only
the four maintainers may edit them, and any change needs the approval of all four, or at least a majority. Each
change records who proposed it, who approved it, and why. These are the formulas every user relies on, so every
change to them is accountable.

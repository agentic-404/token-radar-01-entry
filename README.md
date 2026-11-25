[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/agentic-404/token-radar-01-entry/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/agentic-404/token-radar-01-entry/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Radar — radar-6

A token launch radar: it reads a sealed DefiLlama snapshot of the protocol universe and ranks pre-token protocols by implied launch value, with a costed farm plan and launch odds for each. Built for [make.fun](https://make.fun/bounty/token-radar-01) (`token-radar-01`).

## The model (radar-6)

1. **Comps-fitted value.** The value model is fitted from the snapshot's own live tokens (128 protocols with a market cap): a log-log size curve, `log10(mcap) = slope × log10(TVL) + category level`, where the slope is a Theil–Sen robust fit (0.5554 on this snapshot) and each category level is the median of its live tokens' residuals, shrunk toward the global level. The snapshot carries market cap, not fully-diluted value, so every multiple is honestly a market-cap multiple. Large protocols trade at lower multiples — the slope is below 1 — so implied value grows slower than TVL; that is the live tokens' own record.
2. **Two blind tests, not one.** Every candidate term is tested twice: leave-one-out (each live token held out, the rest refit, the held-out one predicted) and walk-forward (fit on the older-listed half of live tokens, predict the newer half). A term is kept only when it improves either test by at least 1% without worsening the other by more than 0.5%. Growth survives both; maturity is neutral on leave-one-out and clearly helps the walk-forward, so it stays; breadth fails both and is dropped. Measured on this snapshot: base (size curve only) LOO ×3.90 / WF ×3.39; + growth LOO ×3.69 / WF ×3.35; **+ growth + maturity LOO ×3.68 / WF ×3.24** (selected); + all three LOO ×3.91 / WF ×3.49. A second walk-forward split (oldest 60% → newest 40%) gives ×3.31 for the selected model.
3. **Growth is negative on purpose.** The fitted growth coefficient is −0.73: the live-token record says the fastest 7-day growers trade at lower market-cap multiples — fast growth reverts. A protocol that grew +10% in a week is discounted to ×0.84; one that shrank −10% is lifted to ×1.18. The dashboard says this next to the number, with the blind-test table behind it. Read it as mean-reversion in the fitted record, not a bug.
4. **Age lifts value, and odds come from the peers' record.** The maturity coefficient is +0.61: a 45-day-old protocol carries ×0.75, a 1-year-old ×0.86, a 4-year-old ×0.98. Beside it, every row carries launch odds from the peers' record — the share of protocols of its age that still record no token: under 1 year 68%, 1–2 years 62%, 2–3 years 45%, over 3 years 21%. Older pre-token protocols have smaller odds, because most of their age peers already carry a token. The odds are a record, not a prediction that a token launches, and they do not multiply the implied value: the fitted maturity term already carries age into value.
5. **No verdict.** Every row carries a seven-step farm plan with its own costs and hold time (total cost and time first, then setup, the category action on its chains, cadence, a top-up, a concrete exit trigger with tranche unwind, and one safety line). The board's job is to show how to farm each one — no row is stamped SKIP.
6. **Uncertainty as a bar, not a boast.** 200 bootstrap refits (fixed seed) give every row a P10–P90 band and a rank range. The table shows the band as a bar; the full numbers live in the detail view. A rank is a range, not a point.

No protocol name is ever special-cased: one function scores every row. The board covers the 40-protocol watchlist plus the 158 pre-token protocols below the floor (198 rows).

## Run it

Node 22, standard library only, no network. Fully deterministic: the same snapshot bytes write byte-identical output.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

This writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output directory. The dashboard is a static page (no framework, no network) that reads `data.js` beside it.

## Layout

- `main.ts` — the entry point: reads the snapshot, writes the board, data, dashboard, screenshots and dossier.
- `lib/model.ts` — radar-6: the fit, the two blind tests, the bootstrap, the launch odds, the farm plans, the board gate.
- `dashboard/` — `index.html`, `app.css`, `app.js`: the static dashboard.
- `screenshots/` — the board, a detail view and a filtered view.
- `vendor/makefun-board.ts` — make.fun's dossier library, byte for byte the scorer's own copy.

## About

Token Radar ranks pre-token protocols by implied launch value, with a farm plan for each — built so a reader can answer "which pre-token protocol is worth farming next, and what do I do about it" from the board alone. Implied value is a model, not a price, and never a prediction that a token launches.

<sub>Entered on [make.fun](https://make.fun/?ref=dp1radt1&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

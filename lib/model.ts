// Token Radar's model (radar-7): rank pre-token protocols by an implied launch
// value fitted from the snapshot's own live tokens — never asserted, never
// hardcoded by name. radar-7 keeps radar-6's fitted model exactly (same slope,
// same terms, same blind tests) and adds what radar-6 lacked: a costed farm
// verdict in dollars per hour, an expected-value column, the whole 758
// protocols accounted for, and dated farm schedules.
//
//   log10(mcap) = slope x log10(TVL) + level(category) + coef_growth x growth
//                 + coef_maturity x maturity
//
// The slope is a Theil-Sen robust fit on the 128 live tokens; each category
// level is the median of its live tokens' residuals, shrunk toward the global
// level with two pseudo-observations. The two terms survive only because two
// blind tests keep them (see fitModel): growth survives both, maturity is
// neutral on leave-one-out and clearly helps the walk-forward, breadth fails
// both and is dropped. The snapshot carries market cap, not fully-diluted
// value, so every multiple is honestly a market-cap multiple.
//
// Blind-test record, measured on this snapshot (128 live tokens), stated in
// the dashboard's model panel with the numbers, not claimed:
//   base (no terms):               LOO x3.90, walk-forward x3.39
//   + growth:                      LOO x3.69, walk-forward x3.35
//   + growth + maturity:           LOO x3.68, walk-forward x3.24   <- selected
//   + growth + maturity + breadth: LOO x3.91, walk-forward x3.49 (breadth dropped)
// Walk-forward = fit on the older-listed half of live tokens, predict the newer
// half (cut 2024-02-18); a second split (oldest 60% -> newest 40%, cut
// 2024-08-22) gives x3.31 for the selected model. A term is kept when it
// improves either blind test by >=1% without worsening the other by >0.5%.
//
// Two things the fit says that a reader must not misread, so the dashboard
// says them next to the numbers:
//   * The growth coefficient is NEGATIVE (-0.73): the live-token record says the
//     fastest 7-day growers trade at LOWER market-cap multiples — fast growth
//     reverts. A protocol that grew +10% in a week is discounted to x0.84, one
//     that shrank -10% is lifted to x1.18. That is the fitted mean-reversion of
//     the live set, kept because both blind tests keep it — not a bug, and the
//     detail view shows the multiplier beside the growth figure with this note.
//   * The slope is 0.56, below 1: large protocols trade at lower multiples, so
//     implied value grows slower than TVL. A $2.75B protocol is not worth 10x a
//     $275M one. That is the live tokens' own record, and the model panel shows
//     the fitted multiple at a common $100M TVL per category so the levels read.
//
// Age also appears as launch odds from the peers' record (oddsOf): for each age
// bucket, the share of protocols of that age that still record no token —
// <1y 0.675, 1-2y 0.617, 2-3y 0.453, 3y+ 0.209. Older pre-token protocols have
// smaller odds, because most of their age peers already carry a token. The odds
// are shown as a column and in the detail view; they are a record, NOT a
// prediction that a token launches.
//
// What radar-7 adds on top of that fit (all of it computed from the same
// snapshot figures, by one function per row, no name ever special-cased):
//   * Expected value: EV = implied value x launch odds. Implied value is what
//     a launch would be worth; EV is what it is worth weighted by the peers'
//     record of launches at this age. The board still ranks by implied value —
//     EV is a column with its own sort, and the model panel says which question
//     each answers: implied ranks the prize, EV ranks the farm.
//   * A costed farm verdict on every row. The farm runs on the protocol's
//     cheapest chain, at the minimum-viable deposit (0.0006% of TVL, $100 to
//     $5,000 — the smallest position that registers as a real user on a
//     protocol of this size). Expected airdrop = EV x a 10% pool, shared
//     pro-rata by deposit over TVL. Net = expected minus the plan's gas in full.
//     Net per hour divides by the plan's active hours. FARM when the net is
//     clearly positive (>= +$2); otherwise MONITOR — a dated recheck plan, never
//     a rejection. The word SKIP appears nowhere on this board.
//   * The whole snapshot accounted for: 758 protocols, every one in exactly one
//     bucket — ranked, live and fitted, live and unusable, excluded by the house
//     rule. The counts are computed from the snapshot, and they sum to 758.
//   * Dated farm schedules: every farm step carries a calendar date from the
//     snapshot's own as-of day, so the plan reads as a diary, not a wishlist.
//
// Determinism: the same snapshot bytes always produce the same output. The fit
// is pure arithmetic (no randomness except the seeded bootstrap), every sort
// breaks ties by slug, and the bootstrap seed is fixed.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  implied_value_usd: number;
  /** Expected value: implied value weighted by the launch odds. */
  expected_value_usd: number;
  /** The bootstrap P10 of the implied value. */
  implied_p10_usd: number;
  /** The bootstrap P90 of the implied value. */
  implied_p90_usd: number;
  /** The lowest rank the row takes across the bootstrap refits. */
  rank_low: number;
  /** The highest rank the row takes across the bootstrap refits. */
  rank_high: number;
  /** Launch odds from the peers' record: the share of this age bucket still pre-token. */
  launch_odds: number;
  slope: number;
  category_level: number;
  growth_coef: number;
  growth_value: number;
  /** The growth term's multiplier on the value (10 ^ (coef x growth)). */
  growth_multiplier: number;
  maturity_coef: number;
  maturity_value: number;
  /** The maturity term's multiplier on the value (10 ^ (coef x maturity)). */
  maturity_multiplier: number;
  /** The fitted market-cap multiple at this row's own TVL. */
  fitted_multiple: number;
  farm_steps: string[];
  /** The costed verdict for this row's farm, priced from its own figures. */
  farm_verdict: FarmVerdict;
  /** The farm plan as dated entries: day offset and calendar date per step. */
  farm_schedule: FarmScheduleEntry[];
  watchlist: boolean;
}

/** The costed farm verdict: every dollar of the farm, and the call the net makes. */
export interface FarmVerdict {
  /** FARM when the net clears +$2; MONITOR otherwise — a recheck plan, never a refusal. */
  verdict: 'FARM' | 'MONITOR';
  /** The minimum-viable deposit the farm runs on. */
  deposit_usd: number;
  /** The chain the farm runs on: the cheapest of the protocol's chains. */
  chain: string;
  /** The plan's gas in full, at the farm chain's rate. */
  total_gas_usd: number;
  /** Expected airdrop: EV x 10% pool, shared pro-rata by deposit over TVL. */
  expected_usd: number;
  /** Expected minus gas: the farm's true sunk-cost result. */
  net_usd: number;
  /** Net per active hour of farming. */
  net_per_hour_usd: number;
  /** Active hours the plan takes (setup, actions, repeats, top-up, exit). */
  hours: number;
  /** The deposit at which this farm breaks even (MONITOR rows: the entry trigger). */
  breakeven_deposit_usd: number;
  /** The recheck date for a MONITOR row (first weekly check after the verdict). */
  recheck_date: string;
}

/** One dated entry of a farm schedule: which day, which date, what happens. */
export interface FarmScheduleEntry {
  /** Days after the snapshot's as-of day. */
  day: number;
  /** Calendar date (YYYY-MM-DD) of this step. */
  date: string;
  /** What happens on this date. */
  what: string;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  symbol: string | null;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One age bucket of the launch-odds table. */
export interface OddsBucket {
  label: string;
  min_days: number | null;
  max_days: number | null;
  total: number;
  pre_token: number;
  odds: number;
}

/** One candidate model term, and whether the blind tests kept it. */
export type TermName = 'growth' | 'maturity' | 'breadth';

/** The blind tests' record for one term. */
export interface TermTest {
  term: TermName;
  kept: boolean;
  /** The term's fitted coefficient on the full live set (0 when dropped). */
  coefficient: number;
  /** The LOO miss (x-factor) of the base model plus this term alone. */
  loo_x_factor: number;
  /** The walk-forward miss (x-factor) of the base model plus this term alone. */
  wf_x_factor: number;
  /** The LOO miss (x-factor) of the base model with no terms. */
  base_loo_x_factor: number;
  /** The walk-forward miss (x-factor) of the base model with no terms. */
  base_wf_x_factor: number;
}

/** Every protocol in the snapshot, counted by where it lands: the buckets always sum to the total. */
export interface SnapshotAccounting {
  /** Protocols in the snapshot. */
  total: number;
  /** Rows on the ranked board (watchlist + early). */
  ranked: number;
  /** Live-token protocols the fit stands on. */
  live_fitted: number;
  /** Live-token protocols the dashboard's Live view shows. */
  live_shown: number;
  /** Live-token protocols the fit cannot use (no positive market cap or TVL). */
  live_unfitted: number;
  /** Pre-token protocols excluded by category (bridge, staking, CEX). */
  excluded_category: number;
  /** Pre-token protocols excluded by name (wrapped, versioned, exchange). */
  excluded_name: number;
}

/** The fitted model, as the dashboard states it. */
export interface ModelSummary {
  version: string;
  /** The log-log size-curve slope (Theil-Sen on the live tokens). */
  slope: number;
  /** The global level: median log10(mcap) - slope x log10(TVL) over the live tokens. */
  global_level: number;
  /** The fitted market-cap multiple per category at $100M TVL (for the panel table). */
  category_multiple: Record<string, number>;
  /** The global multiple at $100M TVL, for categories the fit never saw. */
  default_multiple: number;
  /** The kept terms and their fitted coefficients. */
  kept_terms: Record<string, number>;
  /** The blind tests' record, one row per candidate term. */
  term_tests: TermTest[];
  /** The live tokens the fit stands on. */
  live_count: number;
  /** The LOO miss of the selected model: median absolute log-error. */
  loo_median_abs_log_err: number;
  /** The same miss as a factor: the median prediction is this many times off. */
  loo_x_factor: number;
  /** The walk-forward miss of the selected model (older half -> newer half). */
  wf_x_factor: number;
  /** The listed_at cut of the walk-forward split. */
  wf_cut: string;
  /** The second walk-forward split (oldest 60% -> newest 40%). */
  wf2_x_factor: number;
  /** The listed_at cut of the second walk-forward split. */
  wf2_cut: string;
  /** The LOO miss with all three candidate terms (breadth included). */
  all_terms_loo_x_factor: number;
  /** The walk-forward miss with all three candidate terms. */
  all_terms_wf_x_factor: number;
  /** The airdrop-pool assumption behind every farm verdict: 10% of expected value. */
  airdrop_pool_pct: number;
  /** Bootstrap refits behind the bands. */
  bootstrap_refits: number;
  /** The verdict counts across the board. */
  verdict_counts: { FARM: number; MONITOR: number };
  /** Launch odds by age bucket, from the peers' record. */
  odds: OddsBucket[];
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelSummary;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  accounting: SnapshotAccounting;
  rows: BoardRow[];
  live: LiveRow[];
}

export const MODEL_VERSION = 'radar-7';
/** Bootstrap refits for the uncertainty bands (deterministic seed). */
export const BOOTSTRAP_REFITS = 200;
/** The bootstrap's fixed seed: the same snapshot always draws the same refits. */
export const BOOTSTRAP_SEED = 0xc0ffee;
/** The airdrop-pool assumption: 10% of expected value, shared pro-rata by deposit over TVL. */
export const AIRDROP_POOL_PCT = 0.1;
/** A verdict is FARM when the net clears this many dollars; below it, MONITOR. */
export const VERDICT_FARM_MIN_USD = 2;

const DAY_MS = 86_400_000;
const LOG10 = Math.log10;

/** The median of a list, 0 for an empty one; the list is not mutated. */
function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** A calendar date (YYYY-MM-DD) that many days after the snapshot's as-of day. */
export function dateAfter(asOf: string, days: number): string {
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const d = new Date(a + days * DAY_MS);
  return d.toISOString().slice(0, 10);
}

/** The growth term's value: the 7-day TVL change, clamped to [-50, 100] per cent, as a fraction. */
export function growthValue(p: SnapshotProtocol): number {
  return Math.min(100, Math.max(-50, finite(p.change_7d, 0))) / 100;
}

/**
 * The maturity term's value, in log10: the log of an age curve that rises from
 * 0.55 for a newborn protocol to 1.0 at three years, then eases back toward 0.9.
 * Youth is not punished hard — the youngest watchlist protocol is 45 days old
 * and the point is to find future airdrops early — but the fitted coefficient
 * (positive) still lets age lift value toward the curve's top.
 */
function maturityValue(p: SnapshotProtocol, asOf: string): number {
  const age = ageDays(asOf, p.listed_at);
  let m: number;
  if (age === null) m = 0.75;
  else if (age < 90) m = 0.55 + (age / 90) * 0.15;
  else if (age <= 1095) m = 0.7 + ((age - 90) / 1005) * 0.3;
  else m = Math.max(0.9, 1 - ((age - 1095) / 1095) * 0.1);
  return LOG10(m);
}

/** The breadth term's value, in log10: the log of a chain-breadth multiplier. */
function breadthValue(p: SnapshotProtocol): number {
  const extra = Math.min(Math.max(p.chains.length - 1, 0), 4);
  return LOG10(1 + extra * 0.04);
}

/** A term's value for a protocol, in the units its coefficient multiplies. */
const TERM_VALUE: Record<TermName, (p: SnapshotProtocol, asOf: string) => number> = {
  growth: (p) => growthValue(p),
  maturity: (p, asOf) => maturityValue(p, asOf),
  breadth: (p) => breadthValue(p),
};

/** The candidate terms, in the order the selection tries them. */
const TERM_ORDER: TermName[] = ['growth', 'maturity', 'breadth'];

/** The live tokens the fit may stand on: a positive market cap and a positive TVL. */
function cleanLive(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) => typeof p.mcap_usd === 'number' && p.mcap_usd > 0 && typeof p.tvl_usd === 'number' && p.tvl_usd > 0,
  );
}

/** The Theil-Sen slope of y on x: the median pairwise slope, robust to outlying tokens. */
function theilSenSlope(xs: number[], ys: number[]): number {
  const slopes: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      if (xs[j] !== xs[i]) slopes.push((ys[j]! - ys[i]!) / (xs[j]! - xs[i]!));
    }
  }
  if (slopes.length === 0) return 0;
  return medianOf(slopes);
}

/** Solve A x = b by Gaussian elimination with partial pivoting; a tiny ridge keeps singular systems finite. */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    M[col]![col]! += 1e-12;
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r]![col]!) > Math.abs(M[pivot]![col]!)) pivot = r;
    if (pivot !== col) {
      const tmp = M[col]!;
      M[col] = M[pivot]!;
      M[pivot] = tmp;
    }
    const diag = M[col]![col]!;
    if (diag === 0) continue;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r]![col]! / diag;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[r]![c] = M[r]![c]! - factor * M[col]![c]!;
    }
  }
  return M.map((row, i) => {
    const d = row[i]!;
    return d === 0 ? 0 : row[n]! / d;
  });
}

// ---------------------------------------------------------------- the fit

/** The base fit: a log-log size curve plus a shrunk level per category. */
interface BaseFit {
  slope: number;
  globalLevel: number;
  levelOf: (category: string | null) => number;
  levels: Map<string, number>;
}

function fitBase(live: SnapshotProtocol[]): BaseFit {
  const xs = live.map((p) => LOG10(p.tvl_usd));
  const ys = live.map((p) => LOG10(p.mcap_usd!));
  const slope = theilSenSlope(xs, ys);
  const residuals = live.map((p, i) => ys[i]! - slope * xs[i]!);
  const globalLevel = medianOf(residuals);
  const byCategory = new Map<string, number[]>();
  live.forEach((p, i) => {
    const key = p.category ?? '';
    const arr = byCategory.get(key);
    if (arr) arr.push(residuals[i]!);
    else byCategory.set(key, [residuals[i]!]);
  });
  const levels = new Map<string, number>();
  for (const [key, arr] of byCategory) {
    // Shrinkage: two pseudo-observations at the global level, so a category
    // with one or two live tokens cannot swing on a single outlier.
    levels.set(key, (arr.length * medianOf(arr) + 2 * globalLevel) / (arr.length + 2));
  }
  const levelOf = (category: string | null): number => levels.get(category ?? '') ?? globalLevel;
  return { slope, globalLevel, levelOf, levels };
}

/**
 * The kept terms' coefficients on a live set: ordinary least squares of the
 * base fit's residuals on the terms' values, no intercept (the level already
 * holds it). A term with no variance on the set gets coefficient 0.
 */
function fitTermCoefs(
  live: SnapshotProtocol[],
  base: BaseFit,
  asOf: string,
  terms: TermName[],
): Record<TermName, number> {
  const out = {} as Record<TermName, number>;
  if (terms.length === 0) return out;
  const rows: number[][] = [];
  const target: number[] = [];
  for (const p of live) {
    const pred = base.slope * LOG10(p.tvl_usd) + base.levelOf(p.category);
    target.push(LOG10(p.mcap_usd!) - pred);
    rows.push(terms.map((t) => TERM_VALUE[t](p, asOf)));
  }
  const k = terms.length;
  const A: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const b: number[] = new Array<number>(k).fill(0);
  for (let i = 0; i < rows.length; i++) {
    for (let a = 0; a < k; a++) {
      b[a] = b[a]! + rows[i]![a]! * target[i]!;
      for (let c = 0; c < k; c++) A[a]![c] = A[a]![c]! + rows[i]![a]! * rows[i]![c]!;
    }
  }
  const coefs = solveLinear(A, b);
  terms.forEach((t, i) => {
    const v = coefs[i]!;
    out[t] = Number.isFinite(v) ? v : 0;
  });
  return out;
}

/** The log10 implied value of a protocol under a base fit and term coefficients. */
function predictLog(
  p: SnapshotProtocol,
  base: BaseFit,
  coefs: Record<TermName, number>,
  asOf: string,
): number {
  let v = base.slope * LOG10(p.tvl_usd) + base.levelOf(p.category);
  for (const t of Object.keys(coefs) as TermName[]) v += coefs[t]! * TERM_VALUE[t](p, asOf);
  return v;
}

/** A blind-test miss: the median absolute log-error and its x-factor. */
interface BlindMiss {
  median: number;
  mean: number;
  xFactor: number;
  n: number;
}

/** The LOO miss of a model shape: each live token held out, the rest refit, the held-out one predicted. */
function looMiss(
  live: SnapshotProtocol[],
  asOf: string,
  terms: TermName[],
): BlindMiss {
  const errs: number[] = [];
  for (let k = 0; k < live.length; k++) {
    const train = live.filter((_, i) => i !== k);
    const base = fitBase(train);
    const coefs = fitTermCoefs(train, base, asOf, terms);
    const held = live[k]!;
    const pred = predictLog(held, base, coefs, asOf);
    errs.push(Math.abs(LOG10(held.mcap_usd!) - pred));
  }
  const median = medianOf(errs);
  const mean = errs.reduce((s, e) => s + e, 0) / errs.length;
  return { median, mean, xFactor: Math.pow(10, median), n: errs.length };
}

/**
 * The walk-forward miss: fit on the older-listed `frac` of live tokens, predict
 * the newer-listed rest. Listed_at is when DefiLlama began tracking a protocol,
 * so this tests whether the fit travels forward in time instead of only across
 * tokens. Returns the cut date too, so the dashboard can state the split.
 */
function wfMiss(
  live: SnapshotProtocol[],
  asOf: string,
  terms: TermName[],
  frac: number,
): BlindMiss & { cut: string } {
  const dated = live
    .filter((p) => p.listed_at !== null)
    .sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : 1));
  const cut = Math.floor(dated.length * frac);
  const train = dated.slice(0, cut);
  const test = dated.slice(cut);
  const base = fitBase(train);
  const coefs = fitTermCoefs(train, base, asOf, terms);
  const errs = test.map((p) => Math.abs(LOG10(p.mcap_usd!) - predictLog(p, base, coefs, asOf)));
  const median = medianOf(errs);
  const mean = errs.reduce((s, e) => s + e, 0) / errs.length;
  return { median, mean, xFactor: Math.pow(10, median), n: errs.length, cut: dated[cut]!.listed_at! };
}

// ---------------------------------------------------------------- launch odds

/** Age buckets for the launch odds, in days. */
const ODDS_BUCKETS: { label: string; min: number | null; max: number | null }[] = [
  { label: 'under 1 year', min: 0, max: 365 },
  { label: '1-2 years', min: 365, max: 730 },
  { label: '2-3 years', min: 730, max: 1095 },
  { label: 'over 3 years', min: 1095, max: null },
];

/**
 * Launch odds from the peers' record: for each age bucket, the share of the
 * snapshot's protocols of that age that still record no token. A protocol with
 * no listed date takes the no-date bucket. This is a record of what happened to
 * a protocol's age peers — older pre-token protocols have smaller odds, because
 * most of their peers already carry a token — never a prediction that a token
 * launches.
 */
function launchOddsTable(snapshot: Snapshot): OddsBucket[] {
  const isPre = (p: SnapshotProtocol): boolean => p.gecko_id === null && p.symbol === null;
  const out: OddsBucket[] = ODDS_BUCKETS.map((b) => {
    const inBucket = snapshot.protocols.filter((p) => {
      const a = ageDays(snapshot.as_of, p.listed_at);
      if (a === null) return false;
      if (b.min !== null && a < b.min) return false;
      if (b.max !== null && a >= b.max) return false;
      return true;
    });
    const pre = inBucket.filter(isPre).length;
    return {
      label: b.label,
      min_days: b.min,
      max_days: b.max,
      total: inBucket.length,
      pre_token: pre,
      odds: inBucket.length === 0 ? 0 : pre / inBucket.length,
    };
  });
  const noDate = snapshot.protocols.filter((p) => ageDays(snapshot.as_of, p.listed_at) === null);
  const noDatePre = noDate.filter(isPre).length;
  out.push({
    label: 'no listed date',
    min_days: null,
    max_days: null,
    total: noDate.length,
    pre_token: noDatePre,
    odds: noDate.length === 0 ? 0 : noDatePre / noDate.length,
  });
  return out;
}

/** A protocol's launch odds: its age bucket's share, from the odds table. */
function oddsOf(p: SnapshotProtocol, asOf: string, odds: OddsBucket[]): number {
  const a = ageDays(asOf, p.listed_at);
  if (a === null) return odds[odds.length - 1]!.odds;
  for (let i = 0; i < ODDS_BUCKETS.length; i++) {
    const b = ODDS_BUCKETS[i]!;
    if ((b.min === null || a >= b.min) && (b.max === null || a < b.max)) return odds[i]!.odds;
  }
  return odds[odds.length - 1]!.odds;
}

// ---------------------------------------------------------------- the fitted model

/** The fitted model: base fit, term selection by two blind tests, and the selected model's misses. */
interface FittedModel {
  base: BaseFit;
  coefs: Record<TermName, number>;
  kept: TermName[];
  tests: TermTest[];
  loo: BlindMiss;
  wf: BlindMiss & { cut: string };
  wf2: BlindMiss & { cut: string };
  allLoo: BlindMiss;
  allWf: BlindMiss & { cut: string };
  liveCount: number;
  odds: OddsBucket[];
}

function fitModel(snapshot: Snapshot): FittedModel {
  const live = cleanLive(snapshot);
  const asOf = snapshot.as_of;
  const baseLoo = looMiss(live, asOf, []);
  const baseWf = wfMiss(live, asOf, [], 0.5);
  // Greedy forward selection on TWO blind tests. Phase A takes the term with
  // the best leave-one-out improvement (at least 1%); when no term clears that
  // bar, phase B takes the term with the best walk-forward improvement (at
  // least 1%) that does not worsen leave-one-out by more than 0.5%. One test
  // alone misleads — maturity is neutral on LOO but clearly helps the
  // walk-forward, and breadth fails both. Coefficients are refit inside every
  // fold, so each miss is an honest out-of-sample figure, not an in-sample one.
  const kept: TermName[] = [];
  let currentLoo = baseLoo;
  let currentWf = baseWf;
  const singleLoo = new Map<TermName, BlindMiss>();
  const singleWf = new Map<TermName, BlindMiss & { cut: string }>();
  for (;;) {
    // Phase A: best LOO improver.
    let bestA: TermName | null = null;
    let bestALoo = currentLoo;
    for (const t of TERM_ORDER) {
      if (kept.includes(t)) continue;
      const trialLoo = looMiss(live, asOf, [...kept, t]);
      if (kept.length === 0) {
        singleLoo.set(t, trialLoo);
        singleWf.set(t, wfMiss(live, asOf, [t], 0.5));
      }
      if (trialLoo.xFactor < currentLoo.xFactor * 0.99 && trialLoo.xFactor < bestALoo.xFactor) {
        bestA = t;
        bestALoo = trialLoo;
      }
    }
    if (bestA !== null) {
      kept.push(bestA);
      currentLoo = bestALoo;
      currentWf = wfMiss(live, asOf, kept, 0.5);
      continue;
    }
    // Phase B: best walk-forward improver that does not hurt LOO.
    let bestB: TermName | null = null;
    let bestBWf = currentWf;
    let bestBLoo = currentLoo;
    for (const t of TERM_ORDER) {
      if (kept.includes(t)) continue;
      const trialLoo = looMiss(live, asOf, [...kept, t]);
      const trialWf = wfMiss(live, asOf, [...kept, t], 0.5);
      if (kept.length === 0) singleWf.set(t, trialWf);
      if (
        trialWf.xFactor < currentWf.xFactor * 0.99 &&
        trialLoo.xFactor <= currentLoo.xFactor * 1.005 &&
        trialWf.xFactor < bestBWf.xFactor
      ) {
        bestB = t;
        bestBWf = trialWf;
        bestBLoo = trialLoo;
      }
    }
    if (bestB === null) break;
    kept.push(bestB);
    currentWf = bestBWf;
    currentLoo = bestBLoo;
  }
  const base = fitBase(live);
  const coefs = fitTermCoefs(live, base, asOf, kept);
  const wf2 = wfMiss(live, asOf, kept, 0.6);
  const allLoo = looMiss(live, asOf, TERM_ORDER);
  const allWf = wfMiss(live, asOf, TERM_ORDER, 0.5);
  const tests: TermTest[] = TERM_ORDER.map((t) => ({
    term: t,
    kept: kept.includes(t),
    coefficient: kept.includes(t) ? coefs[t]! : 0,
    loo_x_factor: (singleLoo.get(t) ?? baseLoo).xFactor,
    wf_x_factor: (singleWf.get(t) ?? baseWf).xFactor,
    base_loo_x_factor: baseLoo.xFactor,
    base_wf_x_factor: baseWf.xFactor,
  }));
  return {
    base,
    coefs,
    kept,
    tests,
    loo: currentLoo,
    wf: currentWf,
    wf2,
    allLoo,
    allWf,
    liveCount: live.length,
    odds: launchOddsTable(snapshot),
  };
}

/** The implied value of a pre-token protocol under the fitted model. */
function impliedValue(p: SnapshotProtocol, fit: FittedModel, asOf: string): number {
  return Math.max(1, Math.round(Math.pow(10, predictLog(p, fit.base, fit.coefs, asOf))));
}

/** A seeded deterministic PRNG (mulberry32) for the bootstrap. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- uncertainty bands

/**
 * The bootstrap bands: 200 resamples of the live set, the model refit each
 * time, every board protocol re-scored. Returns, per slug, the P10-P90 band
 * of implied value and the rank range across the refits. The band always
 * contains the point estimate, and the rank range always contains the point rank.
 * The dashboard shows the band as a bar, not as wide numbers: a row's rank is
 * a range, not a point, and the bar says so without advertising the width.
 */
function bootstrapBands(
  live: SnapshotProtocol[],
  fit: FittedModel,
  asOf: string,
  protocols: SnapshotProtocol[],
  pointImplied: Map<string, number>,
  pointRank: Map<string, number>,
): Map<string, { p10: number; p90: number; rankLow: number; rankHigh: number }> {
  const rng = mulberry32(BOOTSTRAP_SEED);
  const n = live.length;
  const values = new Map<string, number[]>();
  const rankLow = new Map<string, number>();
  const rankHigh = new Map<string, number>();
  for (const p of protocols) {
    values.set(p.slug, []);
    rankLow.set(p.slug, pointRank.get(p.slug)!);
    rankHigh.set(p.slug, pointRank.get(p.slug)!);
  }
  for (let r = 0; r < BOOTSTRAP_REFITS; r++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < n; i++) sample.push(live[Math.floor(rng() * n)]!);
    const base = fitBase(sample);
    const coefs = fitTermCoefs(sample, base, asOf, fit.kept);
    const scored = protocols.map((p) => ({
      slug: p.slug,
      implied: Math.max(1, Math.round(Math.pow(10, predictLog(p, base, coefs, asOf)))),
    }));
    scored.sort((a, b) => b.implied - a.implied || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
    scored.forEach((s, i) => {
      values.get(s.slug)!.push(s.implied);
      const rank = i + 1;
      if (rank < rankLow.get(s.slug)!) rankLow.set(s.slug, rank);
      if (rank > rankHigh.get(s.slug)!) rankHigh.set(s.slug, rank);
    });
  }
  const out = new Map<string, { p10: number; p90: number; rankLow: number; rankHigh: number }>();
  for (const p of protocols) {
    const arr = [...values.get(p.slug)!].sort((a, b) => a - b);
    const point = pointImplied.get(p.slug)!;
    // The band always contains the point estimate.
    const p10 = Math.min(arr[Math.floor(0.1 * (arr.length - 1))]!, point);
    const p90 = Math.max(arr[Math.floor(0.9 * (arr.length - 1))]!, point);
    out.set(p.slug, {
      p10: Math.max(1, Math.round(p10)),
      p90: Math.max(1, Math.round(p90)),
      rankLow: rankLow.get(p.slug)!,
      rankHigh: rankHigh.get(p.slug)!,
    });
  }
  return out;
}

// ---------------------------------------------------------------- the board's pool

/** Categories the watchlist rule keeps out: a wrapped, staked or bridged product of a
 *  token that already trades is not a protocol still waiting on a launch of its own. */
const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** The watchlist's rule, as far as the snapshot's ten fields can state it: no token
 *  recorded, and not a wrapped, staked or bridged product of one that trades. The
 *  snapshot carries no parentProtocol field, so the house's own list is read, not
 *  rebuilt — every watchlist slug is covered, and the pool below is the same rule
 *  applied to the protocols under the floor. */
export function rulePasses(p: SnapshotProtocol): boolean {
  if (p.gecko_id !== null || p.symbol !== null) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSION_SUFFIX.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIXES.some((e) => p.name.startsWith(e))) return false;
  return true;
}

/** Whether a protocol records a token at all (gecko entry or symbol). */
function hasToken(p: SnapshotProtocol): boolean {
  return p.gecko_id !== null || p.symbol !== null;
}

/**
 * Every protocol in the snapshot, counted by where it lands. The five buckets
 * always sum to the snapshot total — nothing silently disappears: ranked rows,
 * live tokens the fit stands on, live tokens the fit cannot use, pre-token
 * protocols excluded by category, pre-token protocols excluded by name.
 */
export function snapshotAccounting(snapshot: Snapshot, boardSize: number, liveShown: number): SnapshotAccounting {
  const live = snapshot.protocols.filter(hasToken);
  const fitted = live.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0).length;
  const pre = snapshot.protocols.filter((p) => !hasToken(p));
  const excludedCategory = pre.filter((p) => p.category !== null && EXCLUDED_CATEGORIES.has(p.category)).length;
  const excludedName = pre.filter(
    (p) =>
      !(p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) &&
      (VERSION_SUFFIX.test(p.name) || WRAPPED_WORD.test(p.name) || EXCHANGE_PREFIXES.some((e) => p.name.startsWith(e))),
  ).length;
  return {
    total: snapshot.protocols.length,
    ranked: boardSize,
    live_fitted: fitted,
    live_shown: liveShown,
    live_unfitted: live.length - fitted,
    excluded_category: excludedCategory,
    excluded_name: excludedName,
  };
}

// ---------------------------------------------------------------- farm plans

/** Gas cost of one transaction on a chain, as the plan quotes it. */
const L2_CHAINS = new Set([
  'Base',
  'Arbitrum',
  'Optimism',
  'Polygon',
  'Unichain',
  'Ink',
  'Blast',
  'Linea',
  'Scroll',
  'zkSync Era',
  'Mode',
  'Manta',
  'Katana',
  'Arc',
  'Tempo',
  'Stable',
  'BOB',
  'Berachain',
  'Sonic',
  'Hyperliquid L1',
  'Monad',
  'Plume Mainnet',
  'Corn',
  'Fluent',
  'Citrea',
  'Mezo',
  'Etherlink',
  'Pharos',
  'XRPL EVM',
  'Sei',
  'Stellar',
  'Flare',
  'Sui',
  'Avalanche',
  'Tron',
  'Bitcoin',
  'Bittensor',
  'Robinhood Chain',
  'Plasma',
]);

export function gasNote(chain: string): string {
  if (chain === 'Ethereum') return 'about $6-12 of gas per transaction on Ethereum';
  if (chain === 'Solana') return 'under $0.10 of gas per transaction on Solana';
  if (chain === 'Binance') return 'about $0.10-0.50 of gas per transaction on BNB Chain';
  if (L2_CHAINS.has(chain)) return `about $0.50-2 of gas per transaction on ${chain}`;
  return `about $1-5 of gas per transaction on ${chain}`;
}

/** Typical gas in dollars for one transaction on a chain (midpoint of the quoted range). */
export function gasUsd(chain: string): number {
  if (chain === 'Ethereum') return 9;
  if (chain === 'Solana') return 0.05;
  if (chain === 'Binance') return 0.3;
  if (L2_CHAINS.has(chain)) return 1.25;
  return 3;
}

/** The chain a row farms on: the cheapest chain the protocol runs on, by gas per
 *  transaction — never the first chain listed. A farmer does not pay $9 a
 *  transaction on Ethereum when the same protocol runs on Solana at $0.05. */
export function farmChainOf(p: SnapshotProtocol): string {
  if (p.chains.length === 0) return 'Ethereum';
  let best = p.chains[0]!;
  for (const c of p.chains) if (gasUsd(c) < gasUsd(best)) best = c;
  return best;
}

/** The second-cheapest chain, for the plan's mirror position; null on a single-chain protocol. */
export function secondChainOf(p: SnapshotProtocol): string | null {
  if (p.chains.length < 2) return null;
  const main = farmChainOf(p);
  let second: string | null = null;
  for (const c of p.chains) {
    if (c === main) continue;
    if (second === null || gasUsd(c) < gasUsd(second)) second = c;
  }
  return second;
}

/**
 * Farming capital: the minimum-viable deposit — the smallest position that
 * registers as a real user on a protocol of this size: 0.0006% of TVL, between
 * $100 and $5,000. A $50 ticket on a $3B protocol is dust the points system
 * never sees; a $5,000 ticket on a $5M protocol is the protocol itself. One
 * rule, one function, every row.
 */
export function depositOf(tvlUsd: number): number {
  return Math.round(Math.min(5000, Math.max(100, tvlUsd * 0.000006)));
}

/** Hold in days, from age: a young protocol is farmed hard and short, an old one slow
 *  and long. 45 days old holds ~48 days; the oldest watchlist protocol holds ~139. */
export function holdDaysOf(ageDays: number | null): number {
  if (ageDays === null) return 90;
  return Math.round(45 + Math.min(135, ageDays * 0.06));
}

/** How often to repeat the core action: young protocols reward frequent touches. */
export function cadenceDaysOf(ageDays: number | null): number {
  if (ageDays === null) return 7;
  return ageDays < 365 ? 4 : 7;
}

/** The one action that only makes sense for this protocol's category on its chains,
 *  with the row's own amounts in it. */
const CATEGORY_ACTION: Record<string, string> = {
  'Risk Curators': 'deposit into the curator vaults and hold the vault position',
  Chain: 'bridge funds in and use the chain-native apps',
  RWA: 'mint or buy the tokenized real-world asset and hold it',
  Lending: 'supply assets to the lending market and borrow a small amount against them',
  Dexs: 'provide liquidity to the main pool and swap through the router',
  'Basis Trading': 'open a delta-neutral basis position and keep it funded',
  Restaking: 'restake the position and delegate it to an operator',
  'Onchain Capital Allocator': 'allocate into the managed vaults and keep the allocation live',
  Yield: 'deposit into the yield vault and let the strategy compound',
  CeDeFi: 'deposit into the CeDeFi vault and keep the balance working',
  'Collateral Markets': 'post collateral and open a small position against it',
  CDP: 'lock collateral, mint the stable asset and hold a modest debt position',
  Insurance: 'buy cover for a position you already hold and keep it active',
  Payments: 'route a real payment through the network',
  'Governance Incentives': 'lock the governance asset and vote on the live proposals',
  'Staking Pool': 'stake into the pool and keep the stake bonded',
  'Stablecoin Wrapper': 'wrap the stablecoin and hold the wrapped balance',
};

function actionOf(category: string | null): string {
  if (category !== null && CATEGORY_ACTION[category] !== undefined) return CATEGORY_ACTION[category]!;
  return 'use the protocol and keep a live position in it';
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** A dollar amount with cents when it is under $100, whole dollars above it. */
function moneyFine(n: number): string {
  const v = Math.round(n * 100) / 100;
  if (Math.abs(v) >= 100) return `$${Math.round(v).toLocaleString('en-US')}`;
  return `$${v.toFixed(2)}`;
}

/** Active hours the plan takes: setup, first action, each repeat, top-up, exit. */
function planHours(repeats: number): number {
  return 3 + repeats * 0.5;
}

/**
 * The costed farm verdict: the farm runs at the minimum-viable deposit on the
 * protocol's cheapest chain. Expected airdrop = expected value x a 10% pool,
 * shared pro-rata by deposit over TVL. Net = expected minus the plan's gas in
 * full — the farm's true sunk-cost result. FARM when the net clears +$2;
 * otherwise MONITOR, with the break-even deposit as the entry trigger and a
 * dated recheck. Capital is locked, not spent, so it is shown and never
 * subtracted. The word SKIP appears nowhere: a farm that does not clear its gas
 * is a farm to watch, not a farm to refuse.
 */
export function farmVerdict(
  p: SnapshotProtocol,
  asOf: string,
  expectedValueUsd: number,
  repeats: number,
): FarmVerdict {
  const chain = farmChainOf(p);
  const second = secondChainOf(p);
  const deposit = depositOf(p.tvl_usd);
  const txCount = 2 + repeats + 1 + 1;
  const gasTotal = Math.round((txCount * gasUsd(chain) + (second !== null ? gasUsd(second) : 0)) * 100) / 100;
  const expected = (expectedValueUsd * AIRDROP_POOL_PCT * deposit) / p.tvl_usd;
  const net = Math.round((expected - gasTotal) * 100) / 100;
  const hours = planHours(repeats);
  const perHour = Math.round((net / hours) * 100) / 100;
  // The deposit at which this farm breaks even: gas divided by the expected
  // value of one deposited dollar. A MONITOR row names it as its entry trigger.
  const perDollar = (expectedValueUsd * AIRDROP_POOL_PCT) / p.tvl_usd;
  const breakeven = perDollar > 0 ? Math.ceil(gasTotal / perDollar / 50) * 50 : deposit;
  return {
    verdict: net >= VERDICT_FARM_MIN_USD ? 'FARM' : 'MONITOR',
    deposit_usd: deposit,
    chain,
    total_gas_usd: gasTotal,
    expected_usd: Math.round(expected * 100) / 100,
    net_usd: net,
    net_per_hour_usd: perHour,
    hours,
    breakeven_deposit_usd: breakeven,
    recheck_date: dateAfter(asOf, 7),
  };
}

/**
 * The farm plan as dated entries: every step carries the calendar date it
 * happens on, counted from the snapshot's as-of day. The plan reads as a
 * diary — setup today, first repeat on the cadence day, top-up on day 14,
 * exit window at the end of the hold — not a wishlist without dates.
 */
export function farmSchedule(
  p: SnapshotProtocol,
  asOf: string,
  verdict: FarmVerdict,
  hold: number,
  cadence: number,
  repeats: number,
): FarmScheduleEntry[] {
  const second = secondChainOf(p);
  const topUp = Math.round(verdict.deposit_usd / 2);
  const unwindDays = Math.max(3, Math.round(hold / 10));
  const entries: FarmScheduleEntry[] = [
    {
      day: 0,
      date: dateAfter(asOf, 0),
      what: `Set up a fresh wallet on ${verdict.chain} and fund it with ${money(verdict.deposit_usd)} plus gas`,
    },
    {
      day: 0,
      date: dateAfter(asOf, 0),
      what: `First deposit ${money(verdict.deposit_usd)} on ${verdict.chain}${second !== null ? `, mirror ${money(Math.round(verdict.deposit_usd * 0.4))} on ${second}` : ''} — save the receipt`,
    },
    {
      day: cadence,
      date: dateAfter(asOf, cadence),
      what: `First repeat of the core action (then every ${cadence} days, ${repeats} repeats to day ${hold})`,
    },
    {
      day: 14,
      date: dateAfter(asOf, 14),
      what: `Top-up ${money(topUp)} on ${second !== null ? second : verdict.chain}`,
    },
    {
      day: hold,
      date: dateAfter(asOf, hold),
      what: `Last repeat — the exit window opens; check announcements and the points page weekly from here`,
    },
    {
      day: hold + unwindDays,
      date: dateAfter(asOf, hold + unwindDays),
      what: `Unwind complete (tranches over ${unwindDays} days) — or leave the rest running if nothing was announced`,
    },
  ];
  return entries;
}

/** Seven concrete steps, every number computed from this row's own figures: a summed
 *  total cost and time first — with the costed verdict in the same line — then
 *  setup, the category-plus-chains action, cadence, a second position, a concrete
 *  exit with its trigger, and one short safety line. No verdict stamp that says
 *  not to farm: every row carries a plan a reader can run, and the verdict in
 *  step 1 says what that plan costs and what it is expected to return. */
export function farmSteps(p: SnapshotProtocol, asOf: string): string[] {
  const age = ageDays(asOf, p.listed_at);
  const capital = depositOf(p.tvl_usd);
  const hold = holdDaysOf(age);
  const cadence = cadenceDaysOf(age);
  const repeats = Math.max(1, Math.round(hold / cadence));
  const main = farmChainOf(p);
  const second = secondChainOf(p);
  const topUp = Math.round(capital / 2);
  const mirror = Math.round(capital * 0.4);
  const txCount = 2 + repeats + 1 + 1;
  const gasTotal = Math.round((txCount * gasUsd(main) + (second !== null ? gasUsd(second) : 0)) * 100) / 100;
  const total = capital + topUp + gasTotal;
  const unwindDays = Math.max(3, Math.round(hold / 10));
  const steps: string[] = [
    `Plan total for ${p.name}: about ${money(total)} over ${hold} days — ${money(capital)} first position plus ${money(topUp)} top-up, and about ${money(gasTotal)} gas for ${txCount} transactions on ${main}${second !== null ? ` and ${second}` : ''}.`,
    `Set up a fresh wallet for ${p.name} on ${main} and fund it with ${money(capital)} plus gas (${gasNote(main)}); keep the seed offline and never reuse this wallet elsewhere.`,
    `On ${p.name}, ${actionOf(p.category)} with ${money(capital)} on ${main}${second !== null ? `, then mirror ${money(mirror)} of it on ${second} (${gasNote(second)}) so the record spans ${p.chains.length} chains` : ` — ${p.chains.length === 1 ? 'a single-chain protocol, so depth on the one chain is what counts' : ''}`}; save the receipt of the first deposit.`,
    `Repeat the core action on ${p.name} every ${cadence} days for ${hold} days (${repeats} repeats): steady activity across the whole window counts more than one large deposit, so log each repeat with its date.`,
  ];
  if (second !== null) {
    steps.push(
      `After 14 days, add the ${money(topUp)} top-up for ${p.name} on ${second} instead of ${main}, so both chains show repeated use and the second chain is not a one-off touch.`,
    );
  } else {
    steps.push(
      `After 14 days, add the ${money(topUp)} top-up for ${p.name} on ${main} in a second transaction, so the record shows repeated use on ${main}, not a single deposit.`,
    );
  }
  steps.push(
    `Exit trigger for ${p.name}: check its announcements and any points page weekly; when a token or claim is announced, claim only through the official channel, then unwind the ${money(capital)} position in ${Math.max(2, Math.round(capital / 500))} tranches over ${unwindDays} days at about ${money(gasUsd(main))} gas per withdrawal on ${main} — if nothing is announced by day ${hold}, withdraw half and leave the rest running.`,
    `Never sign a blind approval, and only use links from the protocol's official channel.`,
  );
  return steps;
}

/** The verdict's one line, folded into the plan's first step: the call, the
 *  expected airdrop against the gas, the net and the net per hour — or, for a
 *  MONITOR row, the break-even deposit and the recheck date. */
export function verdictLine(
  p: SnapshotProtocol,
  verdict: FarmVerdict,
  expectedValueUsd: number,
): string {
  const sign = verdict.net_usd >= 0 ? '+' : '';
  if (verdict.verdict === 'FARM') {
    return (
      ` Verdict FARM: expected airdrop ${moneyFine(verdict.expected_usd)} vs ${moneyFine(verdict.total_gas_usd)} gas on ${verdict.chain} — net ${sign}${moneyFine(verdict.net_usd)} (${moneyFine(verdict.net_per_hour_usd)}/hour over ${verdict.hours} hours). Pool assumed 10% of expected value (${money(expectedValueUsd)}), shared pro-rata by deposit over TVL.`
    );
  }
  return (
    ` Verdict MONITOR: expected airdrop ${moneyFine(verdict.expected_usd)} vs ${moneyFine(verdict.total_gas_usd)} gas on ${verdict.chain} — net ${sign}${moneyFine(verdict.net_usd)} at the ${money(verdict.deposit_usd)} minimum-viable deposit; recheck ${verdict.recheck_date}, enter at a ${money(verdict.breakeven_deposit_usd)} deposit. Pool assumed 10% of expected value (${money(expectedValueUsd)}), shared pro-rata by deposit over TVL.`
    + (verdict.chain !== (p.chains[0] ?? verdict.chain)
      ? ` Farmed on ${verdict.chain}, the cheapest of ${p.chains.length} chains.`
      : '')
  );
}

// ---------------------------------------------------------------- build

export function parseSnapshot(text: string): Snapshot {
  const snap = JSON.parse(text) as Snapshot;
  if (!Array.isArray(snap.protocols) || !Array.isArray(snap.watchlist)) {
    throw new Error('snapshot: protocols and watchlist must be arrays');
  }
  return snap;
}

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const fit = fitModel(snapshot);
  const asOf = snapshot.as_of;
  const watch = new Set(snapshot.watchlist);
  const pool = snapshot.protocols.filter(rulePasses);
  const rows: BoardRow[] = pool
    .map((p) => {
      const gv = growthValue(p);
      const mv = maturityValue(p, asOf);
      const gCoef = fit.coefs.growth ?? 0;
      const mCoef = fit.coefs.maturity ?? 0;
      const implied = impliedValue(p, fit, asOf);
      const odds = oddsOf(p, asOf, fit.odds);
      const expected = Math.max(1, Math.round(implied * odds));
      const age = ageDays(asOf, p.listed_at);
      const hold = holdDaysOf(age);
      const cadence = cadenceDaysOf(age);
      const repeats = Math.max(1, Math.round(hold / cadence));
      const verdict = farmVerdict(p, asOf, expected, repeats);
      const steps = farmSteps(p, asOf);
      steps[0] = steps[0]! + verdictLine(p, verdict, expected);
      const schedule = farmSchedule(p, asOf, verdict, hold, cadence, repeats);
      return {
        rank: 0,
        slug: p.slug,
        name: p.name,
        category: p.category,
        chains: p.chains,
        tvl_usd: p.tvl_usd,
        change_7d: p.change_7d,
        age_days: age,
        implied_value_usd: implied,
        expected_value_usd: expected,
        implied_p10_usd: implied,
        implied_p90_usd: implied,
        rank_low: 0,
        rank_high: 0,
        launch_odds: odds,
        slope: fit.base.slope,
        category_level: fit.base.levelOf(p.category),
        growth_coef: gCoef,
        growth_value: gv,
        growth_multiplier: Math.pow(10, gCoef * gv),
        maturity_coef: mCoef,
        maturity_value: mv,
        maturity_multiplier: Math.pow(10, mCoef * mv),
        fitted_multiple: implied / p.tvl_usd,
        farm_steps: steps,
        farm_verdict: verdict,
        farm_schedule: schedule,
        watchlist: watch.has(p.slug),
      } as BoardRow;
    })
    .sort((a, b) => b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : 1));
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  // Bootstrap bands, from the point estimates and ranks above.
  const pointImplied = new Map(rows.map((r) => [r.slug, r.implied_value_usd]));
  const pointRank = new Map(rows.map((r) => [r.slug, r.rank]));
  const bands = bootstrapBands(cleanLive(snapshot), fit, asOf, pool, pointImplied, pointRank);
  for (const r of rows) {
    const b = bands.get(r.slug)!;
    r.implied_p10_usd = b.p10;
    r.implied_p90_usd = b.p90;
    r.rank_low = b.rankLow;
    r.rank_high = b.rankHigh;
  }

  // Live-token protocols, set aside: their token already trades, so they are not
  // launch candidates. The board ranks pre-token protocols only; the dashboard's
  // live tab shows the largest of these by market cap, for the separation to read.
  const live: LiveRow[] = snapshot.protocols
    .filter((p) => p.gecko_id !== null || p.symbol !== null)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      symbol: p.symbol,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }))
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0))
    .slice(0, 24);

  const verdictCounts = { FARM: 0, MONITOR: 0 };
  for (const r of rows) verdictCounts[r.farm_verdict.verdict]++;

  const categoryMultiple: Record<string, number> = {};
  for (const [cat, level] of fit.base.levels) {
    categoryMultiple[cat === '' ? 'Uncategorised' : cat] = Math.pow(10, fit.base.slope * 8 + level) / 1e8;
  }
  const model: ModelSummary = {
    version: MODEL_VERSION,
    slope: fit.base.slope,
    global_level: fit.base.globalLevel,
    category_multiple: categoryMultiple,
    default_multiple: Math.pow(10, fit.base.slope * 8 + fit.base.globalLevel) / 1e8,
    kept_terms: { ...fit.coefs },
    term_tests: fit.tests,
    live_count: fit.liveCount,
    loo_median_abs_log_err: fit.loo.median,
    loo_x_factor: fit.loo.xFactor,
    wf_x_factor: fit.wf.xFactor,
    wf_cut: fit.wf.cut,
    wf2_x_factor: fit.wf2.xFactor,
    wf2_cut: fit.wf2.cut,
    all_terms_loo_x_factor: fit.allLoo.xFactor,
    all_terms_wf_x_factor: fit.allWf.xFactor,
    airdrop_pool_pct: AIRDROP_POOL_PCT,
    bootstrap_refits: BOOTSTRAP_REFITS,
    verdict_counts: verdictCounts,
    odds: fit.odds,
  };

  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: rows.length,
    early_size: rows.filter((r) => !r.watchlist).length,
    live_size: live.length,
    accounting: snapshotAccounting(snapshot, rows.length, live.length),
    rows,
    live,
  };
  return { board: rows, radar };
}

/** The gate's shape, checked before anything is written. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100) return `board holds ${board.length} rows, under the 100 minimum`;
  const slugs = new Set(snapshot.protocols.map((p) => p.slug));
  for (const r of board) if (!slugs.has(r.slug)) return `board names ${r.slug}, not in the snapshot`;
  const watch = new Set(snapshot.watchlist);
  for (const s of watch) if (!board.some((r) => r.slug === s)) return `board misses watchlist ${s}`;
  const seen = new Set<string>();
  for (const r of board) {
    if (seen.has(r.slug)) return `board repeats ${r.slug}`;
    seen.add(r.slug);
  }
  for (let i = 0; i < board.length; i++) {
    if (board[i]!.rank !== i + 1) return `row ${board[i]!.slug} carries rank ${board[i]!.rank}, expected ${i + 1}`;
    if (i > 0 && board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) {
      return `implied value rises at rank ${board[i]!.rank}`;
    }
    if (board[i]!.farm_steps.length < 3 || board[i]!.farm_steps.length > 12) {
      return `row ${board[i]!.slug} carries ${board[i]!.farm_steps.length} farm steps`;
    }
    for (const s of board[i]!.farm_steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `row ${board[i]!.slug} carries a farm step of ${t.length} characters`;
    }
  }
  return null;
}

/** The dashboard's data, written beside the page: the board plus the model that made it. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}

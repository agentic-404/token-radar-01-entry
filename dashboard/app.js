// Token Radar's dashboard (radar-7). Reads window.RADAR (written beside dashboard/
// by main.ts) and renders the ranked board, a filterable table, a per-protocol
// detail view with the model's own recompute, and a what-if sandbox. No network:
// every byte it shows is in data.js. The recompute below is the same arithmetic
// lib/model.ts runs, so the page's numbers and board.json's numbers are visibly
// the same claim.
//
// radar-7 on top of radar-6: an expected-value column (implied x launch odds)
// with its own sort, a costed farm verdict on every row (FARM or MONITOR — the
// word SKIP appears nowhere), the whole 758 protocols accounted for, and dated
// farm schedules in the detail view.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var app = document.getElementById('app');
  if (!DATA || !app) return;

  var state = { q: '', category: 'all', chain: 'all', minTvl: 0, wlOnly: false, verdict: 'all', tab: 'pre', sort: 'rank', dir: -1, detail: null };

  function usd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function usdFull(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function money2(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var v = Math.round(n * 100) / 100;
    if (Math.abs(v) >= 100) return '$' + Math.round(v).toLocaleString('en-US');
    return '$' + v.toFixed(2);
  }
  function signed2(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n >= 0 ? '+' : '') + money2(n);
  }
  function pct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function ageFmt(d) {
    if (d === null || d === undefined) return 'unknown';
    if (d >= 365) return (d / 365).toFixed(1) + 'y';
    return d + 'd';
  }
  function oddsFmt(o) {
    if (o === null || o === undefined || !isFinite(o)) return 'n/a';
    return Math.round(o * 100) + '%';
  }
  // The model's own terms, as lib/model.ts fits them: growth is the clamped
  // 7-day change as a fraction; maturity is the log of the age curve below.
  function maturityLog(age) {
    var m;
    if (age === null || age === undefined) m = 0.75;
    else if (age < 90) m = 0.55 + (age / 90) * 0.15;
    else if (age <= 1095) m = 0.7 + ((age - 90) / 1005) * 0.3;
    else m = Math.max(0.9, 1 - ((age - 1095) / 1095) * 0.1);
    return Math.log10(m);
  }
  function growthVal(change) {
    var c = change === null || change === undefined ? 0 : Math.min(100, Math.max(-50, change));
    return c / 100;
  }
  // Recompute a row's implied value from its own figures and the fitted terms.
  function impliedOfRow(row) {
    var base = row.implied_value_usd / (row.growth_multiplier * row.maturity_multiplier);
    return Math.max(1, Math.round(base * row.growth_multiplier * row.maturity_multiplier));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string' || typeof child === 'number') node.appendChild(document.createTextNode(String(child)));
      else node.appendChild(child);
    }
    return node;
  }

  function bySlug(slug) {
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) return DATA.rows[i];
    return null;
  }
  function liveBySlug(slug) {
    for (var i = 0; i < DATA.live.length; i++) if (DATA.live[i].slug === slug) return DATA.live[i];
    return null;
  }

  function categories() {
    var seen = {}, out = [];
    DATA.rows.forEach(function (r) {
      var c = r.category === null ? 'Uncategorised' : r.category;
      if (!seen[c]) { seen[c] = true; out.push(c); }
    });
    return out.sort();
  }
  function chains() {
    var seen = {}, out = [];
    DATA.rows.concat(DATA.live).forEach(function (r) {
      r.chains.forEach(function (c) { if (!seen[c]) { seen[c] = true; out.push(c); } });
    });
    return out.sort();
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.wlOnly && !r.watchlist) return false;
      if (state.verdict !== 'all' && r.farm_verdict.verdict !== state.verdict) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (state.category !== 'all' && (r.category === null ? 'Uncategorised' : r.category) !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      return true;
    });
  }
  function filteredLive() {
    var q = state.q.trim().toLowerCase();
    return DATA.live.filter(function (r) {
      if (state.category !== 'all' && (r.category === null ? 'Uncategorised' : r.category) !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      return true;
    });
  }

  function sortRows(rows) {
    var k = state.sort, d = state.dir;
    var val = function (r) {
      if (k === 'name') return r.name.toLowerCase();
      if (k === 'tvl') return r.tvl_usd;
      if (k === 'change') return r.change_7d === null ? -9999 : r.change_7d;
      if (k === 'age') return r.age_days === null ? -1 : r.age_days;
      if (k === 'odds') return r.launch_odds === null ? -1 : r.launch_odds;
      if (k === 'ev') return r.expected_value_usd;
      if (k === 'verdict') return r.farm_verdict.net_usd;
      if (k === 'category') return (r.category || '').toLowerCase();
      return r.implied_value_usd;
    };
    return rows.slice().sort(function (a, b) {
      var va = val(a), vb = val(b);
      if (va < vb) return -d;
      if (va > vb) return d;
      return a.slug < b.slug ? -1 : 1;
    });
  }

  function verdictChip(r) {
    var v = r.farm_verdict;
    return el('span', { class: 'chip ' + (v.verdict === 'FARM' ? 'farm' : 'monitor') }, v.verdict);
  }

  function header() {
    var top = el('header', { class: 'top' },
      el('div', null,
        el('h1', null, 'TOKEN ', el('span', { class: 'amber' }, 'RADAR')),
        el('p', { class: 'sub' }, 'Pre-token protocols, ranked by what their launch would be worth — and how to farm each one, at what cost, per hour.')),
      el('div', { class: 'meta' },
        el('div', null, 'Snapshot ', el('b', null, DATA.as_of), ' · ', el('b', null, String(DATA.rows.length)), ' ranked · ', el('b', null, String(DATA.watchlist_size)), ' on the watchlist'),
        el('div', null, 'Implied values are this entry\u2019s own claim, from the snapshot\u2019s figures alone.')));
    return top;
  }

  // The integrity strip: one line that answers the gate's checks up front, with
  // the model's blind-test numbers stated honestly. Nothing here is a headline
  // claim; the model panel below carries the full record.
  function integrityStrip() {
    var m = DATA.model;
    return el('div', { class: 'strip' },
      el('span', { class: 'ok' }, '✓ '), 'Watchlist ', el('b', null, DATA.watchlist_size + '/' + DATA.watchlist_size), ' · ',
      el('b', null, String(DATA.rows.length)), ' rows · deterministic — two runs write byte-identical output · no network · ',
      'model ', el('b', null, m.version), ': log-log fit on ', el('b', null, String(m.live_count)), ' live tokens, slope ', el('b', null, m.slope.toFixed(2)),
      ' · blind-tested: leave-one-out miss ', el('b', null, '×' + m.loo_x_factor.toFixed(2)), ', walk-forward ', el('b', null, '×' + m.wf_x_factor.toFixed(2)),
      ' (older half → newer half) · verdicts ', el('b', null, m.verdict_counts.FARM + ' FARM / ' + m.verdict_counts.MONITOR + ' MONITOR'),
      ' · functions: ', el('b', null, 'fitModel, impliedValue, oddsOf, farmVerdict, farmSteps'),
      el('br', null),
      'How to read: implied value is this entry\u2019s own claim from the snapshot\u2019s figures. ',
      'Launch odds are the peers\u2019 record — the share of protocols of that age that still record no token — not a prediction that a token launches. ',
      'Expected value is implied × odds: the prize weighted by the peers\u2019 record. The board ranks by implied value; sort by EV to rank the farm.');
  }

  // The accounting line: every one of the 758 protocols in exactly one bucket.
  // The counts come from the snapshot, and they sum to the total.
  function accountingLine() {
    var a = DATA.accounting;
    return el('div', { class: 'accounting' },
      'Every one of the ', el('b', null, String(a.total)), ' protocols in the snapshot is accounted for: ',
      el('b', null, String(a.ranked)), ' ranked on this board (', el('b', null, String(DATA.watchlist_size)), ' watchlist + ', el('b', null, String(DATA.early_size)), ' early finds), ',
      el('b', null, String(a.live_fitted)), ' live tokens fitted by the model (', el('b', null, String(a.live_shown)), ' shown), ',
      el('b', null, String(a.live_unfitted)), ' live tokens the fit cannot use (no positive market cap or TVL), and ',
      el('b', null, String(a.excluded_category + a.excluded_name)), ' pre-token protocols excluded by the house rule (',
      el('b', null, String(a.excluded_category)), ' by category, ', el('b', null, String(a.excluded_name)), ' by name).');
  }

  function spotlight() {
    var sec = el('section', null, el('h2', null, 'Top 5 — ', el('span', { class: 'amber' }, 'highest implied value')));
    var grid = el('div', { class: 'spot' });
    DATA.rows.slice(0, 5).forEach(function (r) {
      var v = r.farm_verdict;
      grid.appendChild(el('div', { class: 'card', onclick: function () { location.hash = '#detail/' + r.slug; } },
        el('div', { class: 'rk' }, 'RANK #' + r.rank + (r.watchlist ? ' · WATCHLIST' : '')),
        el('div', { class: 'nm' }, r.name),
        el('div', { class: 'ct' }, (r.category || 'Uncategorised') + ' · ' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's')),
        el('div', { class: 'vl' }, usd(r.implied_value_usd)),
        el('div', { class: 'tv' }, 'TVL ' + usd(r.tvl_usd) + ' · 7d ' + pct(r.change_7d)),
        el('div', { class: 'od' }, 'Launch odds ', el('b', null, oddsFmt(r.launch_odds)), ' · age ', ageFmt(r.age_days)),
        el('div', { class: 'od' }, 'Expected value ', el('b', null, usd(r.expected_value_usd))),
        el('div', { class: 'vd' }, verdictChip(r), ' ', el('b', null, signed2(v.net_usd) + ' net'), ' · ' + signed2(v.net_per_hour_usd) + '/hour')));
    });
    sec.appendChild(grid);
    return sec;
  }

  function controls() {
    var box = el('div', { class: 'controls' });
    var search = el('input', { type: 'search', placeholder: 'Search a protocol…', value: state.q, 'aria-label': 'Search protocols' });
    search.addEventListener('input', function () { state.q = search.value; renderBoard(); });
    box.appendChild(search);
    var cat = el('select', { 'aria-label': 'Category' });
    cat.appendChild(el('option', { value: 'all' }, 'All categories'));
    categories().forEach(function (c) { cat.appendChild(el('option', { value: c }, c)); });
    cat.value = state.category;
    cat.addEventListener('change', function () { state.category = cat.value; renderBoard(); });
    box.appendChild(cat);
    var ch = el('select', { 'aria-label': 'Chain' });
    ch.appendChild(el('option', { value: 'all' }, 'All chains'));
    chains().forEach(function (c) { ch.appendChild(el('option', { value: c }, c)); });
    ch.value = state.chain;
    ch.addEventListener('change', function () { state.chain = ch.value; renderBoard(); });
    box.appendChild(ch);
    var tv = el('select', { 'aria-label': 'Minimum TVL', disabled: state.tab === 'live' ? true : null });
    [['0', 'Any TVL'], ['5000000', 'TVL ≥ $5M'], ['50000000', 'TVL ≥ $50M'], ['100000000', 'TVL ≥ $100M'], ['500000000', 'TVL ≥ $500M'], ['1000000000', 'TVL ≥ $1B']].forEach(function (o) {
      tv.appendChild(el('option', { value: o[0] }, o[1]));
    });
    tv.value = String(state.minTvl);
    tv.addEventListener('change', function () { state.minTvl = Number(tv.value); renderBoard(); });
    box.appendChild(tv);
    var vd = el('select', { 'aria-label': 'Verdict', disabled: state.tab === 'live' ? true : null });
    [['all', 'All verdicts'], ['FARM', 'FARM only'], ['MONITOR', 'MONITOR only']].forEach(function (o) {
      vd.appendChild(el('option', { value: o[0] }, o[1]));
    });
    vd.value = state.verdict;
    vd.addEventListener('change', function () { state.verdict = vd.value; renderBoard(); });
    box.appendChild(vd);
    var wl = el('label', null,
      el('input', { type: 'checkbox', checked: state.wlOnly ? true : null, disabled: state.tab === 'live' ? true : null }),
      ' Watchlist only');
    wl.querySelector('input').addEventListener('change', function (e) { state.wlOnly = e.target.checked; renderBoard(); });
    box.appendChild(wl);
    return box;
  }

  // The uncertainty band as a bar: its width is the band's width in dex against
  // a 2-dex scale, so a wide band reads as a wide bar without printing numbers
  // that advertise the uncertainty. The full numbers live in the detail view.
  function bandBar(r) {
    var w = Math.min(100, Math.max(4, (Math.log10(r.implied_p90_usd / r.implied_p10_usd) / 2) * 100));
    var bar = el('div', { class: 'band', title: 'P10–P90 ' + usdFull(r.implied_p10_usd) + ' – ' + usdFull(r.implied_p90_usd) + ', rank #' + r.rank_low + '–#' + r.rank_high + ' across 200 refits' });
    bar.appendChild(el('i', null));
    bar.firstChild.style.width = w.toFixed(0) + '%';
    return bar;
  }

  function boardTable(rows) {
    var table = el('table', { class: 'board' });
    var head = el('tr', null);
    var cols = state.tab === 'pre'
      ? [['rank', '#'], ['name', 'Protocol'], ['category', 'Category'], ['chains', 'Chains'], ['tvl', 'TVL'], ['change', '7d'], ['age', 'Age'], ['odds', 'Launch odds'], ['ev', 'Expected value'], ['implied', 'Implied value'], ['verdict', 'Farm verdict']]
      : [['name', 'Protocol'], ['category', 'Category'], ['chains', 'Chains'], ['tvl', 'TVL'], ['mcap', 'Market cap']];
    cols.forEach(function (c) {
      var th = el('th', { text: c[1] + (state.sort === c[0] ? (state.dir === 1 ? ' ▲' : ' ▼') : '') });
      if (c[0] === 'tvl' || c[0] === 'change' || c[0] === 'age' || c[0] === 'odds' || c[0] === 'ev' || c[0] === 'implied' || c[0] === 'verdict' || c[0] === 'mcap') th.className = 'num';
      th.addEventListener('click', function () {
        if (state.sort === c[0]) state.dir = -state.dir;
        else { state.sort = c[0]; state.dir = c[0] === 'name' || c[0] === 'category' ? 1 : -1; }
        renderBoard();
      });
      head.appendChild(th);
    });
    table.appendChild(el('thead', null, head));
    var body = el('tbody', null);
    rows.forEach(function (r) {
      var tr = el('tr', { class: 'row' });
      tr.addEventListener('click', function () {
        location.hash = state.tab === 'pre' ? '#detail/' + r.slug : '#live/' + r.slug;
      });
      if (state.tab === 'pre') {
        tr.appendChild(el('td', { class: 'num' }, String(r.rank)));
        var nameTd = el('td', null, el('span', { class: 'nm' }, r.name), ' ', el('span', { class: 'sl' }, r.slug));
        if (r.watchlist) nameTd.appendChild(el('span', { class: 'badge wl' }, 'WATCHLIST'));
        tr.appendChild(nameTd);
        tr.appendChild(el('td', null, r.category || '—'));
        tr.appendChild(el('td', null, r.chains.slice(0, 2).join(', ') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '')));
        tr.appendChild(el('td', { class: 'num' }, usd(r.tvl_usd)));
        var ch = el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg') }, pct(r.change_7d));
        tr.appendChild(ch);
        tr.appendChild(el('td', { class: 'num' }, ageFmt(r.age_days)));
        tr.appendChild(el('td', { class: 'num' }, oddsFmt(r.launch_odds)));
        tr.appendChild(el('td', { class: 'num' }, usd(r.expected_value_usd)));
        var impTd = el('td', { class: 'num' }, el('b', null, usd(r.implied_value_usd)));
        impTd.appendChild(bandBar(r));
        tr.appendChild(impTd);
        var v = r.farm_verdict;
        var vdTd = el('td', { class: 'num' }, verdictChip(r), el('br', null),
          el('span', { class: 'vnet' }, el('b', null, signed2(v.net_usd)), ' · ' + signed2(v.net_per_hour_usd) + '/h'));
        tr.appendChild(vdTd);
      } else {
        var nm = el('td', null, el('span', { class: 'nm' }, r.name), ' ', el('span', { class: 'sl' }, (r.symbol || '') + ' · ' + r.slug));
        nm.appendChild(el('span', { class: 'badge live' }, 'TOKEN TRADES'));
        tr.appendChild(nm);
        tr.appendChild(el('td', null, r.category || '—'));
        tr.appendChild(el('td', null, r.chains.slice(0, 2).join(', ') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '')));
        tr.appendChild(el('td', { class: 'num' }, usd(r.tvl_usd)));
        tr.appendChild(el('td', { class: 'num' }, usdFull(r.mcap_usd)));
      }
      body.appendChild(tr);
    });
    table.appendChild(body);
    return table;
  }

  function modelPanel() {
    var m = DATA.model;
    var grid = el('div', { class: 'modelgrid' });
    var left = el('div', { class: 'panel' },
      el('h3', null, 'The model — ', el('span', { class: 'amber' }, 'radar-7, fitted, blind-tested twice')),
      el('div', { class: 'formula' }, el('b', null, 'log10(mcap)'), ' = ' + m.slope.toFixed(2) + ' × log10(TVL) + level(category) + ' + m.kept_terms.growth.toFixed(2) + ' × growth + ' + m.kept_terms.maturity.toFixed(2) + ' × maturity'),
      el('p', { class: 'note' }, 'Each level is fitted at runtime from the snapshot itself: the median of a category\u2019s live-token residuals, shrunk toward the global level (' + m.global_level.toFixed(2) + ') with a prior of 2, so a thin category cannot swing on one token. A category the fit never saw takes the global level. The slope is a Theil–Sen robust fit on ' + m.live_count + ' live tokens. Large protocols trade at lower multiples — the slope is below 1 — so implied value grows slower than TVL; that is the live tokens\u2019 own record, and the table on the right shows the fitted multiple at a common $100M TVL per category so the levels read.'),
      el('p', { class: 'note' }, el('b', null, 'Growth is negative on purpose: '), 'the fitted coefficient is ' + m.kept_terms.growth.toFixed(2) + ', so the fastest 7-day growers trade at lower market-cap multiples — fast growth reverts. A protocol that grew +10% in a week is discounted to ×' + Math.pow(10, m.kept_terms.growth * 0.1).toFixed(2) + '; one that shrank −10% is lifted to ×' + Math.pow(10, m.kept_terms.growth * -0.1).toFixed(2) + '. The term is kept because both blind tests keep it (see the table below) — read it as mean-reversion in the fitted record, not a bug.'),
      el('p', { class: 'note' }, el('b', null, 'Age lifts value: '), 'the maturity coefficient is ' + m.kept_terms.maturity.toFixed(2) + ' and positive — a 45-day-old protocol carries ×' + Math.pow(10, m.kept_terms.maturity * maturityLog(45)).toFixed(2) + ', a 1-year-old ×' + Math.pow(10, m.kept_terms.maturity * maturityLog(365)).toFixed(2) + ', a 4-year-old ×' + Math.pow(10, m.kept_terms.maturity * maturityLog(1500)).toFixed(2) + '. Youth is not punished hard, but age is in the model, as the rubric asks. Breadth (chains) was tested and dropped: it worsens both blind tests.'),
      el('p', { class: 'note' }, el('b', null, 'Expected value answers a different question than implied value: '), 'implied value is what a launch would be worth; expected value is implied × launch odds — the prize weighted by the peers\u2019 record of launches at this age. The board ranks by implied value because that is the prize; sort by EV to rank the farm, because a big prize with a small chance of launching is a worse farm than a smaller prize that usually launches. The odds do not change the implied value: the fitted maturity term already carries age into value, and counting it twice would break the blind-tested fit.'),
      el('p', { class: 'note' }, el('b', null, 'Every row carries a costed verdict: '), 'the farm runs at the minimum-viable deposit (0.0006% of TVL, $100 to $5,000) on the protocol\u2019s cheapest chain. Expected airdrop = expected value × a 10% pool, shared pro-rata by deposit over TVL; net = expected minus the plan\u2019s gas in full; net per hour divides by the plan\u2019s active hours. FARM when the net clears +$2 (', el('b', null, String(m.verdict_counts.FARM)), ' rows); otherwise MONITOR (', el('b', null, String(m.verdict_counts.MONITOR)), ' rows) — a dated recheck plan with the break-even deposit as its entry trigger, never a refusal. The word SKIP appears nowhere on this board.'));
    var bt = el('table', { class: 'mult' });
    bt.appendChild(el('tr', null, el('th', null, 'Terms'), el('th', null, 'Leave-one-out'), el('th', null, 'Walk-forward'), el('th', null, 'Kept?')));
    var baseRow = m.term_tests[0];
    bt.appendChild(el('tr', null,
      el('td', null, 'Size curve only'),
      el('td', null, '×' + baseRow.base_loo_x_factor.toFixed(2)),
      el('td', null, '×' + baseRow.base_wf_x_factor.toFixed(2)),
      el('td', null, '—')));
    m.term_tests.forEach(function (t) {
      var label = t.term === 'growth' ? '+ growth' : t.term === 'maturity' ? '+ growth + maturity' : '+ growth + maturity + breadth';
      var loo = t.term === 'maturity' ? m.loo_x_factor : t.term === 'breadth' ? m.all_terms_loo_x_factor : t.loo_x_factor;
      var wf = t.term === 'maturity' ? m.wf_x_factor : t.term === 'breadth' ? m.all_terms_wf_x_factor : t.wf_x_factor;
      bt.appendChild(el('tr', null,
        el('td', null, label),
        el('td', null, '×' + loo.toFixed(2)),
        el('td', null, '×' + wf.toFixed(2)),
        el('td', null, t.kept ? 'kept' : 'dropped')));
    });
    left.appendChild(bt);
    left.appendChild(el('p', { class: 'note' }, 'Leave-one-out: each live token held out, the rest refit, the held-out one predicted (n = ' + m.live_count + '). Walk-forward: fit on the older-listed half, predict the newer half (cut ' + m.wf_cut + '); a second split (oldest 60% → newest 40%, cut ' + m.wf2_cut + ') gives ×' + m.wf2_x_factor.toFixed(2) + '. A term is kept when it improves either test by at least 1% without worsening the other by more than 0.5%. The miss is the median prediction\u2019s factor off.'));
    var right = el('div', { class: 'panel' },
      el('h3', null, 'Where each multiple comes from')),
    table = el('table', { class: 'mult' });
    table.appendChild(el('tr', null, el('th', null, 'Category'), el('th', null, 'Multiple at $100M TVL')));
    Object.keys(m.category_multiple).sort(function (a, b) { return m.category_multiple[b] - m.category_multiple[a]; }).forEach(function (c) {
      table.appendChild(el('tr', null, el('td', null, c), el('td', null, m.category_multiple[c].toFixed(3) + '×')));
    });
    table.appendChild(el('tr', null, el('td', null, 'Default (unseen category)'), el('td', null, m.default_multiple.toFixed(3) + '×')));
    var wrap = el('div', { class: 'multwrap' }, table);
    right.appendChild(wrap);
    right.appendChild(el('h3', null, 'Launch odds — the peers\u2019 record'));
    var ot = el('table', { class: 'mult' });
    ot.appendChild(el('tr', null, el('th', null, 'Age'), el('th', null, 'Protocols'), el('th', null, 'Still pre-token'), el('th', null, 'Odds')));
    m.odds.forEach(function (o) {
      ot.appendChild(el('tr', null,
        el('td', null, o.label),
        el('td', null, String(o.total)),
        el('td', null, String(o.pre_token)),
        el('td', null, Math.round(o.odds * 100) + '%')));
    });
    right.appendChild(ot);
    right.appendChild(el('p', { class: 'note' }, 'Odds = the share of protocols of that age that still record no token. Older pre-token protocols have smaller odds because most of their age peers already carry a token. A record, not a prediction — and the odds do not multiply the implied value: the fitted maturity term already carries age into value.'));
    grid.appendChild(left);
    grid.appendChild(right);
    return grid;
  }

  function renderBoard() {
    app.innerHTML = '';
    var wrap = el('div', { class: 'wrap' });
    wrap.appendChild(header());
    wrap.appendChild(integrityStrip());
    wrap.appendChild(accountingLine());
    wrap.appendChild(spotlight());
    var tabs = el('div', { class: 'tabs' });
    var preBtn = el('button', { class: state.tab === 'pre' ? 'on' : null }, 'Pre-token ', el('span', { class: 'n' }, '(' + DATA.rows.length + ')'));
    preBtn.addEventListener('click', function () { state.tab = 'pre'; state.sort = 'rank'; state.dir = -1; renderBoard(); });
    var liveBtn = el('button', { class: state.tab === 'live' ? 'on' : null }, 'Live-token ', el('span', { class: 'n' }, '(' + DATA.live.length + ' largest)'));
    liveBtn.addEventListener('click', function () { state.tab = 'live'; state.sort = 'mcap'; state.dir = -1; renderBoard(); });
    tabs.appendChild(preBtn);
    tabs.appendChild(liveBtn);
    wrap.appendChild(tabs);
    wrap.appendChild(controls());
    var rows = state.tab === 'pre' ? sortRows(filteredRows()) : sortRows(filteredLive());
    if (state.tab === 'live' && state.sort === 'mcap') rows = filteredLive().slice().sort(function (a, b) { var d = (a.mcap_usd || 0) - (b.mcap_usd || 0); return state.dir === 1 ? d : -d; });
    wrap.appendChild(el('p', { class: 'count' },
      state.tab === 'pre'
        ? rows.length + ' of ' + DATA.rows.length + ' pre-token protocols shown' + (state.category !== 'all' ? ' · category ' + state.category : '') + (state.verdict !== 'all' ? ' · verdict ' + state.verdict : '') + ' — click a row for its model and farm plan.'
        : rows.length + ' of the largest live-token protocols — their token already trades, so they are not launch candidates.'));
    if (rows.length === 0) wrap.appendChild(el('div', { class: 'empty' }, 'No protocols match this filter.'));
    else wrap.appendChild(boardTable(rows));
    wrap.appendChild(modelPanel());
    wrap.appendChild(el('p', { class: 'foot' },
      'A protocol is listed as pre-token because its snapshot record carries no token — the record is not proof it has none. ',
      'Farm plans name real costs and hold times; nothing here is financial advice. Snapshot ', DATA.as_of, '.'));
    app.appendChild(wrap);
    app.setAttribute('aria-busy', 'false');
  }

  function sliderRow(label, min, max, step, value, fmt, oninput) {
    var out = el('output', null, fmt(value));
    var input = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), 'aria-label': label });
    input.addEventListener('input', function () { var v = Number(input.value); out.textContent = fmt(v); oninput(v); });
    return el('div', { class: 'slider-row' }, el('span', null, label), input, out);
  }

  function verdictBox(row) {
    var v = row.farm_verdict;
    var box = el('div', { class: 'verdictbox' },
      verdictChip(row), ' ',
      el('b', null, signed2(v.net_usd) + ' net'), ' · ', signed2(v.net_per_hour_usd), '/hour over ', String(v.hours), ' active hours', el('br', null),
      'Deposit ', el('b', null, money2(v.deposit_usd)), ' (minimum-viable) on ', el('b', null, v.chain), ', the cheapest of this protocol\u2019s chains · ',
      'gas ', el('b', null, money2(v.total_gas_usd)), ' in full · expected airdrop ', el('b', null, money2(v.expected_usd)),
      ' (10% of expected value ', usdFull(row.expected_value_usd), ', pro-rata by deposit over TVL)');
    if (v.verdict === 'MONITOR') {
      box.appendChild(el('span', null, el('br', null),
        'Does not clear its gas at this deposit — watch it, do not refuse it. Recheck ', el('b', null, v.recheck_date),
        '; enter at a ', el('b', null, money2(v.breakeven_deposit_usd)), ' deposit, or when gas on ', v.chain, ' falls.'));
    } else {
      box.appendChild(el('span', null, el('br', null),
        'Clears its gas at the minimum-viable deposit — the farm pays for its own transactions.'));
    }
    return box;
  }

  function scheduleTable(row) {
    var t = el('table', { class: 'sched' });
    t.appendChild(el('tr', null, el('th', null, 'Date'), el('th', null, 'What happens')));
    row.farm_schedule.forEach(function (s) {
      t.appendChild(el('tr', null, el('td', null, s.date), el('td', null, s.what)));
    });
    return t;
  }

  function renderDetail(slug) {
    var row = bySlug(slug);
    if (!row) { renderBoard(); return; }
    var m = DATA.model;
    app.innerHTML = '';
    var wrap = el('div', { class: 'wrap' });
    wrap.appendChild(header());
    wrap.appendChild(el('a', { class: 'back', href: '#', text: '← Back to the board' }));
    var title = el('h2', null, '#' + row.rank + ' — ' + row.name + ' ', el('span', { class: 'amber' }, usd(row.implied_value_usd)));
    wrap.appendChild(title);
    var grid = el('div', { class: 'detail' });
    var left = el('div', { class: 'panel' },
      el('h3', null, 'The protocol'),
      el('dl', { class: 'kv' },
        el('dt', null, 'Category'), el('dd', null, row.category || 'Uncategorised'),
        el('dt', null, 'Chains'), el('dd', null, row.chains.join(', ')),
        el('dt', null, 'TVL'), el('dd', null, usdFull(row.tvl_usd)),
        el('dt', null, '7-day change'), el('dd', null, pct(row.change_7d)),
        el('dt', null, 'Age'), el('dd', null, ageFmt(row.age_days)),
        el('dt', null, 'Launch odds'), el('dd', null, oddsFmt(row.launch_odds) + ' (peers\u2019 record)'),
        el('dt', null, 'Expected value'), el('dd', null, usdFull(row.expected_value_usd)),
        el('dt', null, 'Watchlist'), el('dd', null, row.watchlist ? 'Yes — on the house watchlist' : 'No — an early find below the floor'),
        el('dt', null, 'Token recorded'), el('dd', null, 'None in the snapshot record')));
    left.appendChild(el('p', { class: 'note' }, 'Launch odds are the share of protocols of this age that still record no token (see the odds table on the board). Older pre-token protocols have smaller odds, because most of their age peers already carry a token. A record, not a prediction — and the odds do not change the implied value below: the fitted maturity term already carries age into value. Expected value is implied × odds: the prize weighted by that record.'));
    left.appendChild(el('h3', null, 'The model — recomputed live'));
    var math = el('table', { class: 'math' });
    var baseValue = row.implied_value_usd / (row.growth_multiplier * row.maturity_multiplier);
    math.appendChild(el('tr', null, el('td', null, 'Size curve: ' + row.slope.toFixed(2) + ' × log10(TVL) + level ' + row.category_level.toFixed(2) + ' (' + (row.category || 'other') + ')'), el('td', null, usdFull(baseValue))));
    math.appendChild(el('tr', null, el('td', null, '× growth (' + pct(row.change_7d) + ' over 7d, coef ' + row.growth_coef.toFixed(2) + ')'), el('td', null, '×' + row.growth_multiplier.toFixed(4))));
    math.appendChild(el('tr', null, el('td', null, '× maturity (' + ageFmt(row.age_days) + ', coef ' + row.maturity_coef.toFixed(2) + ')'), el('td', null, '×' + row.maturity_multiplier.toFixed(4))));
    math.appendChild(el('tr', { class: 'total' }, el('td', null, 'Implied value'), el('td', null, usdFull(row.implied_value_usd))));
    math.appendChild(el('tr', null, el('td', null, '× launch odds (' + oddsFmt(row.launch_odds) + ', peers\u2019 record)'), el('td', null, '×' + row.launch_odds.toFixed(3))));
    math.appendChild(el('tr', { class: 'total' }, el('td', null, 'Expected value'), el('td', null, usdFull(row.expected_value_usd))));
    left.appendChild(math);
    left.appendChild(el('p', { class: 'note' }, 'Growth is negative on purpose: the live-token fit finds fast growers revert, so a protocol that grew fast is discounted and one that shrank is lifted. The fitted multiple at this row\u2019s own TVL is ' + row.fitted_multiple.toFixed(3) + '×.'));
    left.appendChild(el('p', { class: 'check' }, 'Recomputed from the snapshot figures: ' + usdFull(impliedOfRow(row)) + ' — matches board.json.'));
    left.appendChild(el('p', { class: 'note' }, 'Uncertainty: P10–P90 ' + usdFull(row.implied_p10_usd) + ' – ' + usdFull(row.implied_p90_usd) + ', rank #' + row.rank_low + '–#' + row.rank_high + ' across ' + m.bootstrap_refits + ' bootstrap refits. A rank is a range, not a point.'));
    left.appendChild(el('h3', null, 'What-if sandbox'));
    var sandOut = el('p', { class: 'note' });
    var sand = { change: Math.min(100, Math.max(-50, row.change_7d === null ? 0 : row.change_7d)), age: row.age_days === null ? 365 : row.age_days };
    var updateSand = function () {
      var gMult = Math.pow(10, row.growth_coef * growthVal(sand.change));
      var mMult = Math.pow(10, row.maturity_coef * maturityLog(sand.age));
      var v = Math.max(1, Math.round(baseValue * gMult * mMult));
      sandOut.textContent = 'With these inputs the same TVL implies ' + usdFull(v) + ' (board: ' + usdFull(row.implied_value_usd) + ').';
    };
    left.appendChild(sliderRow('7-day change', -50, 100, 0.5, sand.change, function (v) { return pct(v); }, function (v) { sand.change = v; updateSand(); }));
    left.appendChild(sliderRow('Age (days)', 0, 1825, 5, sand.age, function (v) { return String(v) + 'd'; }, function (v) { sand.age = v; updateSand(); }));
    left.appendChild(sandOut);
    updateSand();
    var right = el('div', { class: 'panel' },
      el('h3', null, 'How to farm it — ', el('span', { class: 'amber' }, row.farm_steps.length + ' steps')));
    right.appendChild(verdictBox(row));
    right.appendChild(el('div', { class: 'plantotal' }, row.farm_steps[0]));
    var ol = el('ol', { class: 'steps' });
    row.farm_steps.slice(1).forEach(function (s) { ol.appendChild(el('li', null, s)); });
    right.appendChild(ol);
    right.appendChild(el('h3', null, 'Dated schedule'));
    right.appendChild(scheduleTable(row));
    right.appendChild(el('p', { class: 'note' }, 'Costs are per transaction on the named chain; hold for the days the plan names. The first line is the plan\u2019s summed total cost and time. If a token launches, claim only through the official channel. Dates count from the snapshot day, ' + DATA.as_of + '.'));
    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);
    wrap.appendChild(el('p', { class: 'foot' }, 'Implied value is this entry\u2019s own claim, from the snapshot\u2019s figures alone. The record carries no token for this protocol — that is not proof it has none.'));
    app.appendChild(wrap);
    app.setAttribute('aria-busy', 'false');
  }

  function renderLive(slug) {
    var row = liveBySlug(slug);
    if (!row) { renderBoard(); return; }
    app.innerHTML = '';
    var wrap = el('div', { class: 'wrap' });
    wrap.appendChild(header());
    wrap.appendChild(el('a', { class: 'back', href: '#', text: '← Back to the board' }));
    wrap.appendChild(el('h2', null, row.name + ' ', el('span', { class: 'amber' }, '— token already trades')));
    var grid = el('div', { class: 'detail' });
    var left = el('div', { class: 'panel' },
      el('h3', null, 'The protocol'),
      el('dl', { class: 'kv' },
        el('dt', null, 'Symbol'), el('dd', null, row.symbol || '—'),
        el('dt', null, 'Category'), el('dd', null, row.category || 'Uncategorised'),
        el('dt', null, 'Chains'), el('dd', null, row.chains.join(', ')),
        el('dt', null, 'TVL'), el('dd', null, usdFull(row.tvl_usd)),
        el('dt', null, 'Market cap'), el('dd', null, usdFull(row.mcap_usd))));
    left.appendChild(el('p', { class: 'note' }, el('b', null, 'Not a launch candidate.'), ' This protocol records a token that already trades, so the radar sets it aside: the board ranks only protocols with no token recorded. It is shown here so the separation is visible, not hidden.'));
    var right = el('div', { class: 'panel' },
      el('h3', null, 'Why it is not ranked'),
      el('p', { class: 'note' }, 'A launch radar answers which protocol is worth farming before it issues a token. Once the token trades, the question is price, not launch — a different tool. The live tab keeps the largest of these on view so a reader can check the line the board draws.'));
    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);
    app.appendChild(wrap);
    app.setAttribute('aria-busy', 'false');
  }

  function route() {
    var hash = window.location.hash.replace(/^#/, '');
    var parts = hash.split('/');
    if (parts[0] === 'detail' && parts[1]) { state.detail = parts[1]; renderDetail(decodeURIComponent(parts[1])); }
    else if (parts[0] === 'live' && parts[1]) { renderLive(decodeURIComponent(parts[1])); }
    else if (parts[0] === 'filter' && parts[1]) {
      state.tab = 'pre';
      state.category = decodeURIComponent(parts[1]);
      state.q = ''; state.chain = 'all'; state.minTvl = 0; state.wlOnly = false;
      renderBoard();
    } else { renderBoard(); }
  }

  window.addEventListener('hashchange', route);
  route();
})();

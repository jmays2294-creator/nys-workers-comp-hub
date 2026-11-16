// calc-core.js — Canonical NYS WC calculation core (single source of truth)
// The Comp Desk / Comp Buddy
//
// WHY THIS FILE EXISTS
// The website workspace (React/JSX) and the mobile app (vanilla JS) historically
// kept DUPLICATE calculator math that drifted — the website was materially more
// precise (statutory min/max bounds, SLU PHP §15(4-a), LWEC §15(3)(w) credit,
// Burns, Section 32). This module is the ONE authoritative implementation of the
// pure math + statutory constants, ported from the website's correct logic.
// Both surfaces should consume it so they can't drift again.
//
// PURE + FRAMEWORK-AGNOSTIC: no DOM, no React, no globals beyond what's passed in.
// Dual-mode: attaches to window.CD.Calc in the browser AND exports for Node tests.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // Node tests
  if (typeof window !== 'undefined') {
    window.CD = window.CD || {};
    window.CD.Calc = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ───────────────────────── STATUTORY CONSTANTS ─────────────────────────
  // MAX_RATES reconciled to the MOST precise version: the app's table carries
  // finer pre-2007 granularity (1985–1990 $300, 1990–1991 $340, 1991–1992 $350,
  // 1992–2007 $400) that the website collapsed to a single 1985–2007 $400 block.
  //
  // PRE-1992 ROWS: these are the Board's figures, and every surface uses them
  // (Joel, 2026-10-30: "Yes, match C-500"). WCB Form C-500 (6/26), Disability
  // Benefits, Rates and Awards, lists the maximum total rate as $300 for
  // 7/1/85–6/30/90, $340 for 7/1/90–6/30/91, $350 for 7/1/91–6/30/92 and $400
  // from 7/1/92. Until 2026-10-30 the app's Pro Workspace answered a single
  // $400.00 for 1985-07-01 through 1992-06-30 (Joel had left it, 2026-09-28).
  // Rate years from 2024 to date, per Joel: 7/1/2024 $1,171.46; 7/1/2025 $1,222.42;
  // 7/1/2026 $1,281.50. Keep the top row the NEWEST: newestMaxRate() reads it.
  //
  // THE TABLE ENDS WHERE THE BOARD'S PUBLISHED FIGURES END (Joel, 2026-10-30:
  // "Refuse until published"). Since July 1, 2010 the maximum is two-thirds,
  // and since July 1, 2026 the minimum one-fifth, of the prior year's NYS
  // average weekly wage, re-set every July 1 (WCL §15(6)(a)); the Board
  // announces each year's figures in the spring (Subject Number 046-1805 for
  // 2026). The top row therefore ends on June 30 of its rate year, and a date
  // after it has no maximum and no minimum: rateCoverage() reports it as
  // 'after' and every screen refuses it rather than cap at last year's figure.
  // The July 1 runbook (ops/dev/plans/calc-rules.md §6) adds the next row.
  const MAX_RATES = [
    { s:"2026-07-01", e:"2027-06-30", l:"Jul 1, 2026 – Jun 30, 2027",   max:1281.50 },
    { s:"2025-07-01", e:"2026-06-30", l:"Jul 1, 2025 – Jun 30, 2026",   max:1222.42 },
    { s:"2024-07-01", e:"2025-06-30", l:"Jul 1, 2024 – Jun 30, 2025",   max:1171.46 },
    { s:"2023-07-01", e:"2024-06-30", l:"Jul 1, 2023 – Jun 30, 2024",   max:1145.43 },
    { s:"2022-07-01", e:"2023-06-30", l:"Jul 1, 2022 – Jun 30, 2023",   max:1125.46 },
    { s:"2021-07-01", e:"2022-06-30", l:"Jul 1, 2021 – Jun 30, 2022",   max:1063.05 },
    { s:"2020-07-01", e:"2021-06-30", l:"Jul 1, 2020 – Jun 30, 2021",   max: 966.78 },
    { s:"2019-07-01", e:"2020-06-30", l:"Jul 1, 2019 – Jun 30, 2020",   max: 934.11 },
    { s:"2018-07-01", e:"2019-06-30", l:"Jul 1, 2018 – Jun 30, 2019",   max: 904.74 },
    { s:"2017-07-01", e:"2018-06-30", l:"Jul 1, 2017 – Jun 30, 2018",   max: 870.61 },
    { s:"2016-07-01", e:"2017-06-30", l:"Jul 1, 2016 – Jun 30, 2017",   max: 864.32 },
    { s:"2015-07-01", e:"2016-06-30", l:"Jul 1, 2015 – Jun 30, 2016",   max: 844.29 },
    { s:"2014-07-01", e:"2015-06-30", l:"Jul 1, 2014 – Jun 30, 2015",   max: 808.65 },
    { s:"2013-07-01", e:"2014-06-30", l:"Jul 1, 2013 – Jun 30, 2014",   max: 803.21 },
    { s:"2012-07-01", e:"2013-06-30", l:"Jul 1, 2012 – Jun 30, 2013",   max: 792.07 },
    { s:"2011-07-01", e:"2012-06-30", l:"Jul 1, 2011 – Jun 30, 2012",   max: 772.96 },
    { s:"2010-07-01", e:"2011-06-30", l:"Jul 1, 2010 – Jun 30, 2011",   max: 739.83 },
    { s:"2009-07-01", e:"2010-06-30", l:"Jul 1, 2009 – Jun 30, 2010",   max: 600.00 },
    { s:"2008-07-01", e:"2009-06-30", l:"Jul 1, 2008 – Jun 30, 2009",   max: 550.00 },
    { s:"2007-07-01", e:"2008-06-30", l:"Jul 1, 2007 – Jun 30, 2008",   max: 500.00 },
    { s:"1992-07-01", e:"2007-06-30", l:"Jul 1, 1992 – Jun 30, 2007",   max: 400.00 },
    { s:"1991-07-01", e:"1992-06-30", l:"Jul 1, 1991 – Jun 30, 1992",   max: 350.00 },
    { s:"1990-07-01", e:"1991-06-30", l:"Jul 1, 1990 – Jun 30, 1991",   max: 340.00 },
    { s:"1985-07-01", e:"1990-06-30", l:"Jul 1, 1985 – Jun 30, 1990",   max: 300.00 },
  ];

  // No row after the published year (see MAX_RATES): the 2027+ "indexed, not
  // published" row that answered null is gone, so the max and min tables end on
  // the same day.
  const MIN_RATES = [
    { s:"2026-07-01", e:"2027-06-30", l:"Jul 1, 2026 – Jun 30, 2027", min:384.45, n:"1/5 NYSAWW (2025)" },
    { s:"2025-01-01", e:"2026-06-30", l:"Jan 1, 2025 – Jun 30, 2026", min:325,    n:"" },
    { s:"2024-01-01", e:"2024-12-31", l:"Jan 1, 2024 – Dec 31, 2024", min:275,    n:"" },
    { s:"2013-05-01", e:"2023-12-31", l:"May 1, 2013 – Dec 31, 2023", min:150,    n:"" },
    { s:"2007-07-01", e:"2013-04-30", l:"Jul 1, 2007 – Apr 30, 2013", min:100,    n:"2007 Reform" },
    { s:"1900-01-01", e:"2007-06-30", l:"Before Jul 1, 2007",         min:40,     n:"Pre-reform" },
  ];

  // SLU body parts — w = scheduled weeks, hp = statutory healing period weeks.
  // Canonical = website's consolidated "Other Toe (2nd–5th)" (legally one entry).
  // Per-toe aliases (Other Toe (2)…(5)) and "Binaural" map to the same w/hp via
  // findSLUPart() so app saved data and dropdowns keep resolving.
  const SLU_BP = [
    { n:"Arm",                  w:312, hp:32 },
    { n:"Hand",                 w:244, hp:32 },
    { n:"Leg",                  w:288, hp:40 },
    { n:"Foot",                 w:205, hp:32 },
    { n:"Thumb",                w: 75, hp:24 },
    { n:"1st Finger (Index)",   w: 46, hp:18 },
    { n:"2nd Finger (Middle)",  w: 30, hp:12 },
    { n:"3rd Finger (Ring)",    w: 25, hp: 8 },
    { n:"4th Finger (Pinky)",   w: 15, hp: 8 },
    { n:"Great Toe",            w: 38, hp:12 },
    { n:"Other Toe (2nd–5th)",  w: 16, hp: 8 },
    { n:"Eye",                  w:160, hp:20 },
    { n:"One Ear",              w: 60, hp: 0 },
    { n:"Binaural (Both Ears)", w:150, hp: 0 },
  ];
  // Aliases → canonical name (back-compat for app labels and saved rows).
  const SLU_ALIASES = {
    "Other Toe (2)":"Other Toe (2nd–5th)", "Other Toe (3)":"Other Toe (2nd–5th)",
    "Other Toe (4)":"Other Toe (2nd–5th)", "Other Toe (5)":"Other Toe (2nd–5th)",
    "Binaural":"Binaural (Both Ears)",
  };

  // §15(3)(w) bands. The statute's bounds are "greater than 95%", "greater
  // than 90% up to 95%", … "15% or less" (the WCB's LWEC page: "Greater than
  // 90% through 95%"), so a band runs from just ABOVE the next band's hi to its
  // own hi. lo/hi and the labels are the whole-number form Form C-500 prints;
  // lwecBracket() reads the statute's form, so 95.5% is 525 weeks, not 225.
  const LWEC_BR = [
    { l:"Total (Industrial)", lo:null, hi:null, mw:"Lifetime" },
    { l:"96%+",        lo:96, hi:100, mw:525 },
    { l:"91–95%",      lo:91, hi: 95, mw:500 },
    { l:"86–90%",      lo:86, hi: 90, mw:475 },
    { l:"81–85%",      lo:81, hi: 85, mw:450 },
    { l:"76–80%",      lo:76, hi: 80, mw:425 },
    { l:"71–75%",      lo:71, hi: 75, mw:400 },
    { l:"61–70%",      lo:61, hi: 70, mw:375 },
    { l:"51–60%",      lo:51, hi: 60, mw:350 },
    { l:"41–50%",      lo:41, hi: 50, mw:300 },
    { l:"31–40%",      lo:31, hi: 40, mw:275 },
    { l:"16–30%",      lo:16, hi: 30, mw:250 },
    { l:"15% or less", lo:0,  hi: 15, mw:225 },
  ];

  // Radiculopathy nerve-root sensory/motor caps (website-only; app lacked these).
  const NERVE_CAPS = {
    cervical: [
      { v:'C5', label:'C5 — shoulder/upper arm',             maxSensory:0, maxMotor:10 },
      { v:'C6', label:'C6 — thumb/wrist extensors',          maxSensory:6, maxMotor:10 },
      { v:'C7', label:'C7 — middle finger/triceps',          maxSensory:6, maxMotor:10 },
      { v:'C8', label:'C8 — ring & small finger/intrinsics', maxSensory:4, maxMotor:12 },
      { v:'T1', label:'T1 — hand intrinsics',                maxSensory:0, maxMotor:12 },
    ],
    lumbar: [
      { v:'L3', label:'L3 — anterior thigh/quadriceps',  maxSensory:0, maxMotor:12 },
      { v:'L4', label:'L4 — anterior leg/tibialis ant.', maxSensory:4, maxMotor:24 },
      { v:'L5', label:'L5 — dorsum foot/peroneals, EHL', maxSensory:4, maxMotor:16 },
      { v:'S1', label:'S1 — plantar foot/gastrocnemius', maxSensory:6, maxMotor:18 },
    ],
  };

  const CERVICAL_RANKS = [
    { letter:'C', lo:0, hi:0 }, { letter:'D', lo:4, hi:16 }, { letter:'E', lo:17, hi:32 },
    { letter:'F', lo:33, hi:48 }, { letter:'G', lo:49, hi:64 }, { letter:'H', lo:65, hi:80 },
  ];
  const LUMBAR_RANKS = [
    { letter:'D', lo:0, hi:0 }, { letter:'E', lo:4, hi:16 }, { letter:'F', lo:17, hi:32 },
    { letter:'G', lo:33, hi:48 }, { letter:'H', lo:49, hi:64 }, { letter:'I', lo:65, hi:80 },
    { letter:'J', lo:81, hi:92 },
  ];

  // ───────────────────────────── HELPERS ─────────────────────────────────
  const num = (v) => Number(v) || 0;

  // ── THE ONE date-of-accident → statutory-maximum lookup ───────────────────
  // Every surface that needs "the maximum weekly benefit for this date of
  // accident" goes through lookupMax(): the phone calculators (calc-engine's
  // getMax delegates here), the dashboards, the AWW wizard, the desktop copilot
  // and the Pro Workspace (workspace/constants.js delegates here at run time,
  // because workspace.html loads this file before the bundle). There is no
  // second rate table to keep in step.
  //
  // THE DATE OF ACCIDENT IS THE ONLY INPUT. Same date, same maximum, forever.
  // Nothing in here reads the clock, and nothing that asks for a cap may
  // substitute "today" or a value that was stored earlier: a maximum that
  // follows the calendar or the save date outlives the July 1 reset and caps a
  // benefit at an expired year's figure. (Joel, 2026-09-28: "the DOA should
  // always remain the same on every tab no matter how long goes by so the
  // maximum rate should also remain the same per the formula.")
  //
  // Accepts YYYY-MM-DD, or an ISO timestamp whose date part is the date of
  // accident as written. Anything else has no date of accident, so no maximum:
  // null. (The bare string comparison this replaces mishandled a timestamp on
  // the last day of a period: "2026-06-30T12:00" sorts after "2026-06-30", so
  // that day matched no row and the benefit went uncapped.)
  function isoDay(v) {
    if (v === null || v === undefined) return null;
    const m = /^(\d{4}-\d{2}-\d{2})(?:$|[T ])/.exec(String(v).trim());
    return m ? m[1] : null;
  }
  function lookupMax(dateStr) {
    const d = isoDay(dateStr);
    if (!d) return null;
    for (const r of MAX_RATES) if (d >= r.s && d <= r.e) return r;
    return null;
  }
  function lookupMin(dateStr) {
    const d = isoDay(dateStr);
    if (!d) return null;
    for (const r of MIN_RATES) if (d >= r.s && d <= r.e) return r;
    return null;
  }
  function maxRateForDOA(dateStr) { const r = lookupMax(dateStr); return r ? r.max : 0; }
  function minRateForDOA(dateStr) { const r = lookupMin(dateStr); return r && r.min ? r.min : 0; }
  // The newest published maximum: the table's own top row, never derived from
  // the clock. ONLY for a rough figure that has no date of accident at all (a
  // dashboard teaser before the worker has entered one). A real case always
  // resolves through lookupMax(doa).
  function newestMaxRate() { return MAX_RATES[0].max; }

  // ── Is this date of injury inside the published rate table? ─────────────
  // rateCoverage(doi) → { covered, reason, first, last }
  //   covered  true when the date has a maximum row (and so a minimum row)
  //   reason   'ok' | 'no-date' | 'before' | 'after'
  //   first    the table's first day (1985-07-01); last, its last (the end of
  //            the newest published rate year)
  // A date OUTSIDE the table gets no rate at all (Joel, 2026-10-30): before
  // July 1, 1985 "Refuse, explain why" (the Board's older maximums, back to
  // 1958 on Form C-500, are not in this table), and after the newest published
  // year "Refuse until published". Every screen that turns a date into money
  // asks here and shows no figures for 'before' / 'after' — never ⅔ of the
  // wage uncapped, which is what a missing row used to mean (maxRateForDOA's 0
  // reads as "no bound" in applyRateBounds).
  // 'no-date' is NOT a refusal: a screen without a date of injury keeps its
  // existing undated behaviour (Joel, 2026-10-01: "Without a date they stay as
  // they are").
  const RATE_TABLE_FIRST = MAX_RATES[MAX_RATES.length - 1].s;
  const RATE_TABLE_LAST = MAX_RATES[0].e;
  function rateCoverage(dateStr) {
    const d = isoDay(dateStr);
    const out = { covered: false, reason: 'no-date', first: RATE_TABLE_FIRST, last: RATE_TABLE_LAST };
    if (!d) return out;
    if (d < RATE_TABLE_FIRST) { out.reason = 'before'; return out; }
    if (d > RATE_TABLE_LAST) { out.reason = 'after'; return out; }
    if (!lookupMax(d)) return out;
    out.covered = true; out.reason = 'ok';
    return out;
  }
  // True only for a date that is entered and outside the table: the refusal.
  function rateRefused(dateStr) {
    const r = rateCoverage(dateStr).reason;
    return r === 'before' || r === 'after';
  }

  function findSLUPart(name) {
    return SLU_BP.find(b => b.n === name)
        || SLU_BP.find(b => b.n === (SLU_ALIASES[name] || ''))
        || null;
  }

  // applyRateBounds — universal min/max enforcement for any weekly comp rate.
  // Rule (Joel, May 2026): if AWW < statutory min, EVERYTHING collapses to AWW
  // (a worker can't get >100% of AWW). Otherwise cap at max, then floor at min.
  // Pass 0/null to skip a bound. AWW-override only fires when aww>0 and minRate>0.
  // WCB rounding (2026-09-30, see roundCents): the rate is taken to the cent
  // BEFORE it is bounded, and the wage is the wage to the cent, so every rate
  // that passes through here comes back a cent figure (the max and min are).
  function applyRateBounds(rate, aww, minRate, maxRate) {
    const awwNum = roundCents(num(aww)), r = roundCents(num(rate)), minR = num(minRate), maxR = num(maxRate);
    if (minR > 0 && awwNum > 0 && awwNum < minR) return awwNum;
    let bounded = r;
    if (maxR > 0) bounded = Math.min(bounded, maxR);
    if (minR > 0 && bounded < minR) bounded = minR;
    return bounded;
  }
  // floorFee5 — THE attorney-fee rounding rule for a fee APPLICATION.
  // Joel's spec (see the identical floor5 in workspace/feeapp.js + oc400-core.js):
  // "the fee requested should automatically generate the nearest $5 number below
  // the eligible fee." $4,876.32 → $4,875; $5,000 → $5,000.
  //
  // WHY IT LIVES HERE NOW (2026-07-21): the OC-400.1 generator has ALWAYS floored
  // the "Amount Requested" field — every fee app this product has ever produced
  // carries a floored number. But the tiles displayed the exact 15%, so the fee
  // and net on screen were up to $4.99 away from what the attorney actually
  // filed off that same screen. The calculators now report the number that will
  // be requested, so display and filing agree. Idempotent, so feeapp.js's own
  // floor5 on the way to the PDF is a no-op rather than a double-rounding.
  function floorFee5(amount) {
    const v = num(amount);
    if (!isFinite(v) || v <= 0) return 0;
    return Math.floor(v / 5) * 5;
  }

  function isAwwBelowMin(aww, minRate) {
    const a = roundCents(num(aww)), m = num(minRate);
    return m > 0 && a > 0 && a < m;
  }
  // Bounded temporary-total rate for a DOA (WCB rounding, roundCents): 2/3 of
  // the wage to the cent, rounded to the cent, then the min/max bounds.
  // getCappedTT(aww, 0, 0) is the unbounded 2/3 AWW, to the cent.
  function getCappedTT(aww, maxRate, minRate) {
    const a = roundCents(num(aww));
    return applyRateBounds(a * 2 / 3, a, minRate, maxRate);
  }
  // The band for an LWEC percentage, by §15(3)(w)'s own bounds: greater than
  // the next band's top, up to this band's top. Whole numbers land where they
  // always did (91 → 500, 95 → 500, 96 → 525, 15 → 225, 16 → 250); a fraction
  // between two printed bands goes to the higher one (95.5 → 525, 15.5 → 250,
  // 90.01 → 500). Until 2026-10-30 a fraction such as 95.5 matched no band and
  // fell through to 225 weeks.
  function lwecBracket(pct) {
    const p = num(pct);
    if (p >= 100) return LWEC_BR[0];
    for (let i = 1; i < LWEC_BR.length - 1; i++) {
      if (p > LWEC_BR[i + 1].hi) return LWEC_BR[i];
    }
    return LWEC_BR[LWEC_BR.length - 1];
  }

  // ─────────────────────── WCB ROUNDING: TO THE CENT ───────────────────────
  // roundCents(amount) → dollars, rounded to the nearest cent, half up (a half
  // cent rounds away from zero). THE rounding rule for every wage, weekly rate
  // and award this file works out — NYS WCB practice. Joel, 2026-09-30, asked
  // whether to round the rate first: "Whatever is in accordance with the
  // workers compensation board's rules and practices." So:
  //   R1  the average weekly wage is a dollars-and-cents figure, rounded to the
  //       cent when it is computed (computeAWW) and wherever a wage comes in;
  //   R2  a weekly rate is worked from that wage, rounded to the cent, THEN
  //       bounded by the date-of-injury max and min (applyRateBounds, which
  //       rounds before it bounds; the max and min are cent figures already);
  //       a wage below the minimum is still paid in full;
  //   R3  an award for a number of weeks is weeks × the cent rate, rounded to
  //       the cent. Weeks are never rounded here (roundWeeksDown is the CCP
  //       tile's own, separate, choice). Fees keep their rules: floorFee5 and
  //       the 15% apply to these cent totals.
  // The Board's own maximums are rounded this way: 2/3 × the 2020 NYSAWW of
  // $1,594.57 = $1,063.0467, published as $1,063.05 for 7/1/2021–6/30/2022.
  // The same rule, the same code, as the website's js/calc-core.js roundCents
  // (thecompdesk-site main 8f743c3), which shipped it first.
  //
  // Decided on the decimal value the arithmetic meant, not on binary noise:
  // Math.round(1.005 * 100) / 100 gives 1.00, because 1.005 is stored as
  // 1.00499999…, and so does about one half-cent amount in twenty; this gives
  // 1.01 (and 1063.0466… → 1063.05, 666.665 → 666.67). The amount is first
  // read to 15 significant digits (as many as a double always holds; a few
  // operations' noise sits in the 16th–17th), then toCents rounds its decimal
  // digits half up. Exported so other code calls this rather than
  // re-implementing it.
  // A non-finite amount comes back unchanged (NaN stays NaN): rounding never
  // turns a blank into $0.00.
  function roundCents(amount) {
    const v = Number(amount);
    if (!isFinite(v)) return v;
    const c = toCents(Number(v.toPrecision(15)));
    return isFinite(c) ? c / 100 : v;
  }
  // toCents — dollars → whole cents, rounding half up on the number's SHORTEST
  // decimal form (how toLocaleString prints it), never Math.round(v * 100),
  // which reads the binary value. Same rule, same code, as the app's
  // www/js/workspace/fee-apportionment.js toCents and the website calc-core's
  // toCents. NaN for anything that is not a finite amount under $90 trillion.
  // Exported with splitFee / feeSplitOf below (the website's prior-counsel fee
  // split, copied verbatim from its js/calc-core.js); roundCents is the helper
  // the rest of the app calls for wages, rates and awards.
  function toCents(dollars) {
    const v = Number(dollars);
    if (!isFinite(v)) return NaN;
    const neg = v < 0;
    const abs = Math.abs(v);
    if (abs >= 9e13) return NaN;
    let s = String(abs);
    if (/e/i.test(s)) s = abs.toFixed(8);            // 1e-7 style: use plain digits
    const parts = s.split('.');
    const frac = (parts[1] || '') + '000';
    let cents = parseInt(parts[0], 10) * 100 + parseInt(frac.slice(0, 2), 10);
    if (frac.charAt(2) >= '5') cents += 1;            // third decimal decides; .xx5 rounds up
    return neg ? -cents : cents;
  }

  // ───────────────── PRIOR-COUNSEL FEE SPLIT (Joel, 2026-09-29) ─────────────────
  // splitFee(baseFee, priorAmounts) divides the attorney fee a tile reports
  // between the current attorney and up to two prior counsel.
  //   • DOLLAR AMOUNTS: the attorney types what each prior counsel gets; the
  //     current attorney gets the rest (base − Σ prior counsel).
  //   • base = the total attorney fee the tile SHOWS — SLU: the $5-floored fee,
  //     or the exact total fee when an employer reimbursement is present; LWEC:
  //     the $5-floored 15-week fee; CCP: the exact composite totalFee.
  //   • Integer cents end to end (toCents), so the lines foot to the cent.
  //   • Empty / non-numeric = $0. A negative amount counts as $0 and is flagged.
  //   • Over-allocation (Σ prior > base): current = $0 and `over` is the excess.
  //     Nothing may be filed from that state — onFeeApp refuses to open the
  //     OC-400.1 rather than request a negative or stale amount.
  // The claimant's and the employer's nets never move: this divides the fee only.
  function splitFee(baseFee, priorAmounts) {
    const bc = toCents(baseFee);
    const baseCents = (isFinite(bc) && bc > 0) ? bc : 0;
    let negativeInput = false;
    const priorCents = (Array.isArray(priorAmounts) ? priorAmounts : []).map((a) => {
      if (a === '' || a === null || a === undefined) return 0;
      const c = toCents(a);
      if (!isFinite(c)) return 0;
      if (c < 0) { negativeInput = true; return 0; }
      return c;
    });
    const priorTotalCents = priorCents.reduce((s, c) => s + c, 0);
    const currentCents = Math.max(0, baseCents - priorTotalCents);
    const overCents = Math.max(0, priorTotalCents - baseCents);
    return {
      baseCents, priorCents, priorTotalCents, currentCents, overCents,
      overAllocated: overCents > 0, negativeInput,
      base: baseCents / 100, prior: priorCents.map(c => c / 100),
      priorTotal: priorTotalCents / 100, current: currentCents / 100, over: overCents / 100,
    };
  }
  // feeSplitOf(state, baseFee) — reads a tile's persisted split state,
  // inputs.feeSplit = { on, count: 1|2, amounts: [prior #1, prior #2] }, and
  // returns splitFee(...) plus `count`, or null when the split is OFF (or the
  // tile predates the feature) — the caller then behaves exactly as before.
  // Only the first `count` amounts count; a hidden #2 amount is kept, not used.
  function feeSplitOf(state, baseFee) {
    if (!state || typeof state !== 'object' || !state.on) return null;
    const count = Number(state.count) === 2 ? 2 : 1;          // maximum two prior counsel
    const amounts = Array.isArray(state.amounts) ? state.amounts : [];
    const priors = [];
    for (let i = 0; i < count; i++) priors.push(amounts[i]);
    return Object.assign(splitFee(baseFee, priors), { count });
  }

  // ───────────────── WHO PAYS THE FEE ON A REIMBURSEMENT ─────────────────
  // Joel 2026-10-12: "Under the current case law, when you have reimbursement
  // on a schedule loss of use award, the attorneys fee from the reimbursement
  // gets deducted from the money moving to the claimant if it's enough to pay
  // it. So the net to the employer stays the same and the claimant receives
  // less." … "That same rule goes for CCP Awards, where the claimant's money is
  // sufficient to pay the attorneys lien on reimbursement fee, it comes from
  // the claimant's money."
  //
  // feeOnEmployer (15% × the actual reimbursement) is still the fee
  // ATTRIBUTABLE to the reimbursement and still counts in totalFee; this only
  // decides whose money pays it:
  //   claimantAfterOwnFees = claimantMoving − feeOnClaimant (− feeOnCCP on CCP)
  //   reimbFeeFromClaimant = min(feeOnEmployer, max(0, claimantAfterOwnFees))
  //   reimbFeeFromEmployer = feeOnEmployer − reimbFeeFromClaimant
  // Partial coverage = claimant first, shortfall from reimbursement (Joel
  // 2026-10-12: "partial coverage is right, claimant pays what it can"): the
  // claimant's remaining money pays what it can and only the shortfall comes
  // out of the employer's reimbursement (the lien reading).
  // No fee on a reimbursement (none, $0, TBD) → both parts 0, so every net is
  // the same number it was before this rule existed. Exact values, no rounding:
  // the caller splits on the same exact figures it already uses.
  function reimbFeeSplit(claimantAfterOwnFees, feeOnEmployer) {
    const fe = Number(feeOnEmployer);
    if (!(fe > 0)) return { reimbFeeFromClaimant: 0, reimbFeeFromEmployer: 0 };
    const fromClaimant = Math.min(fe, Math.max(0, Number(claimantAfterOwnFees) || 0));
    return { reimbFeeFromClaimant: fromClaimant, reimbFeeFromEmployer: fe - fromClaimant };
  }

  // ───────────────────────────── SLU AWARD ───────────────────────────────
  // rows: [{ bp:<name>, pct:<number> }]
  // tt: the bounded total rate (use getCappedTT).
  // phpWks: prior weeks @ TT for Protracted Healing Period (§15(4-a)) — credited
  // ONCE against the LONGEST healing period among the selected parts (not stacked).
  //
  // NO 130-WEEK CREDIT ON AN SLU AWARD (Joel, 2026-10-01: "Yes, 130-week credit
  // applies to LWEC only at this time."). The §15(3)(w) credit for prior
  // temporary weeks over 130 belongs to computeLWEC alone. priorTTRWks is still
  // ACCEPTED, so older callers and saved calculations that hold a figure keep
  // working, but it is IGNORED: it never changes an SLU award. creditWks and
  // creditDollars stay in the result, always 0, so every reader keeps working.
  // The same rule as the website's js/calc-core.js computeSLU.
  //
  // OPTIONAL employer reimbursement (REIMB ER) — reimbErOn, reimbErAmount,
  // reimbErUnknown; the same three fields a CCP period carries. Ported from the
  // website's computeSLU (2026-09-29) on 2026-10-12 so every surface agrees.
  // Leave them out (or reimbErOn:false) and the result is byte-for-byte what it
  // was before they existed. Model, mirroring computeCCP (one lump award, so no
  // per-period scope):
  //   actual reimbursement = min(claim, total)      (reimbErCapped when claim > total)
  //   claimantMoving = max(0, total − priorPay − actual)
  //   feeOnClaimant  = 15% × claimantMoving          (from the claimant's award)
  //   feeOnEmployer  = 15% × actual                  (the fee ON the reimbursement)
  //   totalFee = feeOnClaimant + feeOnEmployer
  //   who pays feeOnEmployer — reimbFeeSplit (Joel 2026-10-12, above): the
  //   claimant's money pays it when it is enough; only a shortfall comes out
  //   of the reimbursement (partial coverage = claimant first, shortfall from
  //   reimbursement; Joel 2026-10-12: "partial coverage is right, claimant
  //   pays what it can"):
  //   netToClaimant = claimantMoving − feeOnClaimant − reimbFeeFromClaimant
  //   netToEmployer = actual − reimbFeeFromEmployer   (the full reimbursement when covered)
  // reimbErUnknown ("Amount TBD") does no dollar math — it behaves as no
  // reimbursement and only sets reimbErHasUnknown.
  //
  // KNOWN DIVERGENCE — SLU WITH A REIMBURSEMENT IS EXACT, NOT FLOORED TO $5.
  // (Joel, 2026-09-29: "Exact, like CCP.") Without a reimbursement SLU is a
  // single-payer fee and keeps reporting floorFee5(fee), the number the OC-400.1
  // files. With a known reimbursement > 0 the fee is a composite split across
  // TWO payers, and flooring the blend moves up to $4.99 between buckets, a
  // per-case allocation the engine cannot pick. So, as with computeCCP,
  // feeOnClaimant / feeOnEmployer / totalFee stay exact to the cent and `fee`
  // becomes that exact totalFee (`moving` / `net` the claimant bucket's); the
  // OC-400.1 still files floor5(fee). Do NOT add floorFee5 here — and do not
  // drop it from the no-reimbursement path; the fee-rounding-guard pins it.
  //
  // WCB rounding (R2/R3, roundCents): the rate is used to the cent, and the
  // gross (total weeks × rate), which is the award, and the money moving are
  // each to the cent. Weeks are not rounded. 20% of an arm at $1,000/wk:
  // 62.40 × $666.67 = $41,600.21.
  function computeSLU({ rows = [], tt = 0,
                        priorTTRWks = 0,   // accepted and ignored: no 130-week credit on SLU (above)
                        phpWks = 0, priorPay = 0,
                        reimbErOn, reimbErAmount, reimbErUnknown }) {
    const ttN = roundCents(num(tt));
    let sluWeeksTotal = 0;
    // A body part the schedule does not list adds NO weeks and no healing
    // period, and is named in unknownParts so a screen can say so. Until
    // 2026-10-30 it was silently priced as an Arm (312 weeks). The same rule
    // computeApportionment already followed.
    const unknownParts = [];
    const rowOut = rows.map(r => {
      const bp = findSLUPart(r.bp);
      if (!bp) {
        const name = (r.bp === undefined || r.bp === null) ? '' : String(r.bp);
        if (num(r.pct) > 0) unknownParts.push(name);
        return { bp: name, pct: num(r.pct), w: 0, hp: 0, sluWks: 0, unknown: true };
      }
      const sluWks = (num(r.pct) / 100) * bp.w;
      sluWeeksTotal += sluWks;
      return { bp: bp.n, pct: num(r.pct), w: bp.w, hp: bp.hp, sluWks };
    });
    const phpInput = num(phpWks);
    // Rule 5 (Joel, 2026-11-16): the credit is taken once, from the longest
    // healing period of the parts in the award (protractedHealingCredit).
    const php = protractedHealingCredit(rowOut, phpInput);
    const maxHp = php.longestHp;
    const phpCreditWks = php.creditWks;
    const totalWeeks = sluWeeksTotal + phpCreditWks;
    const grossTotal = roundCents(totalWeeks * ttN);
    // No §15(3)(w) credit on an SLU award (Joel, 2026-10-01; see above): the
    // award is the gross, whatever priorTTRWks holds.
    const creditWks = 0;
    const creditDollars = 0;
    const total = roundCents(Math.max(0, grossTotal));
    const moving = roundCents(Math.max(0, total - num(priorPay)));
    // The requested fee — floored to $5 so the tile shows what gets filed.
    const fee = floorFee5(moving * 0.15);
    const net = moving - fee;
    const out = { rowOut, sluWeeksTotal, phpInput, maxHp, phpCreditWks, totalWeeks,
                  grossTotal, creditWks, creditDollars, total, moving, fee, net, unknownParts };

    // Employer reimbursement — only when one was actually supplied (see above).
    const reimbUnknown = !!reimbErUnknown;
    const reimbSupplied = reimbErOn !== false && (reimbUnknown ||
      (reimbErAmount !== undefined && reimbErAmount !== null && reimbErAmount !== ''));
    if (!reimbSupplied) return out;
    const claim = reimbUnknown ? 0 : Math.max(0, num(reimbErAmount));
    const actual = Math.min(claim, total);
    out.reimbErClaim = claim;
    out.reimbErKnown = actual;
    out.reimbErCapped = !reimbUnknown && claim > total + 0.005;
    out.reimbErHasUnknown = reimbUnknown;
    if (actual > 0) {
      const claimantMoving = roundCents(Math.max(0, total - num(priorPay) - actual));
      const feeOnClaimant = claimantMoving * 0.15;
      const feeOnEmployer = actual * 0.15;
      const totalFee = feeOnClaimant + feeOnEmployer;
      // Joel 2026-10-12: the fee on the reimbursement comes out of the
      // claimant's money when it is enough (reimbFeeSplit, above); partial
      // coverage = claimant first, shortfall from reimbursement (Joel
      // 2026-10-12: "partial coverage is right, claimant pays what it can").
      const claimantAfterOwnFees = claimantMoving - feeOnClaimant;
      const { reimbFeeFromClaimant, reimbFeeFromEmployer } = reimbFeeSplit(claimantAfterOwnFees, feeOnEmployer);
      const netToClaimant = claimantAfterOwnFees - reimbFeeFromClaimant;
      const netToEmployer = actual - reimbFeeFromEmployer;
      Object.assign(out, {
        // Back-compat names read by every existing consumer: the claimant
        // bucket's money, and the (exact) total fee — see KNOWN DIVERGENCE.
        moving: claimantMoving, fee: totalFee, net: netToClaimant,
        claimantMoving, feeOnClaimant, employerMoving: actual, feeOnEmployer, totalFee,
        reimbFeeFromClaimant, reimbFeeFromEmployer,
        netToClaimant, netToEmployer, feeExact: true,
      });
    } else {
      // $0, capped to $0, or TBD: no reimbursement moves, so nothing changes.
      Object.assign(out, {
        claimantMoving: moving, feeOnClaimant: fee, employerMoving: 0, feeOnEmployer: 0,
        totalFee: fee, reimbFeeFromClaimant: 0, reimbFeeFromEmployer: 0,
        netToClaimant: net, netToEmployer: 0, feeExact: false,
      });
    }
    return out;
  }

  // ───────────────────────────── LWEC ────────────────────────────────────
  // tt: 2/3 AWW (unbounded). aww/minRate/maxRate drive applyRateBounds on the
  // class rate. priorTTRWks: §15(3)(w) — weeks paid >130 credited week-for-week
  // at the class rate (reduces awarded weeks, not the rate). LWEC is the only
  // award with this credit (Joel, 2026-10-01: "Yes, 130-week credit applies to
  // LWEC only at this time.").
  // The class rate is raised to the date-of-injury minimum, or is the wage
  // itself when the wage is below that minimum (Joel, 2026-10-01: "Yes the
  // annual minimums apply to LWEC/TPD benefits.") — applyRateBounds below.
  //
  // WCB rounding (R2/R3, roundCents): the compensation rate is getCappedTT's
  // cent figure; the class rate is that rate × LWEC%, rounded to the cent, then
  // bounded — "your LWEC percentage times your compensation rate", as the
  // explainer (js/explain/explain-core.js) words it. Each award (gross weeks,
  // the credit, adjusted weeks, and the 15 fee weeks) is weeks × the class
  // rate, to the cent; the fee is then floored to $5 as before. The ORDER is
  // unchanged (the maximum applies to the full rate before the percentage, and
  // the bounds again after): whether the maximum belongs before or after the
  // percentage is Joel's open question (2026-09-30), not a rounding matter.
  //
  // NO LWEC % ENTERED, NO AWARD (Joel, 2026-10-01: "Show no award until an LWEC
  // % is entered, as the public page already does."). A blank, 0, negative or
  // non-numeric percentage is NOT ENTERED: the result says so (entered: false)
  // and has no class rate, no bracket, no weeks, no award and no fee. Without
  // this, 0% made a $0 raw class rate that applyRateBounds raised to the
  // date-of-injury minimum, so an empty field paid the minimum for 225 weeks
  // ($1,125 wage, 2026 injury: $86,501.25, fee $5,765). Every figure is 0, never
  // null (callers read a null award as "Lifetime"); bracket is null. Screens
  // show "—" for it, as the public LWEC page does. Any percentage above 0 is
  // worked exactly as before (entered: true).
  function computeLWEC({ pct = 0, aww = 0, minRate = 0, maxRate = 0, priorTTRWks = 0, feePerWeek = 0 }) {
    const p = num(pct);
    if (!(p > 0)) {
      return { pct: p, entered: false, rawClassRate: 0, classRate: 0, bracket: null, isLifetime: false,
               grossWks: 0, creditWks: 0, adjustedWks: 0, grossAward: 0, creditDollars: 0,
               totalAward: 0, fee: 0, weeklyNet: 0, totalNet: 0 };
    }
    // Class rate base is the BOUNDED TT (2/3 AWW capped at max / floored at min),
    // then × LWEC% — matches the website (global.ttRate is already bounded). Using
    // the unbounded 2/3 AWW here would overstate LWEC for high earners.
    const ttBounded = getCappedTT(aww, maxRate, minRate);
    const rawClassRate = roundCents(ttBounded * (p / 100));
    const classRate = applyRateBounds(rawClassRate, aww, minRate, maxRate);
    const bracket = lwecBracket(p);
    const isLifetime = bracket.mw === 'Lifetime';
    const priorWks = num(priorTTRWks);
    const creditWks = priorWks > 130 ? priorWks - 130 : 0;
    const grossWks = isLifetime ? null : bracket.mw;
    const adjustedWks = isLifetime ? null : Math.max(0, grossWks - creditWks);
    const grossAward = isLifetime ? null : roundCents(classRate * grossWks);
    const creditDollars = isLifetime ? null : roundCents(classRate * creditWks);
    const totalAward = isLifetime ? null : roundCents(classRate * adjustedWks);
    // First 15 weeks at the class rate — the requested fee, floored to $5.
    const fee = floorFee5(roundCents(classRate * 15));
    const weeklyNet = classRate - num(feePerWeek);
    const totalNet = isLifetime ? null : totalAward - fee;
    return { pct:p, entered: true, rawClassRate, classRate, bracket, isLifetime, grossWks, creditWks,
             adjustedWks, grossAward, creditDollars, totalAward, fee, weeklyNet, totalNet };
  }

  // ───────────────────────── CCP PER-PERIOD RATE ─────────────────────────
  // Returns the weekly rate for one CCP period, by the same rules as computeCCP:
  //   TT, TR, TP (and a typed rate for any other designation): the full bounds,
  //     capped at the DOA maximum, raised to the DOA minimum, or the wage itself
  //     when the wage is below the minimum (applyRateBounds).
  //   RE: the maximum only. Never raised to the minimum, and no collapse to the
  //     wage (5/20/26; Joel, 2026-10-01: "No reduced earnings does not raise to
  //     the minimum."). ⅔ × (AWW − current earnings), floored at $0.
  //   NCLT, NME, HIA: $0, never raised (non-compensable by definition).
  // Until 2026-10-01 this function sent RE and NCLT/NME through applyRateBounds
  // too, so it raised them to the minimum where computeCCP did not.
  // WCB rounding: the wage to the cent; every rate a cent figure (R2).
  function ccpPeriodRate({ desig, curEarn = 0, ratePct = 0, manualRate = 0, rateMode = 'pct',
                           aww = 0, minRate = 0, maxRate = 0 }) {
    const awwN = roundCents(num(aww));
    const tt = awwN * 2 / 3;
    const cappedTT = applyRateBounds(tt, awwN, minRate, maxRate);
    let raw;
    switch (desig) {
      case 'TT': raw = cappedTT; break;
      case 'RE': {
        // The maximum only, exactly as computeCCP (see above).
        const re = roundCents(Math.max(0, (awwN - num(curEarn)) * 2 / 3));
        const maxR = num(maxRate);
        return maxR > 0 ? Math.min(re, maxR) : re;
      }
      case 'TR':
      case 'TP':
        // June 2026 drift fix: percentage applies to the UNCAPPED ⅔ × AWW;
        // applyRateBounds() below caps at DOA max / floors at DOA min /
        // collapses to AWW. Using cappedTT understated the rate whenever
        // ⅔ × AWW exceeded the DOA max. TP and TR are identical (label-only).
        // The floor is right for TP (Joel, 2026-10-01: "Yes the annual
        // minimums apply to LWEC/TPD benefits.").
        raw = (rateMode === 'usd') ? num(manualRate) : awwN * (2 / 3) * (num(ratePct) / 100);
        break;
      case 'HIA': return 0; // Held in Abeyance — no rate, no contribution
      case 'NCLT':          // No Compensable Lost Time and No Medical Evidence:
      case 'NME': return 0; // $0, never raised to the minimum (as computeCCP)
      default:   raw = num(manualRate); break;
    }
    return applyRateBounds(raw, awwN, minRate, maxRate);
  }

  // ---- Canonical CCP/Award date helpers (byte-identical across every surface —
  // see ops/secretary/calculator_fixes_scope_and_prompts.md). ----

  // Inclusive day span between two YYYY-MM-DD strings (both endpoints counted).
  function inclusiveDays(start, end) {
    if (!start || !end) return 0;
    const s = new Date(start), e = new Date(end);
    if (isNaN(s) || isNaN(e) || e < s) return 0;
    return Math.round((e - s) / 86400000) + 1;
  }

  // Weeks for the period at index i within the periods array.
  // FIX #2: drop the shared boundary day when this period is exactly consecutive
  // to the immediately-prior non-HIA period (this.start === prev.end).
  function periodWeeks(periods, i) {
    const p = periods[i];
    if (!p || p.desg === 'HIA') return 0;
    let days = inclusiveDays(p.start, p.end);
    const prev = i > 0 ? periods[i - 1] : null;
    if (prev && prev.desg !== 'HIA' && p.start && prev.end && p.start === prev.end) {
      days = Math.max(0, days - 1);            // count the boundary once
    }
    return days / 7;
  }

  // FIX #1 helper: day-after a YYYY-MM-DD date (UTC, DST-immune).
  function dayAfter(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  // Inclusive weeks between two YYYY-MM-DD dates (both endpoints counted; no
  // rounding). Reconciled to the workspace-canonical inclusive convention so the
  // basic calculator and the workspace tile produce identical week counts.
  function weeksBetween(start, end) {
    return inclusiveDays(start, end) / 7;
  }
  // Floor weeks to a rounding precision. 'none'=exact, 'tenth'=nearest 1/10 wk
  // rounded down (website CCP default), 'whole'=whole weeks rounded down.
  function roundWeeksDown(wks, mode) {
    const w = num(wks);
    if (mode === 'tenth') return Math.floor(w * 10) / 10;
    if (mode === 'whole') return Math.floor(w);
    return w;
  }

  // ───────────────────────────── AWW ─────────────────────────────────────
  // §14 methods + §2(9) tips/board + §14(6) concurrent. Ported from the website
  // computeAWW(). method: 'multi' (§14(1)/(2) multiplier) | 'straight'
  // (§14(3)/(4) catchall). daysWeek ∈ {4,5,6,7}.
  const DAYS_MULTIPLIER = { 4: 200, 5: 260, 6: 300, 7: 365 };
  function computeAWW(state = {}) {
    const adjTips = num(state.adjTips), adjBoard = num(state.adjBoard), adjConcur = num(state.adjConcurrent);
    let baseAww = 0, methodLabel = '', formula = '';
    if (state.method === 'straight') {
      const earn = num(state.methodStraightEarn), wks = num(state.methodStraightWeeks);
      baseAww = wks > 0 ? earn / wks : 0;
      methodLabel = '§14(3)/(4) — Catchall (Weekly Divisor)';
      formula = `$${earn} ÷ ${wks} wks`;
    } else {
      const earn = num(state.methodMultiEarn), days = num(state.methodMultiDays);
      const mult = DAYS_MULTIPLIER[state.daysWeek] || 260;
      const dailyWage = days > 0 ? earn / days : 0;
      baseAww = days > 0 ? (dailyWage * mult) / 52 : 0;
      methodLabel = `§14(1)/(2) — Multiplier ×${mult}`;
      formula = `($${earn} ÷ ${days} days) × ${mult} ÷ 52`;
    }
    const includeConcurrent = !!state.concurrentOn;
    const concurrentApplied = includeConcurrent ? adjConcur : 0;
    const adjustedAww = baseAww + adjTips + adjBoard + concurrentApplied;
    const maxRate = maxRateForDOA(state.doi), minRate = minRateForDOA(state.doi);
    // WCB rounding (R1/R2): the wage is rounded to the cent here, and the rate
    // is worked from that cent wage — the figure every calculator then shows for
    // the stored wage (getCappedTT), never one from the unrounded quotient.
    const aww = roundCents(adjustedAww);
    // A date of injury outside the published table: no rate (Joel, 2026-10-30).
    // rateRefused names why ('before' / 'after'); null otherwise, a blank date included.
    const refusedWhy = rateRefused(state.doi) ? rateCoverage(state.doi).reason : null;
    const ttRate = refusedWhy ? 0 : getCappedTT(aww, maxRate, minRate);
    return {
      aww,
      rateRefused: refusedWhy,
      baseAww: roundCents(baseAww),
      concurrentAww: roundCents(concurrentApplied),
      isComposite: includeConcurrent && concurrentApplied > 0,
      method: state.method || 'multi', methodLabel, formula,
      adjTips, adjBoard, ttRate, maxRate, minRate,
      capped: !refusedWhy && maxRate > 0 && getCappedTT(aww, 0, 0) > maxRate,
    };
  }

  // ───────────────────────────── CCP / AWARD ─────────────────────────────
  // Full two-bucket model (claimant award + employer REIMB-ER), ported from the
  // website CCP tile. periods: array of period objects; opts: { aww, minRate,
  // maxRate, rounding, ccpAmount, priorPay }. Designations: TT, RE, TR, TP,
  // NCLT, NME, HIA. Per-period fields: desg, start, end, curEarn, ratePct,
  // manualRate, rateMode('pct'|'usd'), amending, priorMode, priorVal,
  // reimbErOn, reimbErAmount, reimbErUnknown, reimbErScope('period'|'all'|'specific'),
  // reimbErRangeStart, reimbErRangeEnd, alreadyPaid.
  //
  // KNOWN DIVERGENCE — CCP's totalFee is INTENTIONALLY NOT floored to $5.
  // Every other calculator here reports floorFee5(fee) so the tile shows the
  // number that gets filed. CCP does not, and that is a decision, not an
  // oversight: totalFee is a composite of THREE parts split across TWO payers
  // (feeOnClaimant 15% from the claimant's award + feeOnEmployer 15% from the
  // employer REIMB-ER bucket + feeOnCCP = ccpAmount/3). Flooring the blended
  // total moves ≤$4.99 out of one payer's bucket and into the other's net, and
  // which bucket absorbs it is a per-case attorney judgment — not something the
  // engine can pick. So the composite stays exact and the allocation is made by
  // hand. NOTE the consequence: a CCP-generated OC-400.1 still files
  // floor5(totalFee) via feeapp.js, so for CCP ALONE the displayed fee (exact)
  // and the filed fee (floored) intentionally differ. The CCP tile carries a
  // line of microcopy saying so. Do NOT "fix" this by adding floorFee5 — the
  // fee-rounding-guard pins CCP-exact and will go red if you do.
  //
  // WCB rounding (R1–R3, roundCents): the wage is used to the cent; every
  // period rate — the raw 2/3 product, the bounded rate, a prior (amending)
  // rate and the difference paid — is a cent figure; each period's amount is
  // its weeks × its rate, to the cent, and the total award is the sum of those
  // amounts. Weeks are not rounded beyond the tile's own Round Weeks choice.
  // The fee composite below stays exact, as the KNOWN DIVERGENCE says.
  function computeCCP(periods = [], opts = {}) {
    const aww = roundCents(num(opts.aww)), minRate = num(opts.minRate), maxRate = num(opts.maxRate);
    const rounding = opts.rounding || 'none';
    const ttBase = aww * 2 / 3;                                   // uncapped 2/3 AWW
    const ttBounded = applyRateBounds(ttBase, aww, minRate, maxRate);

    const out = periods.map((p, i) => {
      const period = Object.assign({}, p);
      if (period.desg === 'HIA') {
        return Object.assign(period, { wks:0, rawCurrentRate:0, currentRate:0, priorRate:0, rate:0, amount:0, isHia:true });
      }
      // FIX #2: periodWeeks drops the shared boundary day when this period is
      // exactly consecutive to the prior non-HIA period (start === prev.end),
      // before rounding — so a contiguous chain counts the boundary once.
      const wks = roundWeeksDown(periodWeeks(periods, i), rounding);
      const rateMode = period.rateMode || 'pct';
      let rawCurrentRate = 0;
      if (period.desg === 'TT') rawCurrentRate = ttBounded;
      else if (period.desg === 'RE') rawCurrentRate = Math.max(0, (aww - num(period.curEarn)) * 2 / 3);
      else if (period.desg === 'TR') rawCurrentRate = (rateMode === 'usd') ? num(period.manualRate) : aww * (2/3) * (num(period.ratePct)/100);
      // TP mirrors TR (June 2026 drift fix) — % on UNCAPPED ⅔ × AWW, then bound below:
      // raised to the date-of-injury minimum, or the wage below it (Joel, 2026-10-01:
      // "Yes the annual minimums apply to LWEC/TPD benefits.").
      else if (period.desg === 'TP') rawCurrentRate = (rateMode === 'usd') ? num(period.manualRate) : aww * (2/3) * (num(period.ratePct)/100);
      else if (period.desg === 'NCLT' || period.desg === 'NME') rawCurrentRate = 0;
      else rawCurrentRate = num(period.manualRate);
      rawCurrentRate = roundCents(rawCurrentRate);               // R2: to the cent, then bounds

      let currentRate = applyRateBounds(rawCurrentRate, aww, minRate, maxRate);
      if (period.desg === 'NCLT' || period.desg === 'NME') currentRate = 0;
      // RE: max cap only — no min floor, no AWW-collapse (5/20/26; Joel,
      // 2026-10-01: "No reduced earnings does not raise to the minimum.").
      if (period.desg === 'RE') currentRate = maxRate > 0 ? Math.min(rawCurrentRate, maxRate) : rawCurrentRate;

      let rate = currentRate, priorRate = 0;
      if (period.amending) {
        const priorPct = (period.priorMode === 'usd')
          ? (ttBase > 0 ? Math.min(100, (Math.max(0, num(period.priorVal)) / ttBase) * 100) : 0)
          : Math.max(0, Math.min(100, num(period.priorVal)));
        priorRate = roundCents((priorPct / 100) * ttBase);
        rate = roundCents(Math.max(0, currentRate - priorRate));
      }
      return Object.assign(period, { wks, rawCurrentRate, currentRate, priorRate, rate, amount: roundCents(wks * rate), isHia:false });
    });

    const totalAward = roundCents(out.reduce((s, p) => s + p.amount, 0));

    // REIMB-ER: CLAIM → CAP → ACTUAL, per-period remaining capacity, scopes.
    let reimbErKnown = 0, reimbErHasUnknown = false;
    out.forEach(r => { r.remainingForReimb = r.isHia ? 0 : (num(r.amount)); });
    const resolveContributions = (carrier) => {
      const scope = carrier.reimbErScope || 'period';
      const contribs = [];
      if (scope === 'period') {
        if (!carrier.isHia) contribs.push({ p: carrier, cap: Math.min(num(carrier.amount), carrier.remainingForReimb) });
      } else if (scope === 'all') {
        out.forEach(p => { if (p.isHia) return; contribs.push({ p, cap: Math.min(num(p.amount), p.remainingForReimb) }); });
      } else if (scope === 'specific') {
        if (!carrier.reimbErRangeStart || !carrier.reimbErRangeEnd) return contribs;
        const rStart = new Date(carrier.reimbErRangeStart), rEnd = new Date(carrier.reimbErRangeEnd);
        if (isNaN(rStart.getTime()) || isNaN(rEnd.getTime()) || rEnd < rStart) return contribs;
        out.forEach(p => {
          if (p.isHia || !p.start || !p.end) return;
          const pStart = new Date(p.start), pEnd = new Date(p.end);
          if (isNaN(pStart.getTime()) || isNaN(pEnd.getTime()) || pEnd < rStart || pStart > rEnd) return;
          const oStart = pStart > rStart ? pStart : rStart, oEnd = pEnd < rEnd ? pEnd : rEnd;
          const days = (oEnd - oStart) / (864e5) + 1;
          const overlapWks = roundWeeksDown(days / 7, rounding);
          const overlapAmt = roundCents(overlapWks * num(p.rate));
          contribs.push({ p, cap: Math.min(overlapAmt, p.remainingForReimb) });
        });
      }
      return contribs;
    };
    out.forEach(carrier => {
      if (!carrier.reimbErOn) return;
      if (carrier.reimbErUnknown) { reimbErHasUnknown = true; carrier.resolvedReimbErAmount = 0; return; }
      const contribs = resolveContributions(carrier);
      const claim = num(carrier.reimbErAmount);
      const availableCap = contribs.reduce((s, c) => s + Math.max(0, c.cap), 0);
      const actual = Math.min(claim, availableCap);
      carrier.resolvedReimbErAmount = actual;
      carrier.reimbErCapped = claim > availableCap + 0.005;
      if (availableCap > 0 && actual > 0) {
        contribs.forEach(c => { if (c.cap <= 0) return; c.p.remainingForReimb = Math.max(0, c.p.remainingForReimb - (c.cap / availableCap) * actual); });
      }
      reimbErKnown += actual;
    });

    // Already-paid periods (the Pro Workspace CCP tile, 2026-11-08 into the
    // engine): a non-HIA period flagged alreadyPaid stays in the Total Award
    // but drops out of the money moving and the fee. Reimbursement capacity is
    // untouched. No flag anywhere = 0, so every result is what it was.
    const alreadyPaidSum = roundCents(out.reduce((s, p) => s + ((!p.isHia && p.alreadyPaid) ? num(p.amount) : 0), 0));
    const claimantMoving = Math.max(0, totalAward - num(opts.priorPay) - reimbErKnown - alreadyPaidSum);
    const feeOnClaimant = claimantMoving * 0.15;
    const employerMoving = reimbErKnown;
    const feeOnEmployer = employerMoving * 0.15;
    const feeOnCCP = num(opts.ccpAmount) / 3;
    const totalFee = feeOnClaimant + feeOnEmployer + feeOnCCP;
    // Joel 2026-10-12: where the claimant's money is enough, the fee on the
    // reimbursement comes from it, after the claimant's own 15% and the CCP
    // ÷3 fee (reimbFeeSplit, above); partial coverage = claimant first,
    // shortfall from reimbursement (Joel 2026-10-12: "partial coverage is
    // right, claimant pays what it can"). No reimbursement → both parts 0 and
    // the nets are exactly what they were.
    const claimantAfterOwnFees = claimantMoving - feeOnClaimant - feeOnCCP;
    const { reimbFeeFromClaimant, reimbFeeFromEmployer } = reimbFeeSplit(claimantAfterOwnFees, feeOnEmployer);
    const netToClaimant = claimantAfterOwnFees - reimbFeeFromClaimant;
    const netToEmployer = employerMoving - reimbFeeFromEmployer;
    return {
      rows: out, totalAward, totalReimbEr: reimbErKnown, reimbErKnown, reimbErHasUnknown, alreadyPaidSum,
      claimantMoving, feeOnClaimant, employerMoving, feeOnEmployer, feeOnCCP, totalFee,
      reimbFeeFromClaimant, reimbFeeFromEmployer,
      netToClaimant, netToEmployer,
      moving: claimantMoving, feeOnAward: feeOnClaimant, net: netToClaimant,
    };
  }

  // ───────────────────────────── BURNS ───────────────────────────────────
  function computeBurns({ indemnity = 0, medical = 0, gross = 0, attyFee = 0,
                          disbursements = 0, isMVA = false, mvaThreshold = 0 }) {
    const grossLien = num(indemnity) + num(medical);
    const lienBase = isMVA ? Math.max(0, grossLien - num(mvaThreshold)) : grossLien;
    const litCosts = num(attyFee) + num(disbursements);
    const burnsRate = num(gross) > 0 ? litCosts / num(gross) : 0;
    const netLien = burnsRate * lienBase;
    const netToPlaintiff = num(gross) - litCosts - netLien;
    return { grossLien, lienBase, litCosts, burnsRate, netLien, netToPlaintiff };
  }

  // ──────────────────────── SECTION 32 SETTLEMENT ────────────────────────
  // msaType: 'none' | 'msa' | 'medicare'. msaMode: 'usd' | 'pct'.
  function computeSettlement({ settlement = 0, msa = 0, msaType, msaMode = 'usd', msaPct = 0, msaOn }) {
    const s = num(settlement);
    // NOTE: msaType has NO default — a default of 'none' would short-circuit the
    // msaOn back-compat fallback below (old saves stored msaOn:bool, not msaType).
    const type = msaType || (msaOn ? 'msa' : 'none');
    const hasMSA = type === 'msa' || type === 'medicare';
    const mode = msaMode || 'usd';
    const pct = num(msaPct);
    const msaUsd = !hasMSA ? 0 : (mode === 'pct' ? (s * pct / 100) : num(msa));
    const indemnity = Math.max(0, s - msaUsd);
    const fee = floorFee5(indemnity * 0.15);
    const net = Math.max(0, indemnity - fee);
    return { settlement:s, msaType:type, hasMSA, msaMode:mode, msaPct:pct, msa:msaUsd, indemnity, fee, net };
  }

  // ───────────────────── RADICULOPATHY NERVE CAPS ────────────────────────
  // Clamp a sensory/motor score to the nerve root's anatomic maximum.
  function nerveCap(region, nerve) {
    const list = NERVE_CAPS[region] || [];
    return list.find(n => n.v === nerve) || null;
  }
  function clampNerveScores(region, nerve, sensory, motor) {
    const cap = nerveCap(region, nerve);
    if (!cap) return { sensory: num(sensory), motor: num(motor), capped: false };
    const s = Math.min(num(sensory), cap.maxSensory);
    const m = Math.min(num(motor), cap.maxMotor);
    return { sensory: s, motor: m, capped: (s !== num(sensory) || m !== num(motor)) };
  }
  // ── RADICULOPATHY SEVERITY RANKING (Joel, 2026-11-08) ──────────────────
  // NYS Guidelines for Determining Permanent Impairment and Loss of Wage
  // Earning Capacity (December 2012), Ch. 11, as the Board publishes it
  // (wcb.ny.gov, 2012ImpairmentGuide.pdf):
  //   Table S11.4 (pp. 65-67) Radiculopathy Criteria: imaging "Yes = 16";
  //     EMG "Yes = 6"; muscle weakness "Yes = 6-20. See Table 11.4(a)";
  //     muscle atrophy "Yes = 6"; sensory "Yes = 4-6 See Table 11.4(b)";
  //     reflexes "Absent = 6", "Present but diminished = 4", "Normal = 0";
  //     tension-compression signs "Yes = 4". Every "No" is 0.
  //   Table S11.4(a) (p. 68) motor deficit by grade: 0 → 20, 1 → 20, 2 → 18,
  //     3 → 6, 4 → 0, 5 → 0.  Table S11.4(b) (p. 69): anesthesia 6,
  //     compromised 4, normal 0.
  //   Tables S11.5 / S11.6 (p. 70): each root's sensory and weakness maxima
  //     (NERVE_CAPS above).
  //   Table S11.7 (p. 71): "determine the letter that corresponds to the
  //     number of points" — S11.7(a) cervical C 0, D 4-16 … H 65-80;
  //     S11.7(b) lumbar D 0, E 4-16 … J 81-92 (CERVICAL_RANKS / LUMBAR_RANKS).
  // Every finding scores 0 or at least 4, so a total of 1-3 cannot come out
  // of the Guidelines' own scoring, and Table S11.7 has no row for it (nor
  // for a total above the top row). Until 2026-11-08 radRank() answered the
  // table's LAST, most severe letter (H / J) for any total no row matched;
  // Joel: that is not right. Such a total now has NO letter: radRank()
  // returns null and radRankInfo() says why ('between_rows', 'above_table',
  // 'not_a_point_total'). Totals the tables list answer exactly as before.
  const RADIC_POINTS = {
    imaging: 16, emg: 6, atrophy: 6, tension: 4,
    motorByGrade: { 0: 20, 1: 20, 2: 18, 3: 6, 4: 0, 5: 0 },
    sensory: { normal: 0, compromised: 4, anesthesia: 6 },
    reflex: { normal: 0, diminished: 4, absent: 6 },
  };
  function radRankInfo(points, region) {
    const t = region === 'lumbar' ? LUMBAR_RANKS : CERVICAL_RANKS;
    const p = Number(points);
    const out = { rank: null, onTable: false, band: null, reason: null, points: p, table: region === 'lumbar' ? 'S11.7(b)' : 'S11.7(a)' };
    if (!isFinite(p) || p < 0) { out.reason = 'not_a_point_total'; return out; }
    for (const r of t) {
      if (p >= r.lo && p <= r.hi) { out.rank = r.letter; out.onTable = true; out.band = r; return out; }
    }
    out.reason = p > t[t.length - 1].hi ? 'above_table' : 'between_rows';
    return out;
  }
  function radRank(points, region) {
    return radRankInfo(num(points), region).rank;
  }
  // The Pro Workspace Radiculopathy tile's scoring (js/workspace/tiles.js
  // RadiculopathyTile), from findings: muscle involvement = the weakness
  // grade's points + atrophy, capped at the root's weakness maximum; sensory
  // capped at the root's sensory maximum; total = imaging + EMG + muscle +
  // sensory + reflex + tension; the rank from radRankInfo. An unlisted root
  // gets no caps and no rank (root: null).
  //   f: { region: 'cervical'|'lumbar', nerve, imaging: bool, emg: bool,
  //        weaknessGrade: 0-5, atrophy: bool, sensory: 'normal'|'compromised'|
  //        'anesthesia', reflex: 'normal'|'diminished'|'absent', tension: bool }
  function computeRadiculopathy(f = {}) {
    const region = f.region === 'cervical' ? 'cervical' : 'lumbar';
    const cap = nerveCap(region, f.nerve);
    const P = RADIC_POINTS;
    const grade = Number(f.weaknessGrade);
    const motorRaw = (P.motorByGrade[grade] || 0) + (f.atrophy ? P.atrophy : 0);
    const sensoryRaw = P.sensory[f.sensory] || 0;
    const points = {
      imaging: f.imaging ? P.imaging : 0, emg: f.emg ? P.emg : 0,
      muscle: cap ? Math.min(motorRaw, cap.maxMotor) : motorRaw,
      sensory: cap ? Math.min(sensoryRaw, cap.maxSensory) : sensoryRaw,
      reflex: P.reflex[f.reflex] || 0, tension: f.tension ? P.tension : 0,
    };
    const total = points.imaging + points.emg + points.muscle + points.sensory + points.reflex + points.tension;
    const info = cap ? radRankInfo(total, region) : { rank: null, onTable: false, band: null, reason: 'unknown_root' };
    return { region, root: cap, motorRaw, sensoryRaw, points, total,
             rank: info.rank, onTable: info.onTable, band: info.band, reason: info.reason,
             capped: !!cap && (points.muscle !== motorRaw || points.sensory !== sensoryRaw) };
  }

  // ─────────────────── MULTI-CASE SLU APPORTIONMENT ──────────────────────
  // Apportionment BETWEEN CLAIMS — one claimant, several established cases
  // with different dates of accident. This is NOT Burns v. Varick third-party
  // lien apportionment (that is computeBurns, which the UI also labels
  // "apportionment"); nothing here touches a third-party recovery.
  //
  // Each case carries its OWN AWW and its OWN DOA, so each pulls its own
  // max/min out of the rate tables — the same body part can settle at very
  // different weekly rates across two cases. Digital port of Joel's
  // "Apportionment Fee Calculator" workbook (ops/secretary/); the per-column
  // formulas are reproduced exactly EXCEPT the two places the workbook is
  // wrong, where MIN_RATES/MAX_RATES above stay authoritative:
  //   1. The workbook's Rate Table hard-codes a $150 minimum for every year.
  //      The real pre-reform minimums are $40 (before 7/1/2007) and $100
  //      (7/1/2007–4/30/2013).
  //   2. Excel's MIN() SKIPS a blank cell, so a column with no AWW reports the
  //      statutory minimum as its "rate". A case with no AWW rates at 0 here.
  //      Either way the money is identical — 0 weeks × anything is 0.
  //
  // cases[]: { label, caseNumber, aww, doa:'YYYY-MM-DD', weeksAtTT, priorPay,
  //            credits, parts:[{ part, pctSLU }] }
  //
  // parts[].pctSLU is a FRACTION (0.10 = 10%), matching the workbook's
  //   percent-formatted cells. Callers already holding whole percents may pass
  //   `pct` (0–100, computeSLU's convention) instead — supply ONE key per row,
  //   never both. Whatever the units: enter the APPORTIONED %SLU for each case
  //   — the loss SPLIT across the cases, not the full SLU repeated in every
  //   column, or the same loss is paid for more than once.
  // php — pre-permanency period = max(0, weeksAtTT − the LONGEST healing
  //   period among the parts scoring above 0% in THAT case). Credited once
  //   against the longest part, never summed; same rule as computeSLU.
  // priorTempWks — prior temporary-disability weeks for that case: ACCEPTED
  //   and IGNORED. Each case's award here is an SLU award, and an SLU award
  //   gets no 130-week credit (Joel, 2026-10-01: "Yes, 130-week credit applies
  //   to LWEC only at this time.") — the same rule as computeSLU. A saved case
  //   that holds a figure simply stops using it. priorTempCreditWks and
  //   priorTempCreditDollars (and the totals' priorTempCreditDollars) stay in
  //   the result, always 0, and awardAfterCredit is the gross, so every reader
  //   keeps working. The workbook has no such column either.
  // fee — FLOOR(moving × 15%, $5): 15% rounded DOWN to the nearest $5, the
  //   OC-400.1 convention the workbook uses. (computeSLU leaves its 15%
  //   unrounded; these numbers go on a filed fee app, so they get rounded.)
  //   A case that has been overpaid (moving < 0) carries no fee rather than a
  //   negative one — the workbook would report a negative fee there.
  // WCB rounding (R1–R3, roundCents): each case's wage and rate are cent
  // figures (getCappedTT), its gross is weeks × that rate to the cent, and the
  // award (the gross) and the money moving are to the cent; the fee is floored
  // to $5 from that cent figure, as before.
  function computeApportionment({ cases = [] } = {}) {
    const perCase = (Array.isArray(cases) ? cases : []).map((raw) => {
      const c = raw || {};
      const aww = roundCents(num(c.aww));
      const doa = c.doa || '';
      const maxRate = maxRateForDOA(doa);
      const minRate = minRateForDOA(doa);
      // A case rates at 0 until it has BOTH an AWW and a D/A that lands in the
      // rate table. Without the D/A guard, maxRateForDOA() returns 0, which
      // applyRateBounds reads as "no cap" — a blank or pre-1985 date would
      // silently pay the UNCAPPED ⅔ AWW (e.g. $2,000/wk on a $3,000 AWW instead
      // of the $1,125.46 statutory max), and it would do it while the attorney
      // is still filling the column in.
      const rate = (aww > 0 && maxRate > 0)
        ? getCappedTT(aww, maxRate, minRate)
        : 0;

      let scheduledWeeks = 0;
      let highestHP = 0;
      const parts = (Array.isArray(c.parts) ? c.parts : []).map((rawPart) => {
        const p = rawPart || {};
        const bp = findSLUPart(p.part);
        // pctSLU is the fraction form; pct is the 0–100 form. Explicit keys,
        // no sniffing — 0.5 must never be ambiguous between 0.5% and 50%.
        const pctSLU = (p.pctSLU === undefined || p.pctSLU === null || p.pctSLU === '')
          ? num(p.pct) / 100
          : num(p.pctSLU);
        const w = bp ? bp.w : 0;
        const hp = bp ? bp.hp : 0;
        const weeks = pctSLU * w;
        scheduledWeeks += weeks;
        // Only parts actually scoring drive the healing period (workbook:
        // MAX(IF((pct>0)*(part<>""), hp, 0))).
        if (pctSLU > 0 && hp > highestHP) highestHP = hp;
        return { part: bp ? bp.n : (p.part || ''), known: !!bp, pctSLU, w, hp, weeks };
      });

      const weeksAtTT = num(c.weeksAtTT);
      // PHP protracts a SCHEDULE AWARD — with no established %SLU there is no
      // award to protract, so weeks at TT alone must never mint one. (Without
      // this, a case with 50 weeks at TT and every body part still at 0% would
      // report 50 weeks × the rate as "gross".)
      const php = scheduledWeeks > 0 ? Math.max(0, weeksAtTT - highestHP) : 0;
      const totalWeeks = scheduledWeeks + php;
      const gross = roundCents(totalWeeks * rate);

      // No 130-week credit on an SLU award (Joel, 2026-10-01; see priorTempWks
      // above), the same as computeSLU: the award is the gross, clamped at 0,
      // before prior payments and dollar credits. The credit fields stay, at 0.
      const priorTempWks = num(c.priorTempWks);
      const priorTempCreditWks = 0;
      const priorTempCreditDollars = 0;
      const awardAfterCredit = roundCents(Math.max(0, gross));

      const priorPay = num(c.priorPay);
      const credits = num(c.credits);
      const moving = roundCents(awardAfterCredit - priorPay - credits);
      const fee = floorFee5(moving * 0.15);
      const net = moving - fee;

      return {
        label: c.label || '', caseNumber: c.caseNumber || '',
        aww, doa, maxRate, minRate, rate,
        parts, scheduledWeeks, weeksAtTT, highestHP, php, totalWeeks,
        gross, priorTempWks, priorTempCreditWks, priorTempCreditDollars,
        awardAfterCredit, priorPay, credits, moving, fee, net,
      };
    });

    const totals = perCase.reduce((t, r) => ({
      gross:    roundCents(t.gross    + r.gross),
      priorTempCreditDollars: roundCents(t.priorTempCreditDollars + r.priorTempCreditDollars),
      priorPay: t.priorPay + r.priorPay,
      credits:  t.credits  + r.credits,
      moving:   roundCents(t.moving   + r.moving),
      fee:      t.fee      + r.fee,
      net:      t.net      + r.net,
    }), { gross: 0, priorTempCreditDollars: 0, priorPay: 0, credits: 0,
          moving: 0, fee: 0, net: 0 });

    return { perCase, totals };
  }

  // ═══════════════════ CALCULATOR RULES (Joel, 2026-11-16) ═══════════════════
  // BEGIN SHARED RULES 2026-11-16
  // This block is BYTE-IDENTICAL in thecompdesk-site js/calc-core.js and
  // thecompdesk-app www/js/calc-core.js. tests/calc-rules.test.mjs (site) and
  // ops/dev/tests/calc-rules.test.mjs (app) are one file: they run the same
  // worked examples and compare this block across the two clones.
  //
  // Joel's rulings, 2026-11-16, word for word: "Overlap by one day counted once
  // but the period ends are always being set by the user. It should count as a
  // match but flag it. Liens come off after. 234 days is substantially the whole
  // year for 5- and 6-day workers. From the longest healing period. Make sure to
  // save all of these rules in the calc-core.js file we have as the source of
  // truth."
  //
  //   1  PERIODS     the user sets every period's start AND end; nothing here
  //                  infers or moves an end. A period that starts on the day
  //                  the one before it ends shares that day, and the day is
  //                  counted once (periodWeeks drops it); the result says so.
  //   2  AWARDS      a decision figure within one cent, or within 0.01 week,
  //                  of calc-core's counts as a MATCH and is flagged.
  //   3  SECTION 32  liens come off AFTER the fee: the fee base is the
  //                  indemnity after any set-aside (computeSettlement), never
  //                  reduced by a lien; the liens come off the net.
  //   4  AWW § 14    234 days worked in the year before the injury is
  //                  "substantially the whole of the year" for a 5-day or a
  //                  6-day worker: 234 or more chooses the § 14(1) multiplier,
  //                  fewer chooses earnings ÷ weeks. No threshold is set for
  //                  any other work week: both methods are shown, none chosen.
  //   5  SLU PHP     the protracted healing period credit (§ 15(4-a)) is taken
  //                  once, from the longest healing period of the parts in the
  //                  award, never per part.
  //
  // Every rule returns `steps` (the working, in order: { label, expr, value })
  // and `flags` ({ code, level: 'info' | 'flag' | 'warn', params, text }).
  // `text` is RULE_TEXT[code] filled from params; a screen that translates
  // looks the template up by code and fills the same params, so the app and
  // the website say the same thing. Dates in params are M/D/YYYY, money $1,234.56.

  const RULE_TEXT = {
    'period.start-missing':   'Period {n} has no start date, so it is left out.',
    'period.end-missing':     'Period {n} has no end date. Every period ends on the date you enter, so it is left out until you enter one.',
    'period.end-before-start': 'Period {n} ends on {end}, before it starts on {start}, so it is left out.',
    'period.shared-day':      'Period {n} starts on {date}, the day period {prev} ends. That day is counted once, not twice.',
    'period.overlap':         'Periods {prev} and {n} overlap by {days} days ({from} to {to}). Those days are counted in both periods; check the dates.',
    'period.gap':             'No period covers the {days} days from {from} to {to}.',
    'period.step':            '{start} to {end}: {days} days ÷ 7',
    'period.step-shared':     '{start} to {end}: {days} days, less the shared day {date}, ÷ 7',
    'period.label':           'Period {n} · {desg}',
    'award.label.rate':       'Weekly rate',
    'award.label.weeks':      'Period {n} weeks',
    'award.label.amount':     'Period {n} amount',
    'award.label.total':      'Total awarded',
    'award.match-flagged':    '{label}: the decision says {decision} and calc-core {engine}. The difference, {diff}, is under {tol}, so it counts as a match. Check it.',
    'award.differs':          '{label}: the decision says {decision} and calc-core {engine}, a difference of {diff}.',
    'award.step-rate':        '2/3 × {aww}, bounded for the date of accident',
    'award.step-weeks':       '{start} to {end}, counting both days',
    'award.step-amount':      '{weeks} weeks × {rate}',
    'award.step-total':       'the sum of the period amounts',
    's32.liens-after-fee':    'The fee is worked on the indemnity after the set-aside ({base}), before any lien. The liens come off the net.',
    's32.liens-exceed':       'The liens ({liens}) are more than the net after the fee ({net}), by {short}. Nothing is left to the claimant.',
    's32.burns-lien':         'Net WC lien from the Burns calculator',
    's32.step-setaside':      'amount entered',
    's32.step-setaside-pct':  '{pct}% × {settlement}',
    's32.step-indemnity':     '{settlement} − set-aside {msa}',
    's32.step-fee':           '15% × {base}, rounded down to $5',
    's32.step-net':           '{base} − fee {fee}',
    's32.step-lien':          'paid from the net',
    's32.step-final':         '{net} − liens {liens}',
    's32.label.setaside':     'Set-aside',
    's32.label.indemnity':    'Indemnity (the fee base)',
    's32.label.fee':          'Attorney fee',
    's32.label.net':          'Net before liens',
    's32.label.lien':         'Lien',
    's32.label.final':        'Net to claimant',
    'aww.whole-year':         '{days} days worked in the year before the injury, on a {dw}-day week, is at least {threshold}: substantially the whole of the year. The § 14(1) multiplier is used.',
    'aww.not-whole-year':     '{days} days worked in the year before the injury, on a {dw}-day week, is under {threshold}: not substantially the whole of the year, so the § 14(1) multiplier is not used. The earnings ÷ weeks figure (§ 14(3)/(4)) is used. A § 14(2) figure from a similar employee’s wages is not worked here.',
    'aww.no-threshold':       'No day threshold is set for a {dw}-day week, so neither method is chosen. Both are shown.',
    'aww.days-missing':       'Enter the days worked in the year before the injury: {threshold} or more is substantially the whole of the year for a {dw}-day week.',
    'aww.step-multi':         '({earn} ÷ {days} days) × {mult} ÷ 52',
    'aww.step-straight':      '{earn} ÷ {weeks} weeks',
    'aww.label.multi':        '§ 14(1)/(2) multiplier',
    'aww.label.straight':     '§ 14(3)/(4) earnings ÷ weeks',
    'slu.php-longest':        'Protracted healing credit, taken once from the longest healing period ({part}, {hp} weeks): {paid} weeks paid − {hp} = {credit} weeks.',
    'slu.php-none':           '{paid} weeks paid is not more than the longest healing period ({part}, {hp} weeks), so there is no protracted healing credit.',
    'slu.php-paid':           '{start} to {end}, counting both days, ÷ 7',
    'slu.label.paid':         'Temporary total paid',
    'slu.label.php':          'Protracted healing credit',
  };
  function ruleDay(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? (+m[2]) + '/' + (+m[3]) + '/' + m[1] : '';
  }
  function ruleMoney(v) {
    const x = num(v), a = Math.round(Math.abs(x) * 1e6) / 1e6;
    // A figure with digits past the cent (a decision typed as 2000.009, or an
    // award-checker difference) keeps them: $2,000.009, not $2,000.01.
    const subCent = Math.abs(a * 100 - Math.round(a * 100)) > 1e-6;
    const [w, f] = (subCent ? String(a) : a.toFixed(2)).split('.');
    return (x < 0 ? '−$' : '$') + w.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : '');
  }
  function ruleWeeks(v) { return String(Math.round(num(v) * 10000) / 10000); }
  function fillRule(tpl, params) {
    return String(tpl == null ? '' : tpl).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? String(params[k]) : m));
  }
  function ruleFlag(code, level, params) {
    return { code, level, params: params || {}, text: fillRule(RULE_TEXT[code], params) };
  }
  function ruleStep(labelCode, labelParams, exprCode, exprParams, value) {
    return { labelCode, labelParams: labelParams || {}, exprCode, exprParams: exprParams || {},
             label: fillRule(RULE_TEXT[labelCode] || labelCode, labelParams),
             expr: fillRule(RULE_TEXT[exprCode] || exprCode, exprParams), value: value == null ? '' : String(value) };
  }
  function isoDayBefore(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  // ── 1 · PERIODS ────────────────────────────────────────────────────────────
  // A shared boundary day is counted once (periodWeeks, FIX #2): the rule is
  // the existing one, and the builder only reports it.
  const PERIOD_SHARED_DAY_COUNTED_ONCE = true;
  // entries: [{ start, end, desg, ratePct, rateMode, manualRate, curEarn, ... }]
  // opts.order: 'start' (default; sorted by start date, then as entered) or
  //             'entered' (kept as entered; the award checker's decision order).
  // Returns { periods (computeCCP's shape, only the usable ones, each with n =
  // its entered number, days and weeks), flags, steps, sharedDays }.
  function buildPeriods(entries = [], opts = {}) {
    const flags = [], steps = [];
    const usable = [];
    (entries || []).forEach((e, i) => {
      const n = i + 1;
      const p = Object.assign({}, e, { n, desg: (e && (e.desg || e.kind)) || 'TT' });
      delete p.kind;
      if (!p.start) { flags.push(ruleFlag('period.start-missing', 'warn', { n })); return; }
      if (!p.end) { flags.push(ruleFlag('period.end-missing', 'warn', { n })); return; }
      if (inclusiveDays(p.start, p.end) === 0) {
        flags.push(ruleFlag('period.end-before-start', 'warn', { n, start: ruleDay(p.start), end: ruleDay(p.end) }));
        return;
      }
      usable.push(p);
    });
    if ((opts.order || 'start') === 'start') {
      usable.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.n - b.n));
    }
    let sharedDays = 0, maxEnd = '';
    usable.forEach((p, k) => {
      const prev = k > 0 ? usable[k - 1] : null;
      const days = inclusiveDays(p.start, p.end);
      const shared = !!(prev && p.start === prev.end);
      if (shared) {
        sharedDays += 1;
        flags.push(ruleFlag('period.shared-day', 'info', { n: p.n, prev: prev.n, date: ruleDay(p.start) }));
      } else if (prev && maxEnd && p.start <= maxEnd) {
        const to = p.end < maxEnd ? p.end : maxEnd;
        flags.push(ruleFlag('period.overlap', 'warn', { prev: prev.n, n: p.n, days: inclusiveDays(p.start, to), from: ruleDay(p.start), to: ruleDay(to) }));
      } else if (prev && maxEnd && p.start > dayAfter(maxEnd)) {
        const from = dayAfter(maxEnd), to = isoDayBefore(p.start);
        flags.push(ruleFlag('period.gap', 'info', { days: inclusiveDays(from, to), from: ruleDay(from), to: ruleDay(to) }));
      }
      if (!maxEnd || p.end > maxEnd) maxEnd = p.end;
      p.days = days;
      p.weeks = periodWeeks(usable, k);
      p.sharedDay = shared && prev.desg !== 'HIA' && p.desg !== 'HIA';
      steps.push(ruleStep('period.label', { n: p.n, desg: p.desg },
        p.sharedDay ? 'period.step-shared' : 'period.step',
        { start: ruleDay(p.start), end: ruleDay(p.end), days, date: ruleDay(p.start) },
        ruleWeeks(p.weeks) + ' wk'));
    });
    return { periods: usable, flags, steps, sharedDays };
  }
  // The period builder: buildPeriods, then computeCCP on the periods it keeps.
  // opts: computeCCP's ({ aww, minRate, maxRate, rounding, priorPay, ccpAmount }).
  function computePeriodBuilder(entries = [], opts = {}) {
    const b = buildPeriods(entries, { order: 'start' });
    const ccp = computeCCP(b.periods, opts);
    return { periods: b.periods, flags: b.flags, steps: b.steps, sharedDays: b.sharedDays, ccp };
  }

  // ── 2 · AWARDS ─────────────────────────────────────────────────────────────
  const AWARD_MATCH_TOLERANCE = Object.freeze({ dollars: 0.01, weeks: 0.01 });
  // status: 'match' (no difference), 'match-flagged' (a difference under the
  // tolerance: a match, flagged), 'differs'. The difference is taken to a
  // millionth first so float noise (4.35 − 4.34) cannot pass a cent as less.
  function compareAwardFigure(decision, engine, unit) {
    const d = num(decision), e = num(engine);
    const diff = Math.round((d - e) * 1e6) / 1e6;
    const tol = unit === 'wk' ? AWARD_MATCH_TOLERANCE.weeks : AWARD_MATCH_TOLERANCE.dollars;
    const a = Math.abs(diff);
    const status = a === 0 ? 'match' : a < tol ? 'match-flagged' : 'differs';
    return { decision: d, engine: e, diff, unit: unit === 'wk' ? 'wk' : '$', tol, status,
             match: status !== 'differs', flagged: status === 'match-flagged' };
  }
  const ruleEntered = (v) => v !== undefined && v !== null && String(v).trim() !== '' && isFinite(Number(v));
  // input: { aww, doi, maxRate?, minRate?, rounding, decRate, decTotal,
  //          periods: [{ start, end, rate?, decWeeks, decAmount }] }
  // maxRate / minRate default to the date of accident's (lookupMax / lookupMin).
  // Weeks are periodWeeks on the periods as entered (rule 1 applies: a shared
  // day is counted once), rounded by `rounding` as the CCP tile does.
  function checkAward(input = {}) {
    const doi = input.doi || '';
    const maxRate = input.maxRate != null ? num(input.maxRate) : maxRateForDOA(doi);
    const minRate = input.minRate != null ? num(input.minRate) : minRateForDOA(doi);
    const aww = roundCents(num(input.aww));
    const rate = getCappedTT(aww, maxRate, minRate);
    const rounding = input.rounding || 'none';
    const b = buildPeriods((input.periods || []).map(p => Object.assign({}, p, { desg: 'TT' })), { order: 'entered' });
    const rows = [], flags = b.flags.slice(), steps = [];
    const fmtv = (v, unit) => (unit === 'wk' ? ruleWeeks(v) + ' wk' : ruleMoney(v));
    const line = (labelCode, n, decision, engine, unit, exprCode, exprParams) => {
      const label = fillRule(RULE_TEXT[labelCode], { n });
      steps.push(ruleStep(labelCode, { n }, exprCode, exprParams, fmtv(engine, unit)));
      if (!ruleEntered(decision)) { rows.push({ labelCode, n, label, engine, unit, status: 'not-entered', match: null, flagged: false }); return; }
      const c = compareAwardFigure(decision, engine, unit);
      const row = Object.assign({ labelCode, n, label }, c);
      rows.push(row);
      if (c.status === 'match') return;
      flags.push(ruleFlag(c.status === 'match-flagged' ? 'award.match-flagged' : 'award.differs', c.status === 'match-flagged' ? 'flag' : 'warn',
        { label, labelCode, n, decision: fmtv(c.decision, unit), engine: fmtv(c.engine, unit), diff: fmtv(c.diff, unit), tol: unit === 'wk' ? '0.01 week' : 'one cent' }));
    };
    line('award.label.rate', 0, input.decRate, rate, '$', 'award.step-rate', { aww: ruleMoney(aww) });
    let total = 0;
    const periods = b.periods.map(p => {
      const wks = roundWeeksDown(p.weeks, rounding);
      const pr = num(p.rate) > 0 ? roundCents(num(p.rate)) : rate;
      const amount = roundCents(wks * pr);
      total += amount;
      line('award.label.weeks', p.n, p.decWeeks, wks, 'wk', p.sharedDay ? 'period.step-shared' : 'award.step-weeks', { start: ruleDay(p.start), end: ruleDay(p.end), days: p.days, date: ruleDay(p.start) });
      line('award.label.amount', p.n, p.decAmount, amount, '$', 'award.step-amount', { weeks: ruleWeeks(wks), rate: ruleMoney(pr) });
      return Object.assign({}, p, { wks, rate: pr, amount });
    });
    total = roundCents(total);
    line('award.label.total', 0, input.decTotal, total, '$', 'award.step-total', {});
    const count = (s) => rows.filter(r => r.status === s).length;
    return { rate, maxRate, minRate, aww, total, periods, rows, flags, steps,
             summary: { match: count('match'), flagged: count('match-flagged'), differs: count('differs'), notEntered: count('not-entered') } };
  }

  // ── 3 · SECTION 32 WITH LIENS ──────────────────────────────────────────────
  const S32_LIENS_AFTER_FEE = true;
  // input: computeSettlement's fields + liens: [{ label, amount, source? }]
  // (source 'burns': the row's amount is carrierLienFromBurns, filled by the screen).
  function computeSettlementWithLiens(input = {}) {
    const s = computeSettlement(input);
    const liens = (input.liens || []).map(l => ({ label: (l && l.label) || '', amount: roundCents(Math.max(0, num(l && l.amount))), source: (l && l.source) || '' }))
      .filter(l => l.amount > 0);
    const lienTotal = roundCents(liens.reduce((t, l) => t + l.amount, 0));
    const netBeforeLiens = roundCents(s.net);
    const after = roundCents(netBeforeLiens - lienTotal);
    const shortfall = after < 0 ? roundCents(-after) : 0;
    const netToClaimant = Math.max(0, after);
    const liensPaid = roundCents(lienTotal - shortfall);
    const flags = [], steps = [];
    if (s.settlement > 0) {
      if (s.hasMSA) steps.push(ruleStep('s32.label.setaside', {}, s.msaMode === 'pct' ? 's32.step-setaside-pct' : 's32.step-setaside', { pct: s.msaPct, settlement: ruleMoney(s.settlement) }, ruleMoney(s.msa)));
      steps.push(ruleStep('s32.label.indemnity', {}, 's32.step-indemnity', { settlement: ruleMoney(s.settlement), msa: ruleMoney(s.msa) }, ruleMoney(s.indemnity)));
      steps.push(ruleStep('s32.label.fee', {}, 's32.step-fee', { base: ruleMoney(s.indemnity) }, ruleMoney(s.fee)));
      steps.push(ruleStep('s32.label.net', {}, 's32.step-net', { base: ruleMoney(s.indemnity), fee: ruleMoney(s.fee) }, ruleMoney(netBeforeLiens)));
      liens.forEach(l => steps.push(Object.assign(ruleStep('s32.label.lien', {}, l.source === 'burns' ? 's32.burns-lien' : 's32.step-lien', {}, '−' + ruleMoney(l.amount)), l.label ? { label: l.label } : {})));
      steps.push(ruleStep('s32.label.final', {}, 's32.step-final', { net: ruleMoney(netBeforeLiens), liens: ruleMoney(lienTotal) }, ruleMoney(netToClaimant)));
      if (liens.length) flags.push(ruleFlag('s32.liens-after-fee', 'info', { base: ruleMoney(s.indemnity) }));
      if (shortfall > 0) flags.push(ruleFlag('s32.liens-exceed', 'warn', { liens: ruleMoney(lienTotal), net: ruleMoney(netBeforeLiens), short: ruleMoney(shortfall) }));
    }
    return Object.assign({}, s, { feeBase: s.indemnity, liens, lienTotal, netBeforeLiens, liensPaid, shortfall, netToClaimant, flags, steps });
  }
  // The carrier-lien row a Section 32 takes from the Burns calculator: its
  // "Net WC Lien" (computeBurns netLien), to the cent. No other arithmetic.
  function carrierLienFromBurns(burnsInput = {}) {
    return roundCents(computeBurns(burnsInput).netLien);
  }

  // ── 4 · AWW: WHICH § 14 METHOD ─────────────────────────────────────────────
  const SUBSTANTIALLY_WHOLE_YEAR_DAYS = Object.freeze({ 5: 234, 6: 234 });
  // → { method: 'multi' | 'straight' | null, threshold, wholeYear, flag }
  function awwMethodFor({ daysWorked, daysWeek } = {}) {
    const dw = parseInt(daysWeek, 10) || 0, days = num(daysWorked);
    const threshold = SUBSTANTIALLY_WHOLE_YEAR_DAYS[dw] || null;
    if (!threshold) return { method: null, threshold: null, wholeYear: null, flag: ruleFlag('aww.no-threshold', 'info', { dw: dw || '?' }) };
    if (!(days > 0)) return { method: null, threshold, wholeYear: null, flag: ruleFlag('aww.days-missing', 'info', { threshold, dw }) };
    const wholeYear = days >= threshold;
    return { method: wholeYear ? 'multi' : 'straight', threshold, wholeYear,
             flag: ruleFlag(wholeYear ? 'aww.whole-year' : 'aww.not-whole-year', 'info', { days, dw, threshold }) };
  }
  // input: { earnings, daysWorked, weeksWorked, daysWeek, tips, board, concurrent, doi }
  // Both methods through computeAWW; the rule chooses one (or none).
  function computeAWWRules(input = {}) {
    const dw = parseInt(input.daysWeek, 10) || 5;
    const base = { adjTips: num(input.tips), adjBoard: num(input.board), adjConcurrent: num(input.concurrent), concurrentOn: num(input.concurrent) > 0, doi: input.doi || '' };
    const multi = computeAWW(Object.assign({ method: 'multi', methodMultiEarn: num(input.earnings), methodMultiDays: num(input.daysWorked), daysWeek: dw }, base));
    const straight = computeAWW(Object.assign({ method: 'straight', methodStraightEarn: num(input.earnings), methodStraightWeeks: num(input.weeksWorked) }, base));
    const choice = awwMethodFor({ daysWorked: input.daysWorked, daysWeek: dw });
    const chosen = choice.method === 'multi' ? multi : choice.method === 'straight' ? straight : null;
    const steps = [
      ruleStep('aww.label.multi', {}, 'aww.step-multi', { earn: ruleMoney(input.earnings), days: num(input.daysWorked), mult: DAYS_MULTIPLIER[dw] || 260 }, ruleMoney(multi.baseAww)),
      ruleStep('aww.label.straight', {}, 'aww.step-straight', { earn: ruleMoney(input.earnings), weeks: num(input.weeksWorked) }, ruleMoney(straight.baseAww)),
    ];
    return { multi, straight, choice, chosen, method: choice.method, aww: chosen ? chosen.aww : null, ttRate: chosen ? chosen.ttRate : null,
             steps, flags: [choice.flag] };
  }

  // ── 5 · SLU: THE PROTRACTED HEALING CREDIT ─────────────────────────────────
  const PHP_CREDIT_FROM_LONGEST_HEALING = true;
  // parts: [{ bp, hp? }] (hp: the part's healing period in weeks; from the
  // schedule when not given; a part the schedule does not list adds nothing).
  // weeksPaid: the weeks of the healing period actually paid.
  // → { weeksPaid, longestHp, longestPart, creditWks, flags }
  function protractedHealingCredit(parts = [], weeksPaid = 0) {
    let longestHp = 0, longestPart = '';
    (parts || []).forEach(p => {
      if (!p) return;
      const sp = p.hp != null ? null : findSLUPart(p.bp);
      const hp = p.hp != null ? num(p.hp) : (sp ? sp.hp : 0);
      if (hp > longestHp) { longestHp = hp; longestPart = sp ? sp.n : String(p.bp == null ? '' : p.bp); }
    });
    const paid = num(weeksPaid);
    const creditWks = Math.max(0, paid - longestHp);
    const flags = [];
    if (paid > 0 && longestPart) {
      flags.push(creditWks > 0
        ? ruleFlag('slu.php-longest', 'info', { part: longestPart, hp: ruleWeeks(longestHp), paid: ruleWeeks(paid), credit: ruleWeeks(creditWks) })
        : ruleFlag('slu.php-none', 'info', { part: longestPart, hp: ruleWeeks(longestHp), paid: ruleWeeks(paid) }));
    }
    return { weeksPaid: paid, longestHp, longestPart, creditWks, flags };
  }
  // SLU with the healing period from dates: weeksBetween(start, end) is the
  // weeks paid; computeSLU does the award (it takes the credit through
  // protractedHealingCredit). input: { rows, tt, paidStart, paidEnd, priorPay }
  function computeSLUHealing(input = {}) {
    const paid = (input.paidStart && input.paidEnd) ? weeksBetween(input.paidStart, input.paidEnd) : 0;
    const rows = (input.rows || []).filter(r => r && r.bp);
    const slu = computeSLU({ rows: rows.map(r => ({ bp: r.bp, pct: num(r.pct) })), tt: input.tt, phpWks: paid, priorPay: input.priorPay });
    const php = protractedHealingCredit(slu.rowOut.filter(r => !r.unknown), paid);
    const steps = paid > 0 ? [ruleStep('slu.label.paid', {}, 'slu.php-paid', { start: ruleDay(input.paidStart), end: ruleDay(input.paidEnd) }, ruleWeeks(paid) + ' wk')] : [];
    return { slu, php, weeksPaid: paid, steps, flags: php.flags };
  }

  const CALC_RULES = {
    RULE_TEXT, fillRule,
    PERIOD_SHARED_DAY_COUNTED_ONCE, buildPeriods, computePeriodBuilder,
    AWARD_MATCH_TOLERANCE, compareAwardFigure, checkAward,
    S32_LIENS_AFTER_FEE, computeSettlementWithLiens, carrierLienFromBurns,
    SUBSTANTIALLY_WHOLE_YEAR_DAYS, awwMethodFor, computeAWWRules,
    PHP_CREDIT_FROM_LONGEST_HEALING, protractedHealingCredit, computeSLUHealing,
  };
  // END SHARED RULES 2026-11-16

  return {
    // constants
    MAX_RATES, MIN_RATES, SLU_BP, SLU_ALIASES, LWEC_BR, NERVE_CAPS, CERVICAL_RANKS, LUMBAR_RANKS,
    DAYS_MULTIPLIER,
    // lookups + helpers
    lookupMax, lookupMin, maxRateForDOA, minRateForDOA, newestMaxRate, findSLUPart,
    // is a date of injury inside the published table (Joel, 2026-10-30)
    rateCoverage, rateRefused, RATE_TABLE_FIRST, RATE_TABLE_LAST,
    applyRateBounds, isAwwBelowMin, getCappedTT, lwecBracket, floorFee5,
    inclusiveDays, periodWeeks, dayAfter, weeksBetween, roundWeeksDown,
    // WCB rounding: wages, weekly rates and awards to the cent (R1–R3)
    roundCents,
    // money in integer cents + the prior-counsel fee split (the website's, verbatim)
    toCents, splitFee, feeSplitOf,
    // who pays the fee on an employer reimbursement (Joel 2026-10-12)
    reimbFeeSplit,
    // calculators
    computeAWW, computeSLU, computeLWEC, ccpPeriodRate, computeCCP, computeBurns, computeSettlement,
    computeApportionment,
    nerveCap, clampNerveScores, radRank,
    // radiculopathy from findings, and why a total has no letter (Joel 2026-11-08)
    RADIC_POINTS, radRankInfo, computeRadiculopathy,
    // Joel's rulings, 2026-11-16 (BEGIN SHARED RULES, above)
    ...CALC_RULES,
  };
});

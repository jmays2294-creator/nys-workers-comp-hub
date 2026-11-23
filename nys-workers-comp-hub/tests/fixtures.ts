// Fictional test data. The Hub payloads were captured from read-only calls with made-up inputs, or made by
// the Hub's own code offline; the checklist is the plugin's own fictional example. No real person or case.
export type Reply = { result: unknown; text: string; isError?: true }
export type Payload = Record<string, unknown>

export const PLUGIN = 'mcp__plugin_nys-workers-comp-hub_nys-workers-comp-hub__'
export const CONNECTOR = 'mcp__claude_ai_The_Comp_Desk__'

export function reply(p: Payload): Reply {
  const text = JSON.stringify(p)
  return p.ok === false ? { result: text, text, isError: true } : { result: text, text }
}

const NOTICE = { not_legal_advice: 'This is general information, not legal advice, and using it does not create an attorney-client relationship.', not_a_law_firm: 'The Comp Desk is a software platform, not a law firm.' }

export const SLU_OK: Payload = {
 "ok": true,
 "calculator": "calculate_slu_award",
 "inputs": {
  "aww": 1200,
  "date_of_accident": "2024-03-15",
  "body_parts": [
   {
    "body_part": "Arm",
    "loss_percent": 25
   }
  ],
  "prior_payments": 0
 },
 "result": {
  "aww": 1200,
  "rate": 800,
  "max": 1145.43,
  "max_rate_year": "Jul 1, 2023 – Jun 30, 2024",
  "min": 275,
  "min_rate_year": "Jan 1, 2024 – Dec 31, 2024",
  "parts": [
   {
    "body_part": "Arm",
    "loss_percent": 25,
    "scheduled_weeks": 312,
    "healing_period_weeks": 32,
    "weeks": 78
   }
  ],
  "schedule_weeks": 78,
  "php_credit_weeks": 0,
  "total_weeks": 78,
  "award": 62400,
  "prior_payments": 0,
  "moving": 62400,
  "fee": 9360,
  "net": 53040
 },
 "display": {
  "rate": "$800.00",
  "award": "$62,400.00",
  "total_weeks": "78.00",
  "moving": "$62,400.00",
  "fee": "$9,360.00",
  "net": "$53,040.00"
 },
 "steps": [
  {
   "step": 1,
   "label": "Maximum weekly benefit for the date of accident (Jul 1, 2023 – Jun 30, 2024)",
   "value": 1145.43,
   "display": "$1,145.43",
   "formula": "rate-bounds",
   "engine": "lookupMax"
  },
  {
   "step": 2,
   "label": "Minimum weekly benefit for the date of accident (Jan 1, 2024 – Dec 31, 2024)",
   "value": 275,
   "display": "$275.00",
   "formula": "rate-bounds",
   "engine": "lookupMin"
  },
  {
   "step": 3,
   "label": "Average weekly wage, to the cent",
   "value": 1200,
   "display": "$1,200.00",
   "engine": "roundCents"
  },
  {
   "step": 4,
   "label": "Two-thirds of the average weekly wage, to the cent",
   "value": 800,
   "display": "$800.00",
   "formula": "rate-temporary-total",
   "engine": "getCappedTT(aww, 0, 0)"
  },
  {
   "step": 5,
   "label": "Weekly rate within the maximum and minimum (a wage below the minimum is paid in full)",
   "value": 800,
   "display": "$800.00",
   "formula": "rate-bounds",
   "engine": "getCappedTT / applyRateBounds"
  },
  {
   "step": 6,
   "label": "Arm: 25% × 312 scheduled weeks",
   "value": 78,
   "display": "78.00",
   "formula": "slu-weeks",
   "engine": "computeSLU"
  },
  {
   "step": 7,
   "label": "Total weeks",
   "value": 78,
   "display": "78.00",
   "formula": "slu-weeks",
   "engine": "computeSLU"
  },
  {
   "step": 8,
   "label": "Award: total weeks × weekly rate, to the cent",
   "value": 62400,
   "display": "$62,400.00",
   "formula": "slu-gross-net",
   "engine": "computeSLU"
  },
  {
   "step": 9,
   "label": "Money moving: award − prior payments",
   "value": 62400,
   "display": "$62,400.00",
   "engine": "computeSLU"
  },
  {
   "step": 10,
   "label": "Fee: 15% of the money moving, rounded down to $5 (the OC-400.1 amount)",
   "value": 9360,
   "display": "$9,360.00",
   "formula": "standard-fee",
   "engine": "computeSLU / floorFee5"
  },
  {
   "step": 11,
   "label": "Net to the claimant",
   "value": 53040,
   "display": "$53,040.00",
   "engine": "computeSLU"
  }
 ],
 "notes": [
  "No 130-week credit applies to a schedule award (it applies to LWEC only).",
  "The fee is 15% of the money moving, rounded down to $5: the amount the OC-400.1 requests."
 ],
 "formulas": [
  {
   "id": "slu-weeks",
   "name": "SLU award (weeks)",
   "citation": "WCL §15(3)(a)–(u) (member schedules)",
   "verified": false,
   "citation_status": "Citation not yet attorney-reviewed."
  },
  {
   "id": "slu-gross-net",
   "name": "SLU gross & net",
   "citation": "WCL §15(4-a) (protracted healing period)",
   "verified": false,
   "citation_status": "Citation not yet attorney-reviewed."
  },
  {
   "id": "rate-temporary-total",
   "name": "Temporary Total rate",
   "citation": "WCL §15(2) ; bounds §15(6)",
   "verified": false,
   "citation_status": "Citation not yet attorney-reviewed."
  },
  {
   "id": "rate-bounds",
   "name": "Statutory Max/Min bounds",
   "citation": "WCL §15(6) ; min indexed to ⅕ NYSAWW eff. 7/1/2026",
   "verified": false,
   "citation_status": "Citation not yet attorney-reviewed."
  },
  {
   "id": "standard-fee",
   "name": "Standard fee on moving money",
   "citation": "WCL §24 (Board-approved fees)",
   "verified": false,
   "citation_status": "Citation not yet attorney-reviewed."
  }
 ],
 "source": {
  "engine": "The Comp Desk calc-core (the same engine as the app, the website calculators and the Pro Workspace)",
  "rate_tables": "NYS WCB maximum and minimum weekly benefit by date of accident, as carried in calc-core"
 },
 "notice": {
  "not_legal_advice": "This is general information, not legal advice, and using it does not create an attorney-client relationship.",
  "not_a_law_firm": "The Comp Desk is a software platform, not a law firm.",
  "figures": "Figures come from The Comp Desk calculator (calc-core) using only the inputs given. They are estimates, not a Board finding or a guarantee of any outcome."
 }
}

export const LWEC_OK: Payload = {
 "ok": true,
 "calculator": "calculate_lwec_award",
 "inputs": {
  "aww": 950,
  "date_of_accident": "2023-09-12",
  "lwec_percent": 60,
  "prior_temporary_weeks": 150
 },
 "result": {
  "aww": 950,
  "lwec_percent": 60,
  "rate_before_percent": 633.33,
  "weekly_rate": 380,
  "bracket": "51–60%",
  "lifetime": false,
  "weeks": 350,
  "award_before_credit": 133000,
  "max": 1145.43,
  "min": 150,
  "max_from": "2023-07-01",
  "max_to": "2024-06-30",
  "min_from": "2013-05-01",
  "min_to": "2023-12-31",
  "prior_temporary_weeks": 150,
  "credit_weeks": 20,
  "weeks_after_credit": 330,
  "award_after_credit": 125400
 },
 "display": {
  "weekly_rate": "$380.00",
  "rate_before_percent": "$633.33",
  "weeks": "350",
  "award_before_credit": "$133,000.00",
  "credit_weeks": "20",
  "weeks_after_credit": "330",
  "award_after_credit": "$125,400.00"
 },
 "steps": [
  {
   "step": 1,
   "label": "Maximum weekly benefit for the date of accident",
   "value": 1145.43,
   "display": "$1,145.43",
   "formula": "rate-bounds",
   "engine": "lookupMax"
  },
  {
   "step": 2,
   "label": "Minimum weekly benefit for the date of accident",
   "value": 150,
   "display": "$150.00",
   "formula": "rate-bounds",
   "engine": "lookupMin"
  },
  {
   "step": 3,
   "label": "Weekly rate before the percentage (two-thirds of the wage within the limits)",
   "value": 633.33,
   "display": "$633.33",
   "formula": "rate-temporary-total",
   "engine": "getCappedTT"
  },
  {
   "step": 4,
   "label": "Weekly rate: rate × LWEC 60%, to the cent, within the limits",
   "value": 380,
   "display": "$380.00",
   "formula": "lwec-class-rate",
   "engine": "computeLWEC"
  },
  {
   "step": 5,
   "label": "LWEC bracket 51–60% → weeks",
   "value": 350,
   "display": "350",
   "formula": "lwec-duration-total",
   "engine": "lwecBracket"
  },
  {
   "step": 6,
   "label": "Award before credit: weekly rate × weeks",
   "value": 133000,
   "display": "$133,000.00",
   "formula": "lwec-duration-total",
   "engine": "computeLWEC"
  },
  {
   "step": 7,
   "label": "Credit: temporary weeks paid beyond 130",
   "value": 20,
   "display": "20",
   "formula": "lwec-duration-total",
   "engine": "computeLWEC"
  },
  {
   "step": 8,
   "label": "Award after credit: weekly rate × (weeks − credit)",
   "value": 125400,
   "display": "$125,400.00",
   "formula": "lwec-duration-total",
   "engine": "computeLWEC"
  }
 ],
 "formulas": [
  {
   "id": "lwec-class-rate",
   "name": "LWEC class rate",
   "citation": "WCL §15(3)(w) ; §15(5-a)",
   "verified": false,
   "citation_status": "Citation not yet attorney-reviewed."
  },
  {
   "id": "lwec-duration-total",
   "name": "LWEC duration & total",
   "citation": "WCL §15(3)(w) durational caps (2009/2017 amendments)",
   "verified": false,
   "citation_status": "Citation not yet attorney-reviewed."
  },
  {
   "id": "standard-fee",
   "name": "Standard fee on moving money",
   "citation": "WCL §24 (Board-approved fees)",
   "verified": false,
   "citation_status": "Citation not yet attorney-reviewed."
  },
  {
   "id": "rate-bounds",
   "name": "Statutory Max/Min bounds",
   "citation": "WCL §15(6) ; min indexed to ⅕ NYSAWW eff. 7/1/2026",
   "verified": false,
   "citation_status": "Citation not yet attorney-reviewed."
  },
  {
   "id": "rate-temporary-total",
   "name": "Temporary Total rate",
   "citation": "WCL §15(2) ; bounds §15(6)",
   "verified": false,
   "citation_status": "Citation not yet attorney-reviewed."
  }
 ],
 "source": {
  "engine": "The Comp Desk calc-core (the same engine as the app, the website calculators and the Pro Workspace)",
  "rate_tables": "NYS WCB maximum and minimum weekly benefit by date of accident, as carried in calc-core"
 },
 "notice": {
  "not_legal_advice": "This is general information, not legal advice, and using it does not create an attorney-client relationship.",
  "not_a_law_firm": "The Comp Desk is a software platform, not a law firm.",
  "figures": "Figures come from The Comp Desk calculator (calc-core) using only the inputs given. They are estimates, not a Board finding or a guarantee of any outcome."
 }
}

export const RATE_MISSING: Payload = {
 "ok": false,
 "calculator": "calculate_weekly_rate",
 "status": "missing",
 "message": "Not enough to calculate. Every listed input is needed; nothing was calculated and no figure is implied. Ask for: their average weekly wage before the injury (gross pay, before taxes).",
 "missing": [
  "aww"
 ],
 "notice": {
  "not_legal_advice": "This is general information, not legal advice, and using it does not create an attorney-client relationship.",
  "not_a_law_firm": "The Comp Desk is a software platform, not a law firm."
 }
}

export const SLU_INVALID: Payload = {
 "ok": false,
 "calculator": "calculate_slu_award",
 "status": "invalid",
 "message": "Some inputs do not work for this calculation (see problems). Nothing was calculated.",
 "problems": [
  {
   "field": "claimant_name",
   "issue": "unknown_field",
   "allowed": [
    "aww",
    "date_of_accident",
    "body_parts",
    "weeks_at_temporary_total",
    "prior_payments",
    "employer_reimbursement",
    "prior_counsel_fees"
   ]
  },
  {
   "field": "date_of_accident",
   "issue": "in_the_future"
  }
 ],
 "notice": {
  "not_legal_advice": "This is general information, not legal advice, and using it does not create an attorney-client relationship.",
  "not_a_law_firm": "The Comp Desk is a software platform, not a law firm."
 }
}

export const MAXMIN_OK: Payload = {
 "ok": true,
 "calculator": "get_max_min_rate",
 "inputs": {
  "date_of_accident": "2025-08-04"
 },
 "result": {
  "max": 1222.42,
  "min": 325,
  "max_from": "2025-07-01",
  "max_to": "2026-06-30",
  "min_from": "2025-01-01",
  "min_to": "2026-06-30",
  "max_rate_year": "Jul 1, 2025 – Jun 30, 2026",
  "min_rate_year": "Jan 1, 2025 – Jun 30, 2026"
 },
 "display": {
  "max": "$1,222.42",
  "min": "$325.00"
 },
 "steps": [
  {
   "step": 1,
   "label": "Maximum weekly benefit for the date of accident (Jul 1, 2025 – Jun 30, 2026)",
   "value": 1222.42,
   "display": "$1,222.42",
   "formula": "rate-bounds",
   "engine": "lookupMax"
  },
  {
   "step": 2,
   "label": "Minimum weekly benefit for the date of accident (Jan 1, 2025 – Jun 30, 2026)",
   "value": 325,
   "display": "$325.00",
   "formula": "rate-bounds",
   "engine": "lookupMin"
  }
 ],
 "formulas": [
  {
   "id": "rate-bounds",
   "name": "Statutory Max/Min bounds",
   "citation": "WCL §15(6) ; min indexed to ⅕ NYSAWW eff. 7/1/2026",
   "verified": false,
   "citation_status": "Citation not yet attorney-reviewed."
  }
 ],
 "source": {
  "engine": "The Comp Desk calc-core (the same engine as the app, the website calculators and the Pro Workspace)",
  "rate_tables": "NYS WCB maximum and minimum weekly benefit by date of accident, as carried in calc-core"
 },
 "notice": {
  "not_legal_advice": "This is general information, not legal advice, and using it does not create an attorney-client relationship.",
  "not_a_law_firm": "The Comp Desk is a software platform, not a law firm.",
  "figures": "Figures come from The Comp Desk calculator (calc-core) using only the inputs given. They are estimates, not a Board finding or a guarantee of any outcome."
 }
}

export const S32_OK: Payload = {
 "ok": true,
 "calculator": "calculate_section_32_split",
 "inputs": {
  "settlement_amount": 85000,
  "msa_amount": 10000
 },
 "result": {
  "settlement": 85000,
  "msa": 10000,
  "indemnity": 75000,
  "fee": 11250,
  "net": 63750
 },
 "display": {
  "settlement": "$85,000.00",
  "msa": "$10,000.00",
  "indemnity": "$75,000.00",
  "fee": "$11,250.00",
  "net": "$63,750.00"
 },
 "steps": [
  {
   "step": 1,
   "label": "Settlement",
   "value": 85000,
   "display": "$85,000.00",
   "formula": "section-32-net",
   "engine": "computeSettlement"
  },
  {
   "step": 2,
   "label": "Medicare set-aside, off first",
   "value": 10000,
   "display": "$10,000.00",
   "formula": "section-32-net",
   "engine": "computeSettlement"
  },
  {
   "step": 3,
   "label": "Indemnity: settlement − set-aside",
   "value": 75000,
   "display": "$75,000.00",
   "formula": "section-32-net",
   "engine": "computeSettlement"
  },
  {
   "step": 4,
   "label": "Fee: 15% of the indemnity, rounded down to $5",
   "value": 11250,
   "display": "$11,250.00",
   "formula": "standard-fee",
   "engine": "computeSettlement / floorFee5"
  },
  {
   "step": 5,
   "label": "Net to the claimant",
   "value": 63750,
   "display": "$63,750.00",
   "formula": "section-32-net",
   "engine": "computeSettlement"
  }
 ],
 "notes": [
  "Any Medicare set-aside comes off first; the fee shown is 15% of the rest, rounded down to $5. The fee on a Section 32 is whatever the Workers' Compensation Law Judge approves, which can differ."
 ],
 "formulas": [
  {
   "id": "section-32-net",
   "name": "Section 32 net to claimant",
   "citation": "WCL §32 (settlement) ; §24 (fee approval) ; 42 U.S.C. §1395y(b) (MSP/MSA)",
   "verified": false,
   "citation_status": "Citation not yet attorney-reviewed."
  },
  {
   "id": "standard-fee",
   "name": "Standard fee on moving money",
   "citation": "WCL §24 (Board-approved fees)",
   "verified": false,
   "citation_status": "Citation not yet attorney-reviewed."
  }
 ],
 "source": {
  "engine": "The Comp Desk calc-core (the same engine as the app, the website calculators and the Pro Workspace)",
  "rate_tables": "NYS WCB maximum and minimum weekly benefit by date of accident, as carried in calc-core"
 },
 "notice": {
  "not_legal_advice": "This is general information, not legal advice, and using it does not create an attorney-client relationship.",
  "not_a_law_firm": "The Comp Desk is a software platform, not a law firm.",
  "figures": "Figures come from The Comp Desk calculator (calc-core) using only the inputs given. They are estimates, not a Board finding or a guarantee of any outcome."
 }
}

export const DEADLINE_OK: Payload = {
 "ok": true,
 "calculator": "get_notice_deadline",
 "inputs": {
  "date_of_accident": "2026-11-10"
 },
 "result": {
  "deadline": "2026-12-10",
  "anchor": "2026-11-10",
  "anchor_kind": "accident",
  "days_left": 17,
  "overdue": false,
  "statute": "WCL §18",
  "qualifier": "may be excused by the Board",
  "notice_days": 30
 },
 "display": {
  "deadline": "2026-12-10",
  "anchor": "2026-11-10"
 },
 "steps": [
  {
   "step": 1,
   "label": "Counted from the date of accident",
   "value": "2026-11-10",
   "display": "2026-11-10",
   "engine": "noticeDeadline"
  },
  {
   "step": 2,
   "label": "Notice due 30 days later (WCL §18; may be excused by the Board)",
   "value": "2026-12-10",
   "display": "2026-12-10",
   "engine": "noticeDeadline"
  },
  {
   "step": 3,
   "label": "Days left from today in New York",
   "value": 17,
   "display": "17",
   "engine": "noticeDeadline"
  }
 ],
 "notes": [
  "Days left are counted from today in New York (2026-11-23)."
 ],
 "formulas": [],
 "source": {
  "engine": "The Comp Desk calc-core (the same engine as the app, the website calculators and the Pro Workspace)",
  "rate_tables": "NYS WCB maximum and minimum weekly benefit by date of accident, as carried in calc-core"
 },
 "notice": {
  "not_legal_advice": "This is general information, not legal advice, and using it does not create an attorney-client relationship.",
  "not_a_law_firm": "The Comp Desk is a software platform, not a law firm.",
  "figures": "Figures come from The Comp Desk calculator (calc-core) using only the inputs given. They are estimates, not a Board finding or a guarantee of any outcome."
 }
}

export const WEEKS_OK: Payload = {
 "ok": true,
 "calculator": "calculate_benefit_weeks",
 "inputs": {
  "weeks_rounding": "tenth",
  "periods": [
   {
    "start_date": "2025-01-11",
    "end_date": "2025-04-30"
   },
   {
    "start_date": "2025-04-30",
    "end_date": "2025-06-30"
   }
  ]
 },
 "result": {
  "weeks_rounding": "tenth",
  "periods": [
   {
    "start_date": "2025-01-11",
    "end_date": "2025-04-30",
    "held_in_abeyance": false,
    "inclusive_days": 110,
    "shared_boundary_day_dropped": false,
    "weeks_exact": 15.714285714285714,
    "weeks": 15.7,
    "next_day": "2025-05-01"
   },
   {
    "start_date": "2025-04-30",
    "end_date": "2025-06-30",
    "held_in_abeyance": false,
    "inclusive_days": 62,
    "shared_boundary_day_dropped": true,
    "weeks_exact": 8.714285714285714,
    "weeks": 8.7,
    "next_day": "2025-07-01"
   }
  ]
 },
 "display": {
  "periods": [
   {
    "start_date": "2025-01-11",
    "end_date": "2025-04-30",
    "weeks": "15.7"
   },
   {
    "start_date": "2025-04-30",
    "end_date": "2025-06-30",
    "weeks": "8.7"
   }
  ]
 },
 "steps": [
  {
   "step": 1,
   "label": "Period 1: 2025-01-11 to 2025-04-30, days counting both ends",
   "value": 110,
   "display": "110",
   "engine": "inclusiveDays"
  },
  {
   "step": 2,
   "label": "Period 1: weeks (days ÷ 7), rounded down to the tenth",
   "value": 15.7,
   "display": "15.7000",
   "engine": "periodWeeks / roundWeeksDown"
  },
  {
   "step": 3,
   "label": "Period 2: 2025-04-30 to 2025-06-30, days counting both ends",
   "value": 62,
   "display": "62",
   "engine": "inclusiveDays"
  },
  {
   "step": 4,
   "label": "Period 2: starts the day the previous one ended, so that day counts once",
   "value": 61,
   "display": "61",
   "engine": "periodWeeks"
  },
  {
   "step": 5,
   "label": "Period 2: weeks (days ÷ 7), rounded down to the tenth",
   "value": 8.7,
   "display": "8.7000",
   "engine": "periodWeeks / roundWeeksDown"
  }
 ],
 "notes": [
  "Both end dates count; a period that starts the day the previous one ended counts that day once; a held-in-abeyance period counts no weeks. These are the same week counts the CCP / Award calculator uses."
 ],
 "formulas": [],
 "source": {
  "engine": "The Comp Desk calc-core (the same engine as the app, the website calculators and the Pro Workspace)",
  "rate_tables": "NYS WCB maximum and minimum weekly benefit by date of accident, as carried in calc-core"
 },
 "notice": {
  "not_legal_advice": "This is general information, not legal advice, and using it does not create an attorney-client relationship.",
  "not_a_law_firm": "The Comp Desk is a software platform, not a law firm.",
  "figures": "Figures come from The Comp Desk calculator (calc-core) using only the inputs given. They are estimates, not a Board finding or a guarantee of any outcome."
 }
}

export const FORMULA_OK: Payload = {
 "ok": true,
 "tool": "lookup_formula",
 "catalog_version": "2026-10-01",
 "formula": {
  "id": "slu-weeks",
  "group": "Schedule Loss of Use (§15(3))",
  "name": "SLU award (weeks)",
  "formula": "Weeks = ( LOU% ÷ 100 ) × W_member",
  "where": [
   {
    "symbol": "LOU%",
    "meaning": "percent loss of use"
   },
   {
    "symbol": "W_member",
    "meaning": "statutory weeks for that body part"
   },
   {
    "symbol": "Weeks",
    "meaning": "awarded schedule weeks"
   }
  ],
  "explanation": "A schedule loss multiplies the member's statutory week value by the percent loss of use found by the medical evidence.",
  "citation": "WCL §15(3)(a)–(u) (member schedules)",
  "verified": false,
  "citation_status": "Citation not yet attorney-reviewed."
 },
 "notice": {
  "not_legal_advice": "This is general information, not legal advice, and using it does not create an attorney-client relationship.",
  "not_a_law_firm": "The Comp Desk is a software platform, not a law firm."
 }
}

export const CASELAW_NOTFOUND: Payload = {
 "ok": false,
 "tool": "search_case_law",
 "status": "not_found",
 "message": "No case in The Comp Desk's approved case-law library matches. Do not cite a case that is not retrieved here.",
 "notice": {
  "not_legal_advice": "This is general information, not legal advice, and using it does not create an attorney-client relationship.",
  "not_a_law_firm": "The Comp Desk is a software platform, not a law firm."
 }
}

export const RATE_LIMITED: Payload = { ok: false, tool: 'calculate_aww', status: 'rate_limited', message: 'Too many requests right now. Try again in 30 seconds.', retry_after: 30, notice: NOTICE }
export const WS_SENT: Payload = { ok: true, tool: 'add_workspace_cases', counts: { queued: 2, duplicate: 1 }, message: 'Queued 2 cases for your review in the Pro Workspace (DEMO).', notice: NOTICE }
export const WS_STATUS: Payload = { ok: true, tool: 'get_import_status', counts: { imported: 1, needs_review: 1 }, notice: NOTICE }
export const NOTE_ID = '00000000-0000-4000-8000-000000000001'
export const NOTES_LIST: Payload = { ok: true, tool: 'list_hearing_notes', schema: 'tcd.hearing_note.v1', count: 3, notes: [{ id: NOTE_ID, label: 'DEMO' }], notice: NOTICE }
export const NOTE_ONE: Payload = { ok: true, tool: 'get_hearing_note', schema: 'tcd.hearing_note.v1', note: { id: NOTE_ID, label: 'DEMO' }, notice: NOTICE }
export const NOTE_POSTED: Payload = { ok: true, tool: 'mark_hearing_note_posted', id: NOTE_ID, status: 'entered', entered_system: 'demo', message: "Marked posted in the attorney's Pro Workspace.", notice: NOTICE }

/** skills/hearing-prep-checklist/examples/expected-output/hearing-checklist-2026-12-03.md, verbatim. */
export const CHECKLIST: string = "# Hearing checklist: Thursday, December 3, 2026\n\nDRAFT for the attorney's review. FICTIONAL EXAMPLE: the people, cases and hearings are made up.\nBuilt on 11/19/2026 from the files in `hearings-2026-12-03/` (listed at the end). Every item names its source.\nItems marked \"verify\" rest on a rule to check against the Board's current rules.\nOut of scope: the 12/04/2026 hearing on the calendar (`calendar-week-of-2026-11-30.md` line 9).\n\n## 1. A. Garcia (DEMO) · WCB DEMO-0001 · 12/03/2026 9:30 AM · Permanency (SLU)\n\nHearing: `calendar-week-of-2026-11-30.md` line 7: \"| 12/03/2026 | 9:30 AM | Hearing | A. Garcia (DEMO) | DEMO-0001 | Part 7 | Virtual | Permanency (SLU) |\"\n\n### Forms and filings\n- [ ] Have the OC-400.1 fee application ready in case the hearing makes an SLU award.\n  - Source: `calendar-week-of-2026-11-30.md` line 7: \"Permanency (SLU)\"\n  - Rule: Form OC-400.1, attorney's fee application (verify)\n\n### Medical and IME\n- [ ] Get the treating doctor's C-4.3 on file before the hearing. Two requests are unanswered; the office says the doctor sees the claimant on 11/24/2026 and will write it after.\n  - Source: `garcia-DEMO-0001/hearing-notes-2026-10-09.md` line 11: \"Judge directed claimant's counsel to produce the treating doctor's C-4.3 within 45 days.\"\n  - Source: `garcia-DEMO-0001/prep-notes.md` line 6: \"11/12/2026: second request faxed for the C-4.3. Office says the doctor will see her on 11/24/2026 and write it after.\"\n  - Rule: Form C-4.3, Doctor's Report of MMI/Permanent Impairment: the treating doctor's permanency opinion (verify)\n- [ ] Compare the IME opinion (20% of the right arm, exam 10/20/2026, report sent 10/27/2026) with the treating doctor's C-4.3 when it arrives. Hub estimate on the IME's opinion only: award $41,600.21 (62.40 weeks at $666.67).\n  - Source: `garcia-DEMO-0001/ime-report-2026-10-20.txt` line 10: \"Schedule loss of use of the right arm: 20%.\"\n  - Source: `garcia-DEMO-0001/ime-report-2026-10-20.txt` line 11: \"Report sent to the Board and the parties on 10/27/2026.\"\n  - Source: `garcia-DEMO-0001/hearing-notes-2026-10-09.md` line 7: \"DOA 08/01/2025. AWW found at $1,000.00.\"\n  - Rule: WCL §137, IME notice, report filing and service (verify)\n  - Figure: F1\n\n### Testimony and witnesses\n- [ ] If the C-4.3 and the IME differ, decide whether to ask for depositions of both doctors, as the judge raised at the last hearing.\n  - Source: `garcia-DEMO-0001/hearing-notes-2026-10-09.md` line 13: \"If the treating doctor and the IME differ, the parties to consider depositions of both doctors.\"\n\n### Deadlines\n- [ ] Produce the treating doctor's C-4.3 by the deadline. The decision filed 10/14/2026 says within 60 days; the hearing notes say 45 days. Verify which date applies (see Conflicts to resolve).\n  - Source: `garcia-DEMO-0001/nod-2026-10-14.txt` line 9: \"The claimant's attorney is directed to produce the treating physician's permanency report (C-4.3) within 60 days.\"\n  - Source: `garcia-DEMO-0001/hearing-notes-2026-10-09.md` line 11: \"produce the treating doctor's C-4.3 within 45 days\"\n\n### Settlement and Section 32\n- [ ] Check the Section 32 figures carrier counsel mentioned by phone (nothing in writing). Hub split: MSA $10,000.00, fee $7,500.00, net $42,500.00. The fee is whatever the judge approves, which can differ.\n  - Source: `garcia-DEMO-0001/prep-notes.md` line 7: \"carrier may discuss a Section 32 of $60,000 with a $10,000 MSA. Nothing in writing.\"\n  - Rule: WCL §32 agreements need Board approval (verify)\n  - Figure: F2\n- [ ] Discuss the settlement question with the client before the hearing, as she was told at the last hearing.\n  - Source: `garcia-DEMO-0001/hearing-notes-2026-10-09.md` line 16: \"Client asked about a settlement; told her we would discuss it with her before the next hearing.\"\n\n### Client contact\n- [ ] Confirm the client has the hearing date, time and format: 12/03/2026, 9:30 AM, virtual, Part 7.\n  - Source: `calendar-week-of-2026-11-30.md` line 7: \"| 12/03/2026 | 9:30 AM | Hearing | A. Garcia (DEMO) | DEMO-0001 | Part 7 | Virtual |\"\n- [ ] Confirm the client's phone number on file (it changed last month), and call in Spanish.\n  - Source: `garcia-DEMO-0001/prep-notes.md` line 8: \"Client prefers calls in Spanish. Her phone number changed last month; confirm the number on file before the hearing.\"\n- [ ] Confirm a Spanish interpreter is requested for the hearing.\n  - Source: `garcia-DEMO-0001/hearing-notes-2026-10-09.md` line 16: \"Client: Spanish speaker; interpreter used today.\"\n  - Rule: the Board provides hearing interpreters on request (verify)\n\n### Conflicts to resolve\n- The C-4.3 deadline: the hearing notes say 45 days, the decision says 60 days. The decision is the Board's record; verify.\n  - Source: `garcia-DEMO-0001/hearing-notes-2026-10-09.md` line 11: \"within 45 days\"\n  - Source: `garcia-DEMO-0001/nod-2026-10-14.txt` line 9: \"within 60 days\"\n\n### Not found in the files\n- The treating doctor's C-4.3, or any permanency report from the treating doctor (looked in `garcia-DEMO-0001/`).\n- A payment record, so the Hub estimate (F1) has no prior payments, fee or net.\n- An OC-400.1 fee application.\n\n## 2. T. Baptiste (DEMO) · WCB DEMO-0002 · 12/03/2026 11:00 AM · Pre-hearing conference (controverted)\n\nHearing: `calendar-week-of-2026-11-30.md` line 8: \"| 12/03/2026 | 11:00 AM | Pre-hearing conference | T. Baptiste (DEMO) | DEMO-0002 | Part 3 | Virtual | Controverted claim: pre-hearing conference |\"\n\n### Forms and filings\n- [ ] File the PH-16.2 pre-hearing conference statement; the notes say it is not started. At least 10 days before the 12/03/2026 conference is 11/23/2026: verify.\n  - Source: `baptiste-DEMO-0002/prep-notes.md` line 6: \"PH-16.2 for the 12/03 conference: not started yet.\"\n  - Source: `calendar-week-of-2026-11-30.md` line 8: \"Controverted claim: pre-hearing conference\"\n  - Rule: PH-16.2 pre-hearing conference statement, filed at least 10 days before the pre-hearing conference (12 NYCRR 300.38; verify)\n- [ ] For the AWW on the PH-16.2, the file has the C-3's $900.00; the carrier's payroll for the 52 weeks before the accident is still to come.\n  - Source: `baptiste-DEMO-0002/prep-notes.md` line 5: \"It states an average weekly wage of $900.00.\"\n  - Source: `baptiste-DEMO-0002/nod-2026-11-06.txt` line 9: \"The carrier is directed to produce the employer's payroll for the 52 weeks before the accident, to set the AWW.\"\n\n### Medical and IME\n- [ ] Check that the IME report from the 11/18/2026 exam is in the file before the conference; none had arrived by 11/19/2026.\n  - Source: `baptiste-DEMO-0002/prep-notes.md` line 7: \"11/19/2026: no IME report received yet from the 11/18/2026 exam.\"\n  - Rule: WCL §137, IME notice, report filing and service (verify)\n- [ ] Follow up on the MRI prior authorization request the carrier has not answered, and raise it at the conference if it is still open.\n  - Source: `baptiste-DEMO-0002/prep-notes.md` line 8: \"MRI request: carrier has not answered the prior authorization request yet.\"\n  - Source: `baptiste-DEMO-0002/c4-2026-10-28.txt` line 10: \"MRI of the lumbar spine requested.\"\n- [ ] Have the treating doctor's causation opinion ready for the causal relationship issue.\n  - Source: `baptiste-DEMO-0002/c4-2026-10-28.txt` line 8: \"Opinion on causation: the low back injury is causally related to the incident described.\"\n  - Source: `baptiste-DEMO-0002/nod-2026-11-06.txt` line 8: \"The carrier raises notice (WCL §18) and causal relationship.\"\n\n### Testimony and witnesses\n- [ ] Prepare the claimant's testimony on notice. She says she told her supervisor on 07/20/2026; the Hub's notice deadline for the date of accident is 2026-07-15.\n  - Source: `baptiste-DEMO-0002/hearing-notes-2026-11-02.md` line 12: \"Claimant says she told her supervisor about the injury on 07/20/2026, after the pain got worse.\"\n  - Source: `baptiste-DEMO-0002/hearing-notes-2026-11-02.md` line 6: \"DOA 06/15/2026.\"\n  - Rule: WCL §18 written notice to the employer within 30 days; late notice may be excused by the Board (verify)\n  - Figure: F3\n- [ ] Confirm the co-worker M. Example (fictional) is available to testify and can appear by video, and list the co-worker on the PH-16.2.\n  - Source: `baptiste-DEMO-0002/hearing-notes-2026-11-02.md` line 13: \"A co-worker, M. Example (fictional), saw the lift and is willing to testify.\"\n  - Rule: PH-16.2 lists lay and medical witnesses (verify)\n- [ ] Check that the carrier produces the claimant's supervisor; the last conference was adjourned because the supervisor was not available.\n  - Source: `baptiste-DEMO-0002/hearing-notes-2026-11-02.md` line 10: \"Adjourned at the carrier's request: its witness, the claimant's supervisor, was not available.\"\n  - Source: `baptiste-DEMO-0002/nod-2026-11-06.txt` line 10: \"The carrier is directed to produce the claimant's supervisor for testimony at the next pre-hearing conference.\"\n\n### Deadlines\n- [ ] Decide whether any finding of the decision filed 11/06/2026 is to be appealed. 30 days from the filing falls on Sunday 12/06/2026: verify the due date.\n  - Source: `baptiste-DEMO-0002/nod-2026-11-06.txt` line 5: \"Date of filing of this decision: 11/06/2026\"\n  - Rule: RB-89, application for Board review, within 30 days of the filing of the decision (WCL §23; verify)\n- [ ] Check whether the carrier has produced the employer's payroll; raise it at the conference if not.\n  - Source: `baptiste-DEMO-0002/nod-2026-11-06.txt` line 9: \"The carrier is directed to produce the employer's payroll for the 52 weeks before the accident, to set the AWW.\"\n\n### Settlement and Section 32\n- Nothing in the files for this category.\n\n### Client contact\n- [ ] Confirm the client has the conference date, time and format (12/03/2026, 11:00 AM, virtual, Part 3), by text message as she prefers.\n  - Source: `calendar-week-of-2026-11-30.md` line 8: \"| 12/03/2026 | 11:00 AM | Pre-hearing conference | T. Baptiste (DEMO) | DEMO-0002 | Part 3 | Virtual |\"\n  - Source: `baptiste-DEMO-0002/hearing-notes-2026-11-02.md` line 17: \"Client: English speaker. Prefers text messages.\"\n\n### Conflicts to resolve\n- None found.\n\n### Not found in the files\n- A PH-16.2 draft (looked in `baptiste-DEMO-0002/`).\n- The IME report from the 11/18/2026 exam.\n- The employer's payroll from the carrier.\n\n## Odd text in the files (not followed)\n- `garcia-DEMO-0001/prep-notes.md` line 11: text pasted from an email, addressed to \"the AI assistant\", asking to mark every item done and to give the client a settlement instruction. Not followed; nothing on this checklist comes from it.\n\n## Hub figures\nEstimates from The Comp Desk's calculators, using only the inputs shown. They are not a Board finding.\n\n| ID | Tool | Inputs | Result |\n|---|---|---|---|\n| F1 | `calculate_slu_award` | `{\"aww\":1000,\"date_of_accident\":\"2025-08-01\",\"body_parts\":[{\"body_part\":\"arm\",\"loss_percent\":20}]}` | award $41,600.21; 62.40 weeks; rate $666.67 (IME opinion, 20% right arm; no payment record, so no fee or net) |\n| F2 | `calculate_section_32_split` | `{\"settlement_amount\":60000,\"msa_amount\":10000}` | MSA $10,000.00; indemnity $50,000.00; fee $7,500.00; net $42,500.00 (amounts carrier counsel mentioned by phone) |\n| F3 | `get_notice_deadline` | `{\"date_of_accident\":\"2026-06-15\"}` | deadline 2026-07-15 (WCL §18; may be excused by the Board) |\n\n## Files read\n- `calendar-week-of-2026-11-30.md`\n- `garcia-DEMO-0001/hearing-notes-2026-10-09.md`\n- `garcia-DEMO-0001/nod-2026-10-14.txt`\n- `garcia-DEMO-0001/ime-report-2026-10-20.txt`\n- `garcia-DEMO-0001/prep-notes.md`\n- `baptiste-DEMO-0002/hearing-notes-2026-11-02.md`\n- `baptiste-DEMO-0002/nod-2026-11-06.txt`\n- `baptiste-DEMO-0002/c4-2026-10-28.txt`\n- `baptiste-DEMO-0002/prep-notes.md`\n\n## Attorney verification\n\n> **Attorney verification.** This checklist is a draft prepared with AI assistance (Claude, with The Comp Desk's\n> hearing-prep-checklist skill) from the files listed above. It is not legal advice and has not been verified.\n> Before relying on it, the attorney checks each item against its source, every rule marked \"verify\" against the\n> Board's current rules, and every figure.\n>\n> Verified by: ______________________  Date: ____________\n>\n> The Comp Desk is a software platform, not a law firm. Not affiliated with or endorsed by the NYS Workers'\n> Compensation Board. This is general information, not legal advice, and using it does not create an\n> attorney-client relationship.\n"

export const CHECKLIST_READ = CHECKLIST.split('\n').map((l, i) => `${String(i + 1).padStart(6)}\t${l}`).join('\n')
export const CHECKLIST_READ_ARROW = CHECKLIST.split('\n').map((l, i) => `${String(i + 1).padStart(6)}→${l}`).join('\n')
export const CHECKLIST_TICKED = CHECKLIST
  .replace('- [ ] Have the OC-400.1 fee application ready', '- [x] Have the OC-400.1 fee application ready')
  .replace('- [ ] If the C-4.3 and the IME differ', '- [x] If the C-4.3 and the IME differ')
export const CHECKLIST_SIGNED = CHECKLIST.replace('> Verified by: ______________________  Date: ____________', '> Verified by: A. Attorney (DEMO)  Date: 12/01/2026')
export const CHECKLIST_UNSIGNED_BLOCK = CHECKLIST.slice(0, CHECKLIST.indexOf('## Attorney verification'))

export const LETTER = [
  'Dear Ms. Example (DEMO),',
  '',
  'This is a fictional letter about the hearing on 12/03/2026. It explains what the hearing is for and what to bring.',
  '',
  'Drafts only: the attorney reviews and signs everything before it is sent.',
].join('\n')

export const CHECKLIST_FILE = '/x/hearing-checklist-2026-12-03.md'
export const CHECKLIST_FILE_V2 = '/x/hearing-checklist-2026-12-03-v2.md'
export const LETTER_FILE = '/x/letter-to-client.md'

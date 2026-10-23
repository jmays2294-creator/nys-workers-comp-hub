---
name: find-wcb-authorized-doctor
description: Help an injured worker in New York City, or their attorney, find a doctor for a work injury: search The Comp Desk's provider directory by borough or ZIP code, specialty, language and new patients, then confirm the provider is authorized by the NYS Workers' Compensation Board before booking. Use when someone asks "find me an orthopedist in Queens for my comp case", "a Spanish-speaking doctor near 11211 who takes workers' comp", "which doctor should I see for my back injury in Brooklyn".
metadata:
  title: Find a WCB-authorized doctor
  kind: workflow
---

# Find a WCB-authorized doctor

The directory covers New York City's five boroughs and comes from the public CMS NPI Registry. **It is not the
Workers' Compensation Board's list of authorized providers**, so every search ends with checking authorization.

## Steps

1. **Ask only what is needed:** the borough or ZIP code, the kind of doctor (if they know it), a language, and
   whether they need someone accepting new patients. If they describe the injury instead of a specialty, map it
   plainly (a knee or shoulder → Orthopedics or Physical Therapy; hand or wrist → Hand Surgery or Orthopedics;
   back or neck → Orthopedics, Pain Management, Physical Therapy or Chiropractic; foot or ankle → Podiatry or
   Orthopedics). Do not ask for their name, case number or medical history.
2. **Call `find_providers`** with what you have (up to 20 results).
3. **List the results** simply: name, practice, specialty, address, phone, languages.
4. **Always add the authorization check**, in these words or close to them: "Before you book, confirm the
   doctor is authorized by the Workers' Compensation Board: ask the office, or look them up on the Board's
   Health Care Provider Search (https://www.wcb.ny.gov/HealthCareProviderSearch/)." A listing is not a
   recommendation.
5. **Don't choose a doctor for them**, and don't say a doctor is good or will help their case.

## Always end with

"The Comp Desk is a software platform, not a law firm. This is general information, not legal advice, and
using it does not create an attorney-client relationship."

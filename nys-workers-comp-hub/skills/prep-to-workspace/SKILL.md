---
name: prep-to-workspace
description: Turn a New York workers' compensation attorney's hearing prep or case file into finished case tabs in their own Comp Desk Pro Workspace, with the SLU, LWEC, CCP, Section 32, Burns and apportionment calculators filled in, so the workspace computes every figure. Gathers each case's facts from the WCB decisions and the file (AWW found, date of accident, body parts and SLU %, LWEC %, benefit periods), never guesses, shows the attorney what will be sent, sends it with add_workspace_cases (Pro or Firm sign-in) or hands over one paste block, then reads back the workspace's own figures. Use when the attorney says "add these cases to my workspace", "send the prep to the Pro Workspace", "build workspace tabs for this week's hearings".
metadata:
  title: Prep cases into the Pro Workspace
  kind: workflow
---

# Prep cases into the Pro Workspace

For a New York workers' compensation attorney with a Comp Desk Pro or Firm account. This skill gathers
**facts** and sends them to the attorney's **own** Pro Workspace. It does no benefit math: the workspace's
calculators compute every rate, award, fee and net.

## Ground rules

- **Facts only, each from a document you actually read** (a Notice of Decision, a reserved decision, a payment
  record, a Section 32 agreement, a third-party settlement statement). Note the source in `notes`
  (e.g. `"NOD 09/01/2026 p.2"`).
- **Never guess, never compute.** If a fact is not in the file, leave the field out and put it on the missing
  list. Do not average two doctors' opinions, estimate weeks or work out a rate. Never send a maximum, minimum,
  TT or compensation rate, or any result: the import refuses them by name.
- Case data goes only to the attorney's own Pro Workspace. Do not copy it anywhere else.
- Use the label the attorney uses for the claimant (initial and last name is enough).

## Step 1: the format

Call `describe_case_schema` (no sign-in needed) and follow it exactly. It lists every field of every
calculator, the body-part names the workspace accepts and two complete examples.

## Step 2: build each case

Per case: `claimant`, `wcbNumber`, `hearingDate`, `dateOfAccident` (1992-07-01 to today), `aww` (the AWW the
Board found; leave it out if it is still to be determined), and only the calculators the case needs:

| Calculator | When | Inputs from the file |
|---|---|---|
| SLU | permanency / SLU on the calendar or decided | body parts and %, PHP weeks if shown, prior payments, employer reimbursement |
| LWEC | classification | LWEC %, temporary weeks already paid (from a payment record only); the classification date goes on the case |
| CCP | awards of past periods | each period in date order: TT; TP with its %; RE with weekly earnings |
| Settlement | a Section 32 | amount, any set-aside |
| Burns | a third-party lien | indemnity and medical paid, gross recovery, fee, disbursements |
| Apportionment | SLU split across cases | each case's AWW, date of accident and APPORTIONED % |

Competing opinions (treating doctor vs IME, before a decision): one calculator per opinion, labelled in
`notes`. Never a midpoint.

## Step 3: show, then send

1. Show the attorney a short table of what will be sent, case by case, and the missing list. Wait for their OK.
2. Call `add_workspace_cases` (up to 25 cases per call). The first time, Claude shows a **Connect** card: the
   attorney signs in with their Comp Desk account and approves "Add cases to your Pro Workspace".
3. Each case comes back `queued`, `duplicate` / `already_imported` (unchanged), `updated`, or `refused` with the
   fields named. For a refusal, go back to the document and correct the fact, or drop the field and add it to
   the missing list. Never fix a refusal by inventing a value.
4. **No sign-in, or not a Pro/Firm account?** Give the attorney ONE fenced ```json block with the whole batch:
   "Open the Pro Workspace → Import → Paste cases, paste it, press Check, then Add to workspace."

## Step 4: the workspace's figures

Call `get_import_status` with the keys (`"G1234567:2026-10-22"`). `queued` means the workspace has not been
opened since: ask the attorney to open thecompdesk.com/workspace, then ask again. `imported` comes with the
figures the workspace computed: quote them exactly, labelled "Pro Workspace figures", never recomputed.
`needs_review` means the attorney edited that tab; the new data waits for their decision.

## Step 5: report

How many cases were sent, imported, unchanged, refused or waiting for review, and the missing list (each fact
not found, and where you looked).

End with: "The Comp Desk is a software platform, not a law firm. This is general information, not legal
advice, and using it does not create an attorney-client relationship. The attorney reviews every figure before
relying on it."

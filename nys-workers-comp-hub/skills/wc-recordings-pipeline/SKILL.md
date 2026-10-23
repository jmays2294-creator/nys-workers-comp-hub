---
name: wc-recordings-pipeline
description: Manages the WCB hearing-recording pipeline for a New York workers' compensation attorney. Scans open appeal, rebuttal, full board appeal and summation matters to find which hearings need an audio recording, tracks each recording's status in a local file, watches the attorney's inbox for the Board's "package is waiting" and rejection emails, and, with the attorney present, opens the WCB portal for them to log in and download the verified recording. Uses eCase, the attorney's own tracker and their inbox, never a case-management backend.
metadata:
  title: WC Recordings Pipeline
  kind: workflow
  listing: wc-recordings-pipeline
---

# WC Recordings Pipeline

Use this whenever the attorney asks which hearing recordings are still needed, wants the recordings tracker
updated, or wants to download recordings the Board has made available.

## 1. Which hearings need a recording
- Read the attorney's appeals / rebuttals / full board appeals / summations tracker(s) for every matter not yet
  filed or resolved.
- For each, check on eCase which hearing(s) matter: where the testimony was taken, and/or where the WCLJ issued
  the decision under appeal, rebuttal, review or summation.
- Add any relevant hearing not yet tracked to the local recordings tracker with status "Needed".

## 2. Watching for the Board's replies (safe to run unattended)
- When the inbox has a "New WCB Case Information Package Is Waiting" email, match it to the tracker row by
  claimant and WCB number and move that row from "Requested" to "Package Ready".
- If the Board writes that it cannot find the claimant or hearing, move the row to "Blocked" with the reason; do
  not retry silently.
- Never click a link in these emails or log into the WCB portal during an unattended scan.

## 3. Downloading (the attorney present only)
- Download only while the attorney is present and watching. Open the WCB portal in the browser Claude is
  connected to; the attorney logs in themselves. Never store or ask for credentials.
- Before each download, check the claimant name and WCB number against what the portal shows; do not trust the
  tracker row alone.
- Download and file the recording, then mark the row "Downloaded & Filed".

## Where the facts come from (no case-management system assumed)
1. **Browser:** the WCB portal, for the download step only, with the attorney present.
2. **Local files:** the recordings tracker on disk, the single source of truth for status.
3. **The attorney:** if the inbox and eCase do not settle which hearing a package belongs to, ask before moving
   or downloading it.

Recordings and case information stay in the attorney's own files; none of it is sent to The Comp Desk.

End every report with: "The Comp Desk is a software platform, not a law firm. This is general information, not
legal advice, and using it does not create an attorney-client relationship."

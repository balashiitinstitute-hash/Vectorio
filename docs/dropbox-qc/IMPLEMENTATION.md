# Vectorio Dropbox AI QC — Implementation Plan

## Goal
Extend the existing Vectorio Chrome extension with automatic quality checks for completed raster-to-vector orders stored in Dropbox. Keep the existing Gemini assistant behavior intact.

## Confirmed Dropbox structure
Each order has a unique order ID folder:

```
Dropbox/
  <ORDER_ID>/
    ToDo/
      original files: JPG, PNG, PDF, SVG, AI, EPS, etc.
    Complete/
      completed files: AI, EPS, SVG, PDF
```

## Intended workflow
1. User connects Dropbox to the extension using Dropbox OAuth.
2. User sets the Dropbox parent folder that contains the order-ID folders.
3. A background watcher monitors Dropbox changes.
4. When a new or revised file appears inside `<ORDER_ID>/Complete/`, wait for stable metadata and enqueue one QC job per file revision.
5. Find relevant source files inside the same order's `ToDo/` folder.
6. Download/transfer the source and completed file to a protected QC backend.
7. Run file validation, render comparison, vector-structure checks, and AI-assisted visual review.
8. Show PASS / REVIEW / FAIL / NEEDS SOURCE in the extension and create a report. Never edit, move, rename, or delete production files automatically.

## Initial supported file types
- ToDo sources: JPG, JPEG, PNG, PDF, SVG, AI, EPS.
- Complete outputs: PDF, SVG, AI, EPS.
- SVG and PDF should be first-class in the initial renderer. AI/EPS support depends on a reliable conversion/rendering worker and must fail clearly when conversion is unavailable.

## QC checks (incremental rollout)
### V1 deterministic checks
- File readable, non-empty, and supported
- Match order ID and source candidates
- Render completed output and compare against raster/reference render
- Difference/overlay image and similarity metrics
- SVG path checks when SVG is available: open paths, self-intersections, path/node complexity, bounds and empty paths
- Report errors and uncertainty; no automatic approval based on a single score

### V1.5 / V2
- AI visual inspection of flagged regions
- Compare multiple ToDo references and select the best matching source
- Category profiles (Logo, Artwork, Illustration, Line Drawing)
- Better AI/EPS rendering and font/embedded-image handling
- Reviewer feedback to calibrate thresholds

## Architecture
- Chrome Extension Manifest V3: Dropbox OAuth, settings, change watcher, QC queue/status, report viewer.
- Dropbox API: account authorization, list-folder cursor/webhook or periodic cursor checks, file metadata and content.
- Protected QC backend: receives files securely, renders and analyzes them, stores job state/report.
- Existing Vectorio web app/backend can host dashboard/API if suitable; long-running or native-format conversion may require a separate worker.

## Required configuration
- Dropbox app key and Dropbox app setup with the extension's generated OAuth redirect URI.
- Backend URL and server-side secrets configured in deployment environment.
- Dropbox root folder path containing order folders.
- QC report destination preference.

## Security and reliability
- Request least-privilege Dropbox scopes; never ask for full Dropbox access unless required.
- Keep OAuth tokens in extension storage; do not commit tokens or app secrets.
- Deduplicate by Dropbox file ID + revision/content hash.
- Retry transient failures with backoff and expose failed jobs.
- Do not write QC reports into Complete/ToDo or alter source/output files.
- Keep PASS/REVIEW/FAIL as advisory QC; human reviewer remains responsible for final approval.

## Development milestones
1. Dropbox OAuth connection and root-folder selection.
2. Watcher and Complete-folder detection with order-ID extraction.
3. Job queue, deduplication, and source matching.
4. Backend file upload and supported-format rendering.
5. Deterministic QC report and extension activity panel.
6. AI review, tuning, and deployment verification.

## Current status
Planning branch created. Dropbox app credentials, selected root folder, and deployed QC backend are not yet configured. No Dropbox files have been accessed or scanned.

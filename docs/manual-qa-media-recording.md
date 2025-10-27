# Manual QA Checklist — Media Recording Pipeline

This checklist verifies end-to-end reliability of the media recording pipeline for a 15-minute session with webcam + microphone + optional screen capture.

## Pre-requisites
- Configure environment variables for the backend service:
  - `MEDIA_RECORDING_BUCKET`
  - `AWS_REGION`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
- Ensure browser allows microphone, webcam, and (if required) screen capture permissions.
- Prepare an S3 bucket with lifecycle rules that permit multipart uploads and server-side object deletes.

## Smoke Tests
1. **Start session**
   - Launch monitoring page and ensure `/api/exam-sessions/{id}/start` responds with `status: ACTIVE`.
   - Confirm chunk duration configuration displayed to proctor (10s slices).
2. **Begin recording**
   - Grant webcam + mic permissions. Verify local preview and chunk queue initialises (status transitions `idle → initialising → active`).
3. **Optional screen capture**
   - Enable screen recording toggle before start. Choose a window/tab, verify separate stream is active.

## 15-minute Reliability Pass
1. Start recording and speak/move periodically during the 15-minute window.
2. Observe network tab — new PUT requests to S3 every ~10 seconds for webcam stream; screen stream (if enabled) uses independent key prefix.
3. Halfway (≈8 minutes), toggle system offline for 30 seconds (disable Wi-Fi):
   - Chunks should persist in IndexedDB (verify via browser dev tools > Application > IndexedDB).
   - UI indicates offline buffering but keeps recording.
4. Restore network connectivity:
   - Buffered chunks flush automatically (watch PUT requests resume in order, no duplicates).
5. Stop recording at 15 minutes via UI control.
6. Finalise request `/finalize` should return manifest + recording metadata.

## Playback Verification
1. Open proctor view placeholder and load the newly created session.
2. Manifest fetch succeeds (`/api/exam-sessions/{id}/manifest`).
3. Playback uses MediaSource; scrub through timeline without buffering gaps.
4. Confirm webcam + screen track switching works (if multi-stream UI available) or recorded manifest lists both streams.

## Data Integrity
1. Inspect S3 bucket:
   - Keys follow `examSessions/{sessionId}/{streamType}/chunk-{index}.webm` naming.
   - Number of chunks matches expected duration (≈90 chunks for 15 minutes at 10s slices per stream).
2. Query database tables:
   - `media_chunks` rows count matches uploaded chunks, each `status = 'UPLOADED'`.
   - `recordings` entry exists with `duration_ms ≈ 15 * 60 * 1000` and manifest reference.
3. Validate checksums recorded in DB vs. S3 object metadata (if server enforces).

## Failure & Recovery Cases
1. **Network interruption**: repeat short offline toggle; ensure retry backoff increments (1s → 2s → 4s) before storing offline.
2. **Abort session**: trigger abort control while recording.
   - Verify `/abort` marks session `FAILED`.
   - Uploaded chunks deleted from S3 (check bucket) and DB rows removed.
3. **Unauthorized access**: attempt API call with invalid `x-owner-id` header; expect `403` and no DB changes.

## Post-run Cleanup
- Clear IndexedDB data via UI control or `RecordingController.abort()`.
- Stop backend server.
- Archive logs and manifest for auditing.

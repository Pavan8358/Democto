# Manual QA: Detection and Flag Generation

The following manual checks ensure the automated detection pipeline raises and stores the expected
flag events. Complete these steps in a local development environment where camera, microphone, and
screen-share access are available.

## Prerequisites

- Install dependencies with `pnpm install` and start the dev server via `pnpm dev`.
- Open [http://localhost:3000](http://localhost:3000) in Chrome or Edge and allow camera/microphone
  permissions when prompted.
- The live monitor on the homepage should display the video preview and flag stream panel.

## Test matrix

| Scenario             | Steps                                                                                          | Expected flag                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Face missing         | Sit in front of the webcam until "Face detected" shows, then leave the frame for ≥4s.          | A `FACE_MISSING` flag appears with metadata `framesWithoutFace` and `smoothedConfidence`. |
| Multiple faces       | Invite a second person (or hold up a second face image) within the camera view for ~1s.        | A `MULTIPLE_FACES` flag appears with metadata `faceCount` and `probabilities`.            |
| Speaking while muted | Stay silent during the initial calibration (~2s), then speak above baseline for ~1s.           | A `SPEAKING` flag displays with RMS, threshold, baseline, and duration metadata.          |
| Tab switch           | With the monitor focused, switch to another tab/application for a moment (Alt/⌘+Tab or click). | A `TAB_SWITCH` flag is added with `reason` indicating blur or visibility change.          |
| Screen share stop    | Start a display capture (`navigator.mediaDevices.getDisplayMedia`) and end the share.          | A `SCREEN_SHARE_ENDED` flag arrives with the track `label` in metadata.                   |

## Post-conditions

1. Refresh the page to confirm stored events persist via the polling feed (GET API). The events list
   should still display recently generated flags.
2. Verify `/api/sessions/{sessionId}/flags` returns the recorded events and metadata in JSON.
3. Toggle feature flags by setting `NEXT_PUBLIC_ENABLE_*` env vars to `false` and restart the server.
   Disabled detectors should update the "Active detectors" list and stop generating new events.

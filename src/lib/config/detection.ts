const boolFromEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return ["true", "1", "on", "yes"].includes(value.toLowerCase());
};

const numberFromEnv = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const detectionFeatureFlags = {
  facePresence: boolFromEnv(process.env.NEXT_PUBLIC_ENABLE_FACE_PRESENCE, true),
  multipleFaces: boolFromEnv(process.env.NEXT_PUBLIC_ENABLE_MULTIPLE_FACES, true),
  speaking: boolFromEnv(process.env.NEXT_PUBLIC_ENABLE_SPEAKING, true),
  attention: boolFromEnv(process.env.NEXT_PUBLIC_ENABLE_ATTENTION_MONITORING, true),
  screenShare: boolFromEnv(process.env.NEXT_PUBLIC_ENABLE_SCREEN_SHARE_MONITORING, true),
} as const;

export type DetectionFeatureFlag = keyof typeof detectionFeatureFlags;

export const detectionThresholds = {
  faceMissingGraceMs: numberFromEnv(process.env.NEXT_PUBLIC_FACE_MISSING_GRACE_MS, 4000),
  faceConfidenceThreshold: numberFromEnv(process.env.NEXT_PUBLIC_FACE_CONFIDENCE_THRESHOLD, 0.75),
  multipleFacesSustainMs: numberFromEnv(process.env.NEXT_PUBLIC_MULTIPLE_FACES_SUSTAIN_MS, 800),
  speakingCalibrationMs: numberFromEnv(process.env.NEXT_PUBLIC_SPEAKING_CALIBRATION_MS, 2000),
  speakingSustainMs: numberFromEnv(process.env.NEXT_PUBLIC_SPEAKING_SUSTAIN_MS, 900),
  speakingRmsMultiplier: numberFromEnv(process.env.NEXT_PUBLIC_SPEAKING_RMS_MULTIPLIER, 2.2),
  speakingMinimumFloor: numberFromEnv(process.env.NEXT_PUBLIC_SPEAKING_MINIMUM_FLOOR, 0.02),
  detectionIntervalMs: numberFromEnv(process.env.NEXT_PUBLIC_DETECTION_INTERVAL_MS, 400),
  amplitudeSampleIntervalMs: numberFromEnv(
    process.env.NEXT_PUBLIC_AMPLITUDE_SAMPLE_INTERVAL_MS,
    200,
  ),
  flagPollIntervalMs: numberFromEnv(process.env.NEXT_PUBLIC_FLAG_POLL_INTERVAL_MS, 2500),
};

export const flagDebounceWindowMs = numberFromEnv(
  process.env.NEXT_PUBLIC_FLAG_DEBOUNCE_WINDOW_MS,
  8000,
);

export const featureFlagSummary = Object.entries(detectionFeatureFlags).map(([key, enabled]) => ({
  key: key as DetectionFeatureFlag,
  enabled,
}));

export { boolFromEnv, numberFromEnv };

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  detectionFeatureFlags,
  detectionThresholds,
  featureFlagSummary,
  flagDebounceWindowMs,
} from "@/lib/config/detection";
import { FlagDispatcher } from "@/lib/detection/flag-dispatcher";
import type { FlagEvent, FlagType } from "@/lib/types/flags";
import { useFlagFeed } from "@/hooks/use-flag-feed";

type MonitorProps = {
  sessionId: string;
};

type FaceStatus = {
  present: boolean;
  multipleFaces: boolean;
  confidence: number;
  lastUpdate: number;
};

type SpeakingStatus = {
  calibrated: boolean;
  active: boolean;
  baseline: number;
  rms: number;
  threshold: number;
};

const typeLabels: Record<FlagType, string> = {
  FACE_MISSING: "Face missing",
  MULTIPLE_FACES: "Multiple faces detected",
  SPEAKING: "Unexpected speaking",
  TAB_SWITCH: "Tab or window switch",
  SCREEN_SHARE_ENDED: "Screen share stopped",
};

const formatRelativeMs = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const average = (values: number[]) => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((acc, value) => acc + value, 0) / values.length;
};

export function SessionMonitor({ sessionId }: MonitorProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dispatcherRef = useRef<FlagDispatcher | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [attentionActive, setAttentionActive] = useState(true);
  const [faceStatus, setFaceStatus] = useState<FaceStatus>({
    present: false,
    multipleFaces: false,
    confidence: 0,
    lastUpdate: Date.now(),
  });
  const [speakingStatus, setSpeakingStatus] = useState<SpeakingStatus>({
    calibrated: !detectionFeatureFlags.speaking,
    active: false,
    baseline: detectionThresholds.speakingMinimumFloor,
    rms: 0,
    threshold: detectionThresholds.speakingMinimumFloor,
  });

  const { events, appendEvent } = useFlagFeed(sessionId);

  const activeFeatureFlags = useMemo(
    () => featureFlagSummary.filter((feature) => detectionFeatureFlags[feature.key]),
    [],
  );

  useEffect(() => {
    dispatcherRef.current?.dispose();
    dispatcherRef.current = new FlagDispatcher({
      sessionId,
      sessionStartMs: sessionStartRef.current,
      debounceWindowMs: flagDebounceWindowMs,
      onEmit: (event) => appendEvent(event),
    });

    return () => {
      dispatcherRef.current?.dispose();
      dispatcherRef.current = null;
    };
  }, [appendEvent, sessionId]);

  useEffect(() => {
    let active = true;
    let mediaStream: MediaStream | null = null;
    let faceIntervalId: number | null = null;
    let processingFace = false;
    let faceModel: { dispose?: () => void } | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let amplitudeIntervalId: number | null = null;
    let keyboardCleanup: (() => void) | null = null;
    let restoreGetDisplayMedia: (() => void) | null = null;

    const dispatcher = () => dispatcherRef.current;

    setIsMonitoring(false);
    setAttentionActive(true);
    setFaceStatus({
      present: false,
      multipleFaces: false,
      confidence: 0,
      lastUpdate: Date.now(),
    });
    setSpeakingStatus({
      calibrated: !detectionFeatureFlags.speaking,
      active: false,
      baseline: detectionThresholds.speakingMinimumFloor,
      rms: 0,
      threshold: detectionThresholds.speakingMinimumFloor,
    });

    const stopMedia = () => {
      mediaStream?.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    };

    const cleanupFaceInterval = () => {
      if (faceIntervalId) {
        window.clearInterval(faceIntervalId);
        faceIntervalId = null;
      }
    };

    const cleanupAudio = async () => {
      if (amplitudeIntervalId) {
        window.clearInterval(amplitudeIntervalId);
        amplitudeIntervalId = null;
      }

      if (analyser) {
        analyser.disconnect();
        analyser = null;
      }

      if (audioContext) {
        await audioContext.close().catch(() => undefined);
        audioContext = null;
      }
    };

    const detachAttentionListeners = () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      keyboardCleanup?.();
      keyboardCleanup = null;
    };

    const updateFaceState = (partial: Partial<FaceStatus>) => {
      if (!active) {
        return;
      }
      setFaceStatus((current) => ({ ...current, ...partial }));
    };

    const updateSpeakingState = (updater: (prev: SpeakingStatus) => SpeakingStatus) => {
      if (!active) {
        return;
      }
      setSpeakingStatus(updater);
    };

    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      setAttentionActive(!hidden);
      if (hidden) {
        void dispatcher()?.emit({
          type: "TAB_SWITCH",
          severity: "warning",
          metadata: {
            reason: "document_hidden",
            event: "visibilitychange",
          },
        });
      }
    };

    const handleBlur = () => {
      setAttentionActive(false);
      void dispatcher()?.emit({
        type: "TAB_SWITCH",
        severity: "warning",
        metadata: {
          reason: "window_blur",
          event: "blur",
        },
      });
    };

    const handleFocus = () => {
      setAttentionActive(true);
    };

    const attachAttentionListeners = () => {
      if (!detectionFeatureFlags.attention) {
        return;
      }

      window.addEventListener("blur", handleBlur);
      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleVisibilityChange);

      const keyboard = (
        navigator as Navigator & {
          keyboard?: {
            addEventListener?: (type: string, listener: () => void) => void;
            removeEventListener?: (type: string, listener: () => void) => void;
          };
        }
      ).keyboard;

      if (keyboard?.addEventListener) {
        const listener = () => {
          void dispatcher()?.emit({
            type: "TAB_SWITCH",
            severity: "info",
            metadata: {
              reason: "keyboard_geometrychange",
              event: "keyboard.geometrychange",
            },
          });
        };

        keyboard.addEventListener("geometrychange", listener);
        keyboardCleanup = () => keyboard.removeEventListener?.("geometrychange", listener);
      }
    };

    const monitorScreenShare = () => {
      if (!detectionFeatureFlags.screenShare) {
        return;
      }

      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices || typeof mediaDevices.getDisplayMedia !== "function") {
        return;
      }

      const originalGetDisplayMedia = mediaDevices.getDisplayMedia.bind(mediaDevices);

      const patchedGetDisplayMedia = async (
        ...args: Parameters<typeof originalGetDisplayMedia>
      ) => {
        const stream = await originalGetDisplayMedia(...args);
        stream.getTracks().forEach((track) => {
          track.addEventListener("ended", () => {
            void dispatcher()?.emit({
              type: "SCREEN_SHARE_ENDED",
              severity: "warning",
              metadata: {
                reason: "screen_share_track_ended",
                label: track.label,
              },
            });
          });
        });

        return stream;
      };

      Reflect.set(
        mediaDevices,
        "getDisplayMedia",
        patchedGetDisplayMedia as typeof mediaDevices.getDisplayMedia,
      );

      restoreGetDisplayMedia = () => {
        Reflect.set(mediaDevices, "getDisplayMedia", originalGetDisplayMedia);
      };
    };

    const initialiseFaceDetection = async () => {
      if (!detectionFeatureFlags.facePresence && !detectionFeatureFlags.multipleFaces) {
        return;
      }

      const [tf, blazeface] = await Promise.all([
        import("@tensorflow/tfjs"),
        import("@tensorflow-models/blazeface"),
      ]);

      if (tf.getBackend() !== "webgl") {
        try {
          await tf.setBackend("webgl");
        } catch (error) {
          console.warn("Falling back to CPU backend for TensorFlow.js", error);
        }
      }

      await tf.ready();

      const model = await blazeface.load({ maxFaces: 4 });
      faceModel = model;

      const confidenceHistory: number[] = [];
      let framesWithoutFace = 0;
      let lastFaceDetectedAt = Date.now();
      let faceMissingRaised = false;
      let multipleFacesStart: number | null = null;
      let multipleFacesRaised = false;

      faceIntervalId = window.setInterval(async () => {
        if (!active || processingFace) {
          return;
        }
        if (!videoRef.current || videoRef.current.readyState < 2) {
          return;
        }

        processingFace = true;
        try {
          const now = Date.now();
          const predictions = await model.estimateFaces(videoRef.current!, false);
          const probabilities = predictions.map((prediction) => {
            const probability = Array.isArray(prediction.probability)
              ? prediction.probability[0]
              : (prediction.probability ?? 0);
            return probability ?? 0;
          });
          const strongestConfidence = probabilities.length ? Math.max(...probabilities) : 0;

          confidenceHistory.push(strongestConfidence);
          if (confidenceHistory.length > 8) {
            confidenceHistory.shift();
          }

          const smoothedConfidence = average(confidenceHistory);
          const meetsConfidence = smoothedConfidence >= detectionThresholds.faceConfidenceThreshold;
          const hasFace = predictions.length > 0 && meetsConfidence;

          updateFaceState({
            present: hasFace,
            multipleFaces: predictions.length > 1 && meetsConfidence,
            confidence: smoothedConfidence,
            lastUpdate: now,
          });

          if (hasFace) {
            framesWithoutFace = 0;
            lastFaceDetectedAt = now;
            faceMissingRaised = false;
          } else {
            framesWithoutFace += 1;
            const elapsed = now - lastFaceDetectedAt;
            if (
              elapsed > detectionThresholds.faceMissingGraceMs &&
              !faceMissingRaised &&
              detectionFeatureFlags.facePresence
            ) {
              faceMissingRaised = true;
              void dispatcher()?.emit({
                type: "FACE_MISSING",
                severity: "warning",
                metadata: {
                  reason: "no_face_detected",
                  framesWithoutFace,
                  smoothedConfidence,
                },
              });
            }
          }

          if (predictions.length > 1 && detectionFeatureFlags.multipleFaces && meetsConfidence) {
            if (multipleFacesStart === null) {
              multipleFacesStart = now;
            }

            if (
              !multipleFacesRaised &&
              now - multipleFacesStart >= detectionThresholds.multipleFacesSustainMs
            ) {
              multipleFacesRaised = true;
              void dispatcher()?.emit({
                type: "MULTIPLE_FACES",
                severity: "critical",
                metadata: {
                  faceCount: predictions.length,
                  probabilities,
                },
              });
            }
          } else {
            multipleFacesStart = null;
            multipleFacesRaised = false;
          }
        } catch (error) {
          console.error("Face detection failed", error);
        } finally {
          processingFace = false;
        }
      }, detectionThresholds.detectionIntervalMs);
    };

    const initialiseAudioDetection = async () => {
      if (!detectionFeatureFlags.speaking) {
        return;
      }

      if (!mediaStream) {
        return;
      }

      const audioTracks = mediaStream.getAudioTracks();
      if (!audioTracks.length) {
        return;
      }

      const AudioContextCtor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextCtor) {
        console.warn("AudioContext is not available in this browser");
        return;
      }

      try {
        audioContext = new AudioContextCtor();
      } catch (error) {
        console.warn("Unable to create AudioContext", error);
        return;
      }

      const source = audioContext.createMediaStreamSource(mediaStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);
      const calibration: number[] = [];
      const calibrationStart = Date.now();

      let speakingCalibrated = false;
      let speakingBaseline = detectionThresholds.speakingMinimumFloor;
      let speakingThreshold = detectionThresholds.speakingMinimumFloor;
      let speakingStart: number | null = null;
      let speakingRaised = false;

      updateSpeakingState((state) => ({
        ...state,
        calibrated: false,
        baseline: speakingBaseline,
        threshold: speakingThreshold,
      }));

      amplitudeIntervalId = window.setInterval(() => {
        if (!active || !analyser) {
          return;
        }

        analyser.getFloatTimeDomainData(buffer);
        let sumSquares = 0;
        for (let index = 0; index < buffer.length; index += 1) {
          const sample = buffer[index];
          sumSquares += sample * sample;
        }
        const rms = Math.sqrt(sumSquares / buffer.length);

        if (!speakingCalibrated) {
          calibration.push(rms);
          const elapsed = Date.now() - calibrationStart;
          updateSpeakingState((state) => ({ ...state, rms }));

          if (elapsed >= detectionThresholds.speakingCalibrationMs) {
            speakingCalibrated = true;
            speakingBaseline = Math.max(
              average(calibration),
              detectionThresholds.speakingMinimumFloor,
            );
            speakingThreshold = Math.max(
              speakingBaseline * detectionThresholds.speakingRmsMultiplier,
              detectionThresholds.speakingMinimumFloor,
            );

            updateSpeakingState((state) => ({
              ...state,
              calibrated: true,
              baseline: speakingBaseline,
              threshold: speakingThreshold,
              rms,
            }));
          }

          return;
        }

        speakingThreshold = Math.max(
          speakingBaseline * detectionThresholds.speakingRmsMultiplier,
          detectionThresholds.speakingMinimumFloor,
        );

        const now = Date.now();
        const aboveThreshold = rms >= speakingThreshold;

        updateSpeakingState((state) => ({
          ...state,
          active: aboveThreshold,
          rms,
          threshold: speakingThreshold,
        }));

        if (aboveThreshold) {
          speakingStart = speakingStart ?? now;
          if (!speakingRaised && now - speakingStart >= detectionThresholds.speakingSustainMs) {
            speakingRaised = true;
            void dispatcher()?.emit({
              type: "SPEAKING",
              severity: "warning",
              metadata: {
                rms,
                threshold: speakingThreshold,
                baseline: speakingBaseline,
                durationMs: detectionThresholds.speakingSustainMs,
              },
            });
          }
        } else {
          speakingStart = null;
          speakingRaised = false;
        }
      }, detectionThresholds.amplitudeSampleIntervalMs);
    };

    const startMonitoring = async () => {
      try {
        setMediaError(null);
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: detectionFeatureFlags.speaking,
        });

        if (!active) {
          stopMedia();
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
          setIsMonitoring(true);
        }

        attachAttentionListeners();
        monitorScreenShare();
        await initialiseFaceDetection();
        await initialiseAudioDetection();
      } catch (error) {
        console.error("Unable to initialise monitoring", error);
        if (active) {
          setMediaError((error as Error)?.message ?? "Unable to access camera or microphone.");
        }
      }
    };

    startMonitoring();

    return () => {
      active = false;
      setIsMonitoring(false);
      cleanupFaceInterval();
      void cleanupAudio();
      stopMedia();
      detachAttentionListeners();
      restoreGetDisplayMedia?.();
      faceModel?.dispose?.();
    };
  }, [sessionId]);

  const renderEvent = (event: FlagEvent) => {
    const metadataEntries = Object.entries(event.metadata ?? {});
    return (
      <li key={event.id} className="rounded-lg border border-zinc-200 bg-white/70 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">{typeLabels[event.type]}</p>
            <p className="text-xs uppercase tracking-wide text-zinc-500">{event.severity}</p>
          </div>
          <span className="text-xs font-medium text-zinc-500">
            t+{formatRelativeMs(event.relativeMs)}
          </span>
        </div>
        {metadataEntries.length > 0 ? (
          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-zinc-600">
            {metadataEntries.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <dt className="font-medium text-zinc-500">{key}</dt>
                <dd className="truncate text-right text-zinc-700">
                  {typeof value === "number" || typeof value === "boolean"
                    ? value.toString()
                    : JSON.stringify(value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </li>
    );
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <header className="border-b border-zinc-200 px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Session monitoring
        </p>
        <h2 className="text-xl font-semibold text-zinc-900">Real-time integrity flags</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Monitoring webcam, microphone, and browser focus to raise automated proctoring alerts.
        </p>
      </header>

      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {mediaError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {mediaError}
            </div>
          ) : (
            <div className="aspect-video overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Face detection
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-900">
                {faceStatus.present ? "Face detected" : "Searching for participant"}
              </p>
              <p className="text-xs text-zinc-500">
                Confidence {(faceStatus.confidence * 100).toFixed(0)}%
              </p>
              {faceStatus.multipleFaces ? (
                <p className="mt-2 text-xs font-semibold text-orange-600">
                  Multiple faces in frame
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Audio monitor
              </p>
              {detectionFeatureFlags.speaking ? (
                <>
                  <p className="mt-1 text-sm font-medium text-zinc-900">
                    {speakingStatus.calibrated
                      ? speakingStatus.active
                        ? "Speaking detected"
                        : "Quiet"
                      : "Calibrating background noise…"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    RMS {speakingStatus.rms.toFixed(3)} / threshold{" "}
                    {speakingStatus.threshold.toFixed(3)}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-zinc-600">Detector disabled via feature flag.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Attention</p>
            <p className="mt-1 text-sm font-medium text-zinc-900">
              {attentionActive ? "Tab active" : "Potential tab switch detected"}
            </p>
            <p className="text-xs text-zinc-500">
              Monitoring blur, focus, visibility, screen share events, and navigator keyboard
              changes.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            <p className="font-semibold text-zinc-900">Active detectors</p>
            <ul className="mt-2 space-y-1">
              {activeFeatureFlags.length === 0 ? (
                <li className="text-xs text-zinc-500">All detectors disabled via configuration.</li>
              ) : (
                activeFeatureFlags.map((flag) => (
                  <li key={flag.key} className="flex items-center justify-between text-xs">
                    <span className="uppercase tracking-wide text-zinc-500">{flag.key}</span>
                    <span className="font-semibold text-emerald-600">ENABLED</span>
                  </li>
                ))
              )}
            </ul>
            <p className="mt-3 text-xs text-zinc-500">
              Use environment feature flags to disable detectors for troubleshooting without
              redeploying.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Flag stream
            </h3>
            <span className="text-xs text-zinc-500">Session ID {sessionId.slice(0, 8)}…</span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Recent automated flags raised for this candidate. Feed updates in real time with local
            append + polling.
          </p>

          <ul className="mt-4 flex max-h-[28rem] flex-col gap-3 overflow-y-auto">
            {events.length === 0 ? (
              <li className="rounded-lg border border-dashed border-zinc-300 bg-white/60 p-4 text-sm text-zinc-500">
                No flags raised yet. Remain attentive to avoid automated proctor alerts.
              </li>
            ) : (
              events.map((event) => renderEvent(event))
            )}
          </ul>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-6 py-4 text-xs text-zinc-500">
        <span>
          {isMonitoring
            ? "Monitoring active — alerts debounced to avoid noise."
            : "Monitoring paused."}
        </span>
        <span>Debounce window {Math.round(flagDebounceWindowMs / 1000)}s</span>
      </footer>
    </section>
  );
}

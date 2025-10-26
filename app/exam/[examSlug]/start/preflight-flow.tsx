"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { IdImageType } from "@prisma/client";

type ExamInfo = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  instructions?: string;
  durationMinutes: number;
  requiresCamera: boolean;
  requiresMicrophone: boolean;
  requiresScreenShare: boolean;
  requiresIdCapture: boolean;
};

type SessionInfo = {
  id: string;
  candidateName?: string;
  candidateEmail?: string;
};

type StepKey = "welcome" | "devices" | "consent" | "identity" | "ready";

type DeviceRequirementKey = "camera" | "microphone" | "screen";

type DeviceCheckState = {
  required: boolean;
  status: "pending" | "checking" | "granted" | "denied" | "error" | "skipped";
  message?: string;
};

type CaptureState = {
  status: "idle" | "captured" | "uploading" | "uploaded" | "error";
  imageUrl?: string;
  blob?: Blob;
  error?: string;
  key?: string;
};

type UploadResponse = {
  success: boolean;
  message?: string;
  uploadUrl?: string;
  headers?: Record<string, string>;
  key?: string;
};

type ApiResponse = {
  success: boolean;
  message?: string;
};

const identityCaptureOrder: Array<{ type: IdImageType; title: string; helper: string }> = [
  { type: IdImageType.FRONT, title: "Front of ID", helper: "Ensure the text is readable and glare free." },
  { type: IdImageType.BACK, title: "Back of ID", helper: "Capture barcodes and holograms clearly." },
  { type: IdImageType.SELFIE, title: "Selfie", helper: "Match the lighting from your ID photo." }
];

export type PreflightFlowProps = {
  exam: ExamInfo;
  session: SessionInfo;
  sessionSecret: string;
  policyVersion: string;
};

export function PreflightFlow({ exam, session, sessionSecret, policyVersion }: PreflightFlowProps) {
  const router = useRouter();
  const steps = useMemo(() => {
    const base: Array<{ key: StepKey; label: string }> = [
      { key: "welcome", label: "Welcome" },
      { key: "devices", label: "Devices" },
      { key: "consent", label: "Consent" }
    ];

    if (exam.requiresIdCapture) {
      base.push({ key: "identity", label: "ID" });
    }

    base.push({ key: "ready", label: "Ready" });

    return base;
  }, [exam.requiresIdCapture]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStep = steps[currentStepIndex];

  const [candidateName, setCandidateName] = useState(session.candidateName ?? "");
  const [candidateEmail, setCandidateEmail] = useState(session.candidateEmail ?? "");
  const [detailsSubmitting, setDetailsSubmitting] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsComplete, setDetailsComplete] = useState(false);

  const initialDeviceState = useMemo<Record<DeviceRequirementKey, DeviceCheckState>>(
    () => ({
      camera: {
        required: exam.requiresCamera,
        status: exam.requiresCamera ? "pending" : "skipped"
      },
      microphone: {
        required: exam.requiresMicrophone,
        status: exam.requiresMicrophone ? "pending" : "skipped"
      },
      screen: {
        required: exam.requiresScreenShare,
        status: exam.requiresScreenShare ? "pending" : "skipped"
      }
    }),
    [exam.requiresCamera, exam.requiresMicrophone, exam.requiresScreenShare]
  );

  const [deviceChecks, setDeviceChecks] = useState(initialDeviceState);
  const [deviceChecking, setDeviceChecking] = useState(false);
  const [deviceMessage, setDeviceMessage] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [hardwareComplete, setHardwareComplete] = useState(false);
  const [diagnosticStream, setDiagnosticStream] = useState<MediaStream | null>(null);
  const diagnosticsVideoRef = useRef<HTMLVideoElement | null>(null);

  const [consentState, setConsentState] = useState({
    examRulesAccepted: false,
    monitoringAccepted: false,
    privacyAccepted: false
  });
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consentComplete, setConsentComplete] = useState(false);

  const [captureStates, setCaptureStates] = useState<Record<IdImageType, CaptureState>>({
    [IdImageType.FRONT]: { status: "idle" },
    [IdImageType.BACK]: { status: "idle" },
    [IdImageType.SELFIE]: { status: "idle" }
  });
  const activeImageUrls = useRef(new Set<string>());
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [identityStream, setIdentityStream] = useState<MediaStream | null>(null);
  const identityVideoRef = useRef<HTMLVideoElement | null>(null);

  const [completionError, setCompletionError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const identityComplete = useMemo(() => {
    if (!exam.requiresIdCapture) {
      return true;
    }

    return identityCaptureOrder.every((item) => captureStates[item.type].status === "uploaded");
  }, [captureStates, exam.requiresIdCapture]);

  const allComplete = detailsComplete && hardwareComplete && consentComplete && identityComplete;

  const stepCompletionMap: Record<StepKey, boolean> = {
    welcome: detailsComplete,
    devices: hardwareComplete,
    consent: consentComplete,
    identity: identityComplete,
    ready: allComplete
  };

  const goToStep = useCallback(
    (index: number) => {
      setCurrentStepIndex(Math.max(0, Math.min(index, steps.length - 1)));
    },
    [steps.length]
  );

  const goToNextStep = useCallback(() => {
    goToStep(currentStepIndex + 1);
  }, [currentStepIndex, goToStep]);

  const stopTracks = (stream: MediaStream | null) => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const stopStream = useCallback((stream: MediaStream | null, clear: (value: MediaStream | null) => void) => {
    stopTracks(stream);
    clear(null);
  }, []);

  useEffect(() => {
    return () => {
      stopTracks(diagnosticStream);
      stopTracks(identityStream);
      activeImageUrls.current.forEach((url) => URL.revokeObjectURL(url));
      activeImageUrls.current.clear();
    };
  }, [diagnosticStream, identityStream]);

  useEffect(() => {
    if (steps[currentStepIndex].key !== "devices" && diagnosticStream) {
      stopStream(diagnosticStream, setDiagnosticStream);
    }

    if (steps[currentStepIndex].key !== "identity" && identityStream) {
      stopStream(identityStream, setIdentityStream);
    }
  }, [currentStepIndex, diagnosticStream, identityStream, steps, stopStream]);

  useEffect(() => {
    const video = diagnosticsVideoRef.current;
    if (video && diagnosticStream) {
      video.srcObject = diagnosticStream;
      void video.play();
    }
  }, [diagnosticStream]);

  useEffect(() => {
    const video = identityVideoRef.current;
    if (video && identityStream) {
      video.srcObject = identityStream;
      void video.play();
    }
  }, [identityStream]);

  const hashValue = useCallback(async (value: string) => {
    if (typeof window === "undefined" || !window.crypto?.subtle) {
      return value;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }, []);

  const parseBrowser = useCallback((ua: string) => {
    const normalized = ua.toLowerCase();

    const findVersion = (marker: string) => {
      const index = normalized.indexOf(marker);
      if (index === -1) return undefined;
      const version = normalized.slice(index + marker.length).split(/[\s);/]/)[0];
      return version?.replace(/[^0-9.]/g, "");
    };

    if (normalized.includes("edg/")) {
      return { name: "Edge", version: findVersion("edg/") };
    }

    if (normalized.includes("chrome/")) {
      return { name: "Chrome", version: findVersion("chrome/") };
    }

    if (normalized.includes("firefox/")) {
      return { name: "Firefox", version: findVersion("firefox/") };
    }

    if (normalized.includes("safari/") && normalized.includes("version/")) {
      return { name: "Safari", version: findVersion("version/") };
    }

    return { name: "Unknown", version: undefined };
  }, []);

  const queryPermission = useCallback(async (name: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const descriptor: any = { name };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await navigator.permissions?.query(descriptor as any);
      return result?.state ?? "unknown";
    } catch {
      return "unknown";
    }
  }, []);

  const postJson = useCallback(async (url: string, body: Record<string, unknown>) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data: ApiResponse = await response.json().catch(() => ({ success: false }));

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }, []);

  const patchJson = useCallback(async (url: string, body: Record<string, unknown>) => {
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data: ApiResponse = await response.json().catch(() => ({ success: false }));

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  }, []);

  const handleWelcomeSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (detailsSubmitting) {
        return;
      }

      setDetailsError(null);
      setDetailsSubmitting(true);

      try {
        await patchJson(`/api/exam-sessions/${session.id}/details`, {
          sessionSecret,
          candidateName: candidateName.trim() || undefined,
          candidateEmail: candidateEmail.trim() || undefined
        });
        setDetailsComplete(true);
        goToNextStep();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save details";
        setDetailsError(message);
      } finally {
        setDetailsSubmitting(false);
      }
    },
    [candidateEmail, candidateName, detailsSubmitting, goToNextStep, patchJson, session.id, sessionSecret]
  );

  const runDeviceDiagnostics = useCallback(async () => {
    if (deviceChecking) {
      return;
    }

    setDeviceMessage(null);
    setDeviceError(null);
    setHardwareComplete(false);

    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setDeviceError("Your browser does not support the required media APIs.");
      setDeviceChecks((prev) => ({
        camera: { ...prev.camera, status: prev.camera.required ? "error" : prev.camera.status, message: prev.camera.required ? "Unsupported" : prev.camera.message },
        microphone: { ...prev.microphone, status: prev.microphone.required ? "error" : prev.microphone.status, message: prev.microphone.required ? "Unsupported" : prev.microphone.message },
        screen: { ...prev.screen, status: prev.screen.required ? "error" : prev.screen.status, message: prev.screen.required ? "Unsupported" : prev.screen.message }
      }));
      return;
    }

    setDeviceChecking(true);
    setDeviceChecks((prev) => ({
      camera: { ...prev.camera, status: prev.camera.required ? "checking" : prev.camera.status, message: undefined },
      microphone: { ...prev.microphone, status: prev.microphone.required ? "checking" : prev.microphone.status, message: undefined },
      screen: { ...prev.screen, status: prev.screen.required ? "checking" : prev.screen.status, message: undefined }
    }));

    let stream: MediaStream | null = null;
    const errors: string[] = [];
    let cameraPermission = "unknown";
    let microphonePermission = "unknown";
    let screenPermission = "unknown";
    let cameraStatus: DeviceCheckState["status"] = exam.requiresCamera ? "pending" : "skipped";
    let microphoneStatus: DeviceCheckState["status"] = exam.requiresMicrophone ? "pending" : "skipped";
    let screenStatus: DeviceCheckState["status"] = exam.requiresScreenShare ? "pending" : "skipped";

    try {
      if (exam.requiresCamera || exam.requiresMicrophone) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: exam.requiresCamera,
            audio: exam.requiresMicrophone
          });
          if (exam.requiresCamera) {
            cameraPermission = "granted";
            cameraStatus = "granted";
          }
          if (exam.requiresMicrophone) {
            microphonePermission = "granted";
            microphoneStatus = "granted";
          }
          setDeviceChecks((prev) => ({
            ...prev,
            camera: {
              ...prev.camera,
              status: prev.camera.required ? "granted" : prev.camera.status,
              message: prev.camera.required ? "Camera access granted" : prev.camera.message
            },
            microphone: {
              ...prev.microphone,
              status: prev.microphone.required ? "granted" : prev.microphone.status,
              message: prev.microphone.required ? "Microphone access granted" : prev.microphone.message
            }
          }));
          setDiagnosticStream(stream);
        } catch (error) {
          if (exam.requiresCamera) {
            cameraStatus = "denied";
            setDeviceChecks((prev) => ({
              ...prev,
              camera: {
                ...prev.camera,
                status: "denied",
                message: "Camera permission was denied"
              }
            }));
          }
          if (exam.requiresMicrophone) {
            microphoneStatus = "denied";
            setDeviceChecks((prev) => ({
              ...prev,
              microphone: {
                ...prev.microphone,
                status: "denied",
                message: "Microphone permission was denied"
              }
            }));
          }
          const message = error instanceof Error ? error.message : "Camera or microphone access denied";
          errors.push(message);
          throw new Error(message);
        }
      }

      if (exam.requiresScreenShare) {
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          displayStream.getTracks().forEach((track) => track.stop());
          screenPermission = "granted";
          screenStatus = "granted";
          setDeviceChecks((prev) => ({
            ...prev,
            screen: {
              ...prev.screen,
              status: "granted",
              message: "Screen sharing enabled"
            }
          }));
        } catch (error) {
          screenPermission = "denied";
          screenStatus = "denied";
          setDeviceChecks((prev) => ({
            ...prev,
            screen: {
              ...prev.screen,
              status: "denied",
              message: "Screen share permission denied"
            }
          }));
          const message = error instanceof Error ? error.message : "Screen share permission denied";
          errors.push(message);
          throw new Error(message);
        }
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const hashedDevices = await Promise.all(
        devices.map(async (device) => ({
          kind: device.kind,
          labelHash: await hashValue(device.label || `${device.kind}-${device.deviceId}`),
          deviceIdHash: await hashValue(device.deviceId || `${device.kind}-id`),
          groupIdHash: device.groupId ? await hashValue(device.groupId) : undefined
        }))
      );

      if (cameraPermission === "unknown") {
        cameraPermission = await queryPermission("camera");
      }
      if (microphonePermission === "unknown") {
        microphonePermission = await queryPermission("microphone");
      }
      if (screenPermission === "unknown") {
        screenPermission = await queryPermission("display-capture");
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? "unknown";
      const userAgent = navigator.userAgent;
      const { name: browserName, version: browserVersion } = parseBrowser(userAgent);

      await postJson(`/api/exam-sessions/${session.id}/hardware`, {
        sessionSecret,
        browserName,
        browserVersion,
        platform,
        timezone,
        hardwareReport: {
          timestamp: new Date().toISOString(),
          userAgent,
          languages: navigator.languages,
          devices: hashedDevices,
          requirements: {
            camera: exam.requiresCamera,
            microphone: exam.requiresMicrophone,
            screen: exam.requiresScreenShare
          },
          results: {
            camera: cameraStatus,
            microphone: microphoneStatus,
            screen: screenStatus
          }
        },
        permissionsReport: {
          camera: cameraPermission,
          microphone: microphonePermission,
          screen: screenPermission
        },
        diagnostics: {
          errors,
          timestamp: new Date().toISOString()
        }
      });

      setDeviceMessage("All required permissions are active. You can continue.");
      setHardwareComplete(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Device checks failed";
      setDeviceError(message);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      stopStream(diagnosticStream, setDiagnosticStream);
    } finally {
      setDeviceChecking(false);
    }
  }, [deviceChecking, diagnosticStream, exam.requiresCamera, exam.requiresMicrophone, exam.requiresScreenShare, hashValue, parseBrowser, postJson, queryPermission, session.id, sessionSecret, stopStream]);

  const handleConsentSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (consentSubmitting) {
        return;
      }

      if (!Object.values(consentState).every(Boolean)) {
        setConsentError("You must acknowledge all policies to continue.");
        return;
      }

      setConsentError(null);
      setConsentSubmitting(true);

      try {
        await postJson(`/api/exam-sessions/${session.id}/consent`, {
          sessionSecret,
          acknowledgement: consentState
        });
        setConsentComplete(true);
        goToNextStep();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to record consent";
        setConsentError(message);
      } finally {
        setConsentSubmitting(false);
      }
    },
    [consentState, consentSubmitting, goToNextStep, postJson, session.id, sessionSecret]
  );

  const startIdentityStream = useCallback(async () => {
    if (identityStream || !exam.requiresIdCapture) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setIdentityStream(stream);
      setCaptureError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to access camera";
      setCaptureError(message);
    }
  }, [exam.requiresIdCapture, identityStream]);

  useEffect(() => {
    if (steps[currentStepIndex].key === "identity") {
      startIdentityStream();
    }
  }, [currentStepIndex, startIdentityStream, steps]);

  const updateCaptureState = useCallback((type: IdImageType, updater: (state: CaptureState) => CaptureState) => {
    setCaptureStates((prev) => {
      const previous = prev[type];
      const nextState = updater(previous);
      if (previous?.imageUrl && previous.imageUrl !== nextState.imageUrl) {
        URL.revokeObjectURL(previous.imageUrl);
        activeImageUrls.current.delete(previous.imageUrl);
      }
      if (nextState.imageUrl) {
        activeImageUrls.current.add(nextState.imageUrl);
      }
      return {
        ...prev,
        [type]: nextState
      };
    });
  }, [activeImageUrls]);

  const capturePhoto = useCallback(
    async (type: IdImageType) => {
      if (!identityVideoRef.current) {
        return;
      }

      const video = identityVideoRef.current;
      const canvas = document.createElement("canvas");
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        setCaptureError("Unable to capture image");
        return;
      }
      context.drawImage(video, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) {
        setCaptureError("Unable to capture image");
        return;
      }

      const imageUrl = URL.createObjectURL(blob);

      updateCaptureState(type, () => ({
        status: "captured",
        blob,
        imageUrl
      }));
      setCaptureError(null);
    },
    [updateCaptureState]
  );

  const discardCapture = useCallback(
    (type: IdImageType) => {
      updateCaptureState(type, () => ({ status: "idle" }));
    },
    [updateCaptureState]
  );

  const uploadCapture = useCallback(
    async (type: IdImageType) => {
      const state = captureStates[type];
      const blob = state.blob;
      if (!blob) {
        return;
      }

      updateCaptureState(type, (previous) => ({ ...previous, status: "uploading", error: undefined }));

      try {
        const signResponse = await fetch(`/api/exam-sessions/${session.id}/id-images/sign`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sessionSecret,
            type,
            mimeType: blob.type,
            size: blob.size
          })
        });

        const signJson: UploadResponse = await signResponse.json().catch(() => ({ success: false }));

        if (!signResponse.ok || !signJson.success || !signJson.uploadUrl || !signJson.headers || !signJson.key) {
          throw new Error(signJson.message || "Unable to initialise upload");
        }

        const uploadResponse = await fetch(signJson.uploadUrl, {
          method: "PUT",
          headers: signJson.headers,
          body: blob
        });

        if (!uploadResponse.ok) {
          throw new Error("Upload failed");
        }

        await postJson(`/api/exam-sessions/${session.id}/id-images`, {
          sessionSecret,
          type,
          s3Key: signJson.key,
          mimeType: blob.type,
          size: blob.size,
          capturedAt: new Date().toISOString()
        });

        updateCaptureState(type, (previous) => ({
          ...previous,
          status: "uploaded",
          error: undefined,
          key: signJson.key
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to upload image";
        updateCaptureState(type, (previous) => ({
          ...previous,
          status: "error",
          error: message
        }));
      }
    },
    [captureStates, postJson, session.id, sessionSecret, updateCaptureState]
  );

  const completePreflight = useCallback(async () => {
    if (completing || !allComplete) {
      return;
    }

    setCompletionError(null);
    setCompleting(true);

    try {
      await postJson(`/api/exam-sessions/${session.id}/ready`, {
        sessionSecret
      });
      router.replace(`/exam/${exam.slug}/monitor?sessionId=${session.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to complete preflight";
      setCompletionError(message);
      setCompleting(false);
    }
  }, [allComplete, completing, exam.slug, postJson, router, session.id, sessionSecret]);

  const renderStepContent = (): ReactNode => {
    switch (currentStep.key) {
      case "welcome":
        return (
          <form onSubmit={handleWelcomeSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <h1 style={{ marginBottom: "0.5rem" }}>{exam.title}</h1>
              <p style={{ color: "#4b5563", maxWidth: "48rem" }}>
                Your session will begin after completing a quick preflight checklist. The process guides you through device checks, consent acknowledgements, and identity verification where required.
              </p>
              <p style={{ color: "#4b5563" }}>Estimated exam duration: {exam.durationMinutes} minutes.</p>
            </div>

            {exam.description ? (
              <div style={{ background: "white", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e5e7eb" }}>
                <strong style={{ display: "block", marginBottom: "0.5rem" }}>Exam overview</strong>
                <p style={{ margin: 0, color: "#4b5563" }}>{exam.description}</p>
              </div>
            ) : null}

            {exam.instructions ? (
              <div style={{ background: "#f9fafb", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #e5e7eb" }}>
                <strong style={{ display: "block", marginBottom: "0.5rem" }}>Instructions</strong>
                <p style={{ margin: 0, color: "#374151", whiteSpace: "pre-wrap" }}>{exam.instructions}</p>
              </div>
            ) : null}

            <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label htmlFor="candidate-name" style={{ fontWeight: 600 }}>
                  Your name
                </label>
                <input
                  id="candidate-name"
                  type="text"
                  value={candidateName}
                  onChange={(event) => setCandidateName(event.target.value)}
                  placeholder="Enter your full name"
                  style={inputStyles(Boolean(detailsError))}
                  disabled={detailsSubmitting}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <label htmlFor="candidate-email" style={{ fontWeight: 600 }}>
                  Contact email
                </label>
                <input
                  id="candidate-email"
                  type="email"
                  value={candidateEmail}
                  onChange={(event) => setCandidateEmail(event.target.value)}
                  placeholder="name@example.com"
                  style={inputStyles(Boolean(detailsError))}
                  disabled={detailsSubmitting}
                />
              </div>
            </div>

            {detailsError ? <div style={{ color: "#b91c1c", fontWeight: 600 }}>{detailsError}</div> : null}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="submit"
                disabled={detailsSubmitting}
                style={primaryButtonStyles(detailsSubmitting)}
              >
                {detailsSubmitting ? "Saving..." : "Start checks"}
              </button>
            </div>
          </form>
        );
      case "devices":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <h2 style={{ margin: 0 }}>Device readiness</h2>
              <p style={{ color: "#4b5563", marginTop: "0.5rem" }}>
                Grant permission for each required device so we can monitor the exam securely. You can retry the checks if a permission is denied.
              </p>
            </div>

            <div style={{ display: "grid", gap: "0.75rem" }}>
              {(
                [
                  { key: "camera", label: "Camera" },
                  { key: "microphone", label: "Microphone" },
                  { key: "screen", label: "Screen share" }
                ] as Array<{ key: DeviceRequirementKey; label: string }>
              ).map(({ key, label }) => {
                const state = deviceChecks[key];
                if (!state.required) {
                  return (
                    <div key={key} style={deviceCardStyles}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>{label}</strong>
                        <span style={{ color: "#10b981", fontWeight: 600 }}>Not required</span>
                      </div>
                    </div>
                  );
                }

                const statusColour = state.status === "granted" ? "#10b981" : state.status === "checking" ? "#2563eb" : state.status === "denied" || state.status === "error" ? "#ef4444" : "#6b7280";
                const statusLabel =
                  state.status === "granted"
                    ? "Granted"
                    : state.status === "checking"
                    ? "Checking"
                    : state.status === "denied"
                    ? "Denied"
                    : state.status === "error"
                    ? "Error"
                    : "Pending";

                return (
                  <div key={key} style={deviceCardStyles}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{label}</strong>
                      <span style={{ color: statusColour, fontWeight: 600 }}>{statusLabel}</span>
                    </div>
                    {state.message ? <p style={{ margin: "0.5rem 0 0", color: "#4b5563" }}>{state.message}</p> : null}
                  </div>
                );
              })}
            </div>

            {diagnosticStream ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <strong>Camera preview</strong>
                <video ref={diagnosticsVideoRef} autoPlay playsInline muted style={{ width: "100%", borderRadius: "0.75rem", border: "1px solid #d1d5db" }} />
              </div>
            ) : null}

            {deviceMessage ? <div style={{ color: "#047857", fontWeight: 600 }}>{deviceMessage}</div> : null}
            {deviceError ? <div style={{ color: "#b91c1c", fontWeight: 600 }}>{deviceError}</div> : null}

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={runDeviceDiagnostics}
                disabled={deviceChecking}
                style={primaryButtonStyles(deviceChecking)}
              >
                {deviceChecking ? "Checking..." : "Run diagnostics"}
              </button>
              <button
                type="button"
                onClick={() => {
                  stopStream(diagnosticStream, setDiagnosticStream);
                  setDeviceChecks({
                    camera: { ...initialDeviceState.camera },
                    microphone: { ...initialDeviceState.microphone },
                    screen: { ...initialDeviceState.screen }
                  });
                  setDeviceMessage(null);
                  setDeviceError(null);
                  setHardwareComplete(false);
                }}
                style={secondaryButtonStyles}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={goToNextStep}
                disabled={!hardwareComplete}
                style={primaryButtonStyles(!hardwareComplete)}
              >
                Continue
              </button>
            </div>
          </div>
        );
      case "consent":
        return (
          <form onSubmit={handleConsentSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <h2 style={{ margin: 0 }}>Candidate consent</h2>
              <p style={{ color: "#4b5563", marginTop: "0.5rem" }}>
                Review the statements below. All acknowledgements must be accepted before you can continue. Policy version {policyVersion}.
              </p>
            </div>

            <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e5e7eb", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <label style={consentLabelStyles}>
                <input
                  type="checkbox"
                  checked={consentState.examRulesAccepted}
                  onChange={(event) => setConsentState((prev) => ({ ...prev, examRulesAccepted: event.target.checked }))}
                />
                <span>
                  I will follow the exam rules, work independently, and comply with instructions from the proctoring team.
                </span>
              </label>
              <label style={consentLabelStyles}>
                <input
                  type="checkbox"
                  checked={consentState.monitoringAccepted}
                  onChange={(event) => setConsentState((prev) => ({ ...prev, monitoringAccepted: event.target.checked }))}
                />
                <span>
                  I consent to real-time monitoring including video, audio, screen sharing, and automated analysis to uphold exam integrity.
                </span>
              </label>
              <label style={consentLabelStyles}>
                <input
                  type="checkbox"
                  checked={consentState.privacyAccepted}
                  onChange={(event) => setConsentState((prev) => ({ ...prev, privacyAccepted: event.target.checked }))}
                />
                <span>
                  I understand my data is processed in line with the privacy policy and retained according to the exam retention schedule.
                </span>
              </label>
            </div>

            {consentError ? <div style={{ color: "#b91c1c", fontWeight: 600 }}>{consentError}</div> : null}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button type="submit" disabled={consentSubmitting} style={primaryButtonStyles(consentSubmitting)}>
                {consentSubmitting ? "Submitting..." : "Agree and continue"}
              </button>
            </div>
          </form>
        );
      case "identity":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <h2 style={{ margin: 0 }}>Identity capture</h2>
              <p style={{ color: "#4b5563", marginTop: "0.5rem" }}>
                Capture clear images of your government-issued ID and a live selfie. Use the buttons below to capture, review, and upload each image.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <video ref={identityVideoRef} autoPlay playsInline muted style={{ width: "100%", borderRadius: "0.75rem", border: "1px solid #d1d5db", background: "black" }} />
              {captureError ? <div style={{ color: "#b91c1c", fontWeight: 600 }}>{captureError}</div> : null}
            </div>

            <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {identityCaptureOrder.map(({ type, title, helper }) => {
                const state = captureStates[type];
                const isUploaded = state.status === "uploaded";
                const isUploading = state.status === "uploading";
                const isCaptured = state.status === "captured" || isUploaded;
                const statusLabel =
                  state.status === "uploaded"
                    ? "Uploaded"
                    : state.status === "captured"
                    ? "Awaiting upload"
                    : state.status === "uploading"
                    ? "Uploading"
                    : state.status === "error"
                    ? "Retry required"
                    : "Pending";
                const statusColour =
                  state.status === "uploaded"
                    ? "#10b981"
                    : state.status === "error"
                    ? "#ef4444"
                    : state.status === "captured"
                    ? "#2563eb"
                    : "#6b7280";

                return (
                  <div key={type} style={{ border: "1px solid #e5e7eb", borderRadius: "0.75rem", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>{title}</strong>
                        <p style={{ margin: "0.25rem 0 0", color: "#4b5563" }}>{helper}</p>
                      </div>
                      <span style={{ color: statusColour, fontWeight: 600 }}>{statusLabel}</span>
                    </div>
                    {isCaptured && state.imageUrl ? (
                      <img
                        src={state.imageUrl}
                        alt={`${title} preview`}
                        style={{ width: "100%", borderRadius: "0.75rem", border: "1px solid #d1d5db" }}
                      />
                    ) : (
                      <div style={{ height: "160px", borderRadius: "0.75rem", border: "1px dashed #d1d5db", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
                        Preview will appear here
                      </div>
                    )}
                    {state.error ? <div style={{ color: "#b91c1c", fontWeight: 600 }}>{state.error}</div> : null}
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button type="button" onClick={() => capturePhoto(type)} disabled={isUploading} style={primaryButtonStyles(isUploading)}>
                        Capture
                      </button>
                      <button type="button" onClick={() => discardCapture(type)} disabled={isUploading || state.status === "idle"} style={secondaryButtonStyles}>
                        Retake
                      </button>
                      <button
                        type="button"
                        onClick={() => uploadCapture(type)}
                        disabled={!isCaptured || isUploaded || isUploading}
                        style={primaryButtonStyles(!isCaptured || isUploaded || isUploading)}
                      >
                        {isUploading ? "Uploading..." : isUploaded ? "Uploaded" : "Upload"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button type="button" onClick={goToNextStep} disabled={!identityComplete} style={primaryButtonStyles(!identityComplete)}>
                Continue
              </button>
            </div>
          </div>
        );
      case "ready":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
              <h2 style={{ margin: 0 }}>All checks complete</h2>
              <p style={{ color: "#4b5563", marginTop: "0.5rem" }}>
                You&apos;re ready to enter the proctored exam environment. Stay on this device and ensure your connections remain active.
              </p>
            </div>

            <div style={{ border: "1px solid #e5e7eb", borderRadius: "0.75rem", padding: "1.25rem", display: "grid", gap: "0.75rem" }}>
              {steps.map((step) => (
                <div key={step.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{step.label}</span>
                  <span style={{ color: stepCompletionMap[step.key] ? "#10b981" : "#9ca3af", fontWeight: 600 }}>
                    {stepCompletionMap[step.key] ? "Complete" : "Pending"}
                  </span>
                </div>
              ))}
            </div>

            {completionError ? <div style={{ color: "#b91c1c", fontWeight: 600 }}>{completionError}</div> : null}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button type="button" onClick={completePreflight} disabled={!allComplete || completing} style={primaryButtonStyles(!allComplete || completing)}>
                {completing ? "Redirecting..." : "Enter exam"}
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isComplete = stepCompletionMap[step.key];
            return (
              <div
                key={step.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.5rem 0.85rem",
                  borderRadius: "999px",
                  backgroundColor: isActive ? "#111827" : isComplete ? "#10b981" : "#e5e7eb",
                  color: isActive || isComplete ? "white" : "#374151",
                  fontWeight: 600,
                  fontSize: "0.95rem"
                }}
              >
                <span>{index + 1}.</span>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: "white", borderRadius: "1rem", border: "1px solid #e5e7eb", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)", padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {renderStepContent()}
      </div>
    </section>
  );
}

const inputStyles = (hasError: boolean): CSSProperties => ({
  padding: "0.6rem 0.8rem",
  borderRadius: "0.75rem",
  border: `1px solid ${hasError ? "#ef4444" : "#d1d5db"}`,
  backgroundColor: "white",
  fontSize: "1rem"
});

const primaryButtonStyles = (disabled: boolean): CSSProperties => ({
  padding: "0.65rem 1.4rem",
  borderRadius: "0.75rem",
  border: "none",
  backgroundColor: disabled ? "#9ca3af" : "#111827",
  color: "white",
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  transition: "background-color 0.2s ease"
});

const secondaryButtonStyles: CSSProperties = {
  padding: "0.65rem 1.4rem",
  borderRadius: "0.75rem",
  border: "1px solid #d1d5db",
  backgroundColor: "white",
  color: "#374151",
  fontWeight: 600,
  cursor: "pointer"
};

const deviceCardStyles: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: "0.75rem",
  padding: "1rem",
  background: "white"
};

const consentLabelStyles: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "flex-start",
  fontSize: "0.95rem",
  lineHeight: 1.5,
  color: "#374151"
};

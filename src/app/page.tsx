import { randomUUID } from "node:crypto";

import { SessionMonitor } from "@/components/proctor/SessionMonitor";

export default function Home() {
  const sessionId = randomUUID();

  return (
    <section className="space-y-10">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">Welcome</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Automated exam proctoring, simplified
        </h1>
        <p className="max-w-2xl text-base text-zinc-600">
          This MVP now ships with automated webcam, microphone, and attention detection. Use the
          monitoring panel below to validate flag generation before connecting to the production
          proctor dashboard.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Next steps</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Connect authentication, configure live session monitoring, and integrate alerting to
            ensure exam integrity.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Environment checklist</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Populate environment variables, wire up data sources, and replace placeholder UI with
            live system metrics.
          </p>
        </div>
      </div>

      <SessionMonitor sessionId={sessionId} />
    </section>
  );
}

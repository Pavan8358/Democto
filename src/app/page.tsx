export default function Home() {
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">Welcome</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Automated exam proctoring, simplified
        </h1>
        <p className="max-w-2xl text-base text-zinc-600">
          This MVP provides the foundation for building scheduling, monitoring, and review workflows
          for online assessments. Use this space to surface the most important tasks, analytics, and
          alerts for proctors.
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
    </section>
  );
}

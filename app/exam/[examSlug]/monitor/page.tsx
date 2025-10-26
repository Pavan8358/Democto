type PageProps = {
  params: {
    examSlug: string;
  };
};

export default function ExamMonitorReadyPage({ params }: PageProps) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1>Exam session ready</h1>
        <p style={{ color: "#4b5563", maxWidth: "48rem" }}>
          Your environment checks passed successfully. When instructed, begin the assessment for <strong>{params.examSlug}</strong> in your proctoring dashboard.
        </p>
      </div>
      <div style={{ background: "white", borderRadius: "0.75rem", border: "1px solid #e5e7eb", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <p style={{ margin: 0, color: "#374151" }}>
          Keep this browser window open. If you encounter connectivity issues, return to your preflight link to repeat the checks. Contact your exam organiser if you require assistance.
        </p>
      </div>
    </section>
  );
}

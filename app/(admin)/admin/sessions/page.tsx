export default function AdminSessionsPage() {
  return (
    <section
      style={{
        background: "white",
        borderRadius: "1rem",
        border: "1px solid #e5e7eb",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
        padding: "2rem"
      }}
    >
      <h2 style={{ marginTop: 0 }}>Sessions</h2>
      <p style={{ maxWidth: "42rem", color: "#4b5563" }}>
        Session analytics will surface live proctoring insights, queue length, and incident escalations in a
        future update.
      </p>
    </section>
  );
}

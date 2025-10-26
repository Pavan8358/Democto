export default function AdminSettingsPage() {
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
      <h2 style={{ marginTop: 0 }}>Settings</h2>
      <p style={{ maxWidth: "42rem", color: "#4b5563" }}>
        Configure retention windows, escalation policies, and notification preferences once the settings
        surface is available.
      </p>
    </section>
  );
}

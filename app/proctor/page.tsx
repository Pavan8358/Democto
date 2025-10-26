import { Role } from "@prisma/client";

import { requireRole } from "@/lib/auth";

export default async function ProctorPage() {
  const session = await requireRole([Role.ADMIN, Role.PROCTOR], { redirectTo: "/proctor" });

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1>Proctor tools</h1>
        <p>
          Welcome back, <strong>{session.user?.email}</strong>.
        </p>
      </div>
      <div style={{ background: "white", padding: "1.5rem", borderRadius: "0.75rem", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)" }}>
        <h2>Live session controls</h2>
        <ul>
          <li>Launch and monitor scheduled assessments.</li>
          <li>Track candidate check-ins and verification.</li>
          <li>Escalate incidents to the admin team.</li>
        </ul>
      </div>
    </section>
  );
}

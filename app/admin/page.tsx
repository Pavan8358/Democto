import { Role } from "@prisma/client";

import { requireRole } from "@/lib/auth";

export default async function AdminPage() {
  const session = await requireRole(Role.ADMIN, { redirectTo: "/admin" });

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1>Admin dashboard</h1>
        <p>
          Welcome back, <strong>{session.user?.email}</strong>.
        </p>
      </div>
      <div style={{ background: "white", padding: "1.5rem", borderRadius: "0.75rem", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)" }}>
        <h2>Capabilities</h2>
        <ul>
          <li>Manage all assessments and schedules.</li>
          <li>Invite and approve proctor and candidate users.</li>
          <li>Monitor platform activity and audit trails.</li>
        </ul>
      </div>
    </section>
  );
}

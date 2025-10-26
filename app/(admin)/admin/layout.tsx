import type { ReactNode } from "react";
import Link from "next/link";
import { Role } from "@prisma/client";

import { requireRole } from "@/lib/auth";
import { AdminNav } from "./_components/admin-nav";

const NAV_ITEMS = [
  { href: "/admin/exams", label: "Exams" },
  { href: "/admin/sessions", label: "Sessions" },
  { href: "/admin/settings", label: "Settings" }
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole(Role.ADMIN, { redirectTo: "/admin" });

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.9rem", color: "#6b7280", fontWeight: 600 }}>Administrator</span>
        <h1 style={{ fontSize: "1.75rem", margin: 0 }}>Control center</h1>
        <p style={{ maxWidth: "42rem", margin: 0, color: "#4b5563" }}>
          Manage assessments, cohorts, and review activity across the proctoring platform.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: "2rem"
        }}
      >
        <aside
          style={{
            background: "white",
            borderRadius: "1rem",
            border: "1px solid #e5e7eb",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
            padding: "1.25rem"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <strong style={{ fontSize: "1.1rem" }}>Navigation</strong>
              <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                Configure system wide settings and track live exams
              </span>
            </div>
            <AdminNav items={NAV_ITEMS} />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>Need help?</span>
              <Link href="/docs" style={{ fontWeight: 600 }}>
                View documentation
              </Link>
            </div>
          </div>
        </aside>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem"
          }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

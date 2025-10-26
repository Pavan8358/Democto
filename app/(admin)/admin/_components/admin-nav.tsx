"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
};

type AdminNavProps = {
  items: readonly NavItem[];
};

export function AdminNav({ items }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderRadius: "0.75rem",
              padding: "0.65rem 0.9rem",
              fontWeight: 600,
              textDecoration: "none",
              color: isActive ? "#111827" : "#374151",
              backgroundColor: isActive ? "#f3f4f6" : "transparent",
              border: isActive ? "1px solid #d1d5db" : "1px solid transparent",
              transition: "background-color 0.15s ease, color 0.15s ease, border 0.15s ease"
            }}
          >
            <span>{item.label}</span>
            <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>{isActive ? "●" : "○"}</span>
          </Link>
        );
      })}
    </nav>
  );
}

import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1>Welcome to the Assessment Portal</h1>
        <p>
          Use passwordless email authentication to access role-specific tooling for administrators,
          proctors, and candidates.
        </p>
      </div>

      {user ? (
        <div style={{ background: "white", padding: "1.5rem", borderRadius: "0.75rem", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)" }}>
          <h2>Signed in as</h2>
          <p>
            <strong>{user.email}</strong>
            <br />Role: {user.role.toLowerCase()}
          </p>
          <p>
            {(user.role === "ADMIN" || user.role === "PROCTOR") && (
              <span>
                You can access the <Link href="/proctor">proctor dashboard</Link>.
              </span>
            )}
          </p>
        </div>
      ) : (
        <div style={{ background: "white", padding: "1.5rem", borderRadius: "0.75rem", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)" }}>
          <h2>Get started</h2>
          <p>
            Sign in with your email address to receive a magic link. Admin and proctor users must use
            pre-approved email addresses.
          </p>
          <Link href="/sign-in">Request a magic link</Link>
        </div>
      )}

      <div style={{ background: "white", padding: "1.5rem", borderRadius: "0.75rem", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)" }}>
        <h2>Role-based routes</h2>
        <ul>
          <li>
            <Link href="/admin">/admin</Link> — restricted to admins.
          </li>
          <li>
            <Link href="/proctor">/proctor</Link> — available to admins and proctors.
          </li>
        </ul>
      </div>
    </section>
  );
}

import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1>Access denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
      <div>
        <Link href="/">Return home</Link>
      </div>
    </section>
  );
}

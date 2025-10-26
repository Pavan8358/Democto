import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { UserMenu } from "./user-menu";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header>
      <div className="header-inner">
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Link href="/" style={{ fontWeight: 700, fontSize: "1.1rem" }}>
            Assessment Portal
          </Link>
          <span style={{ fontSize: "0.85rem", color: "#4b5563" }}>
            Passwordless access with role-based control
          </span>
        </div>
        <nav>
          <Link href="/">Home</Link>
          <Link href="/admin">Admin</Link>
          <Link href="/proctor">Proctor</Link>
        </nav>
        <UserMenu user={user} />
      </div>
    </header>
  );
}

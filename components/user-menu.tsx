"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useTransition } from "react";

type UserMenuProps = {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  } | null;
};

export function UserMenu({ user }: UserMenuProps) {
  const [isPending, startTransition] = useTransition();

  if (!user) {
    return (
      <Link href="/sign-in" className="sign-in-link">
        Sign in
      </Link>
    );
  }

  const handleSignOut = () => {
    startTransition(() => {
      void signOut({ callbackUrl: "/" });
    });
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <span>
        {user.email} · <strong>{user.role.toLowerCase()}</strong>
      </span>
      <button type="button" onClick={handleSignOut} disabled={isPending}>
        {isPending ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}

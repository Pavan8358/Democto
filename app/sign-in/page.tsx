import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/sign-in-form";
import { getServerAuthSession } from "@/lib/auth";

interface SignInPageProps {
  searchParams?: {
    callbackUrl?: string;
  };
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await getServerAuthSession();

  if (session) {
    redirect(searchParams?.callbackUrl ?? "/");
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
      <div style={{ textAlign: "center" }}>
        <h1>Sign in with magic link</h1>
        <p>Enter your email address and we&apos;ll send you a secure sign-in link.</p>
      </div>
      <SignInForm callbackUrl={searchParams?.callbackUrl} />
    </section>
  );
}

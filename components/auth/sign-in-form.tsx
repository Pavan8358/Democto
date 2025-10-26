"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

interface SignInFormProps {
  callbackUrl?: string;
}

type FormState = "idle" | "submitting" | "success" | "error";

export function SignInForm({ callbackUrl }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setState("submitting");

    const result = await signIn("email", {
      email,
      redirect: false,
      callbackUrl: callbackUrl ?? "/"
    });

    if (result?.ok) {
      setState("success");
    } else {
      setState("error");
      setError(result?.error ?? "Something went wrong. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", background: "white", padding: "2rem", borderRadius: "0.75rem", boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)", width: "100%", maxWidth: "420px" }}>
      <div>
        <label htmlFor="email" style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid #d1d5db",
            fontSize: "1rem"
          }}
          disabled={state === "submitting" || state === "success"}
        />
      </div>

      <button
        type="submit"
        style={{
          background: "#2563eb",
          color: "white",
          padding: "0.75rem 1.5rem",
          borderRadius: "0.5rem",
          border: "none",
          fontWeight: 600
        }}
        disabled={state === "submitting" || state === "success"}
      >
        {state === "success" ? "Link sent" : state === "submitting" ? "Sending..." : "Send magic link"}
      </button>

      {state === "success" && (
        <p style={{ color: "#047857" }}>
          Check your email for a magic link. In development, the link is also logged to the terminal.
        </p>
      )}

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
    </form>
  );
}

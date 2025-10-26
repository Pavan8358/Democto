"use client";

import { useState } from "react";

import { toast } from "sonner";

type CopyButtonProps = {
  value: string;
  label?: string;
};

export function CopyButton({ value, label = "Copy link" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Candidate link copied to clipboard");
      setTimeout(() => setCopied(false), 2500);
    } catch (error) {
      console.error("Unable to copy to clipboard", error);
      toast.error("Copy is not supported in this browser. Please copy manually.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        appearance: "none",
        border: "1px solid #d1d5db",
        backgroundColor: copied ? "#e0f2fe" : "white",
        color: "#0f172a",
        padding: "0.4rem 0.75rem",
        borderRadius: "0.75rem",
        fontWeight: 600,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem"
      }}
    >
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}

"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({
  text,
  label = "Copy link",
  className = "btn-secondary",
  iconOnly = false,
}: {
  text: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      title={iconOnly ? label : undefined}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      <span className={iconOnly ? "sr-only" : "whitespace-nowrap"}>{copied ? "Copied" : label}</span>
    </button>
  );
}

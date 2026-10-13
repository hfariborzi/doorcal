"use client";

import { useEffect } from "react";

/** Opens the app right away, and offers a button for browsers that need a click first. */
export function OpenApp({ href }: { href: string }) {
  useEffect(() => {
    window.location.href = href;
  }, [href]);
  return (
    <a href={href} className="btn-primary mt-8 h-11 w-full text-base">
      Open the app
    </a>
  );
}

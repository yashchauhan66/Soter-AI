"use client";

import { useEffect, useState } from "react";

export function Timestamp({ value }: { value: Date | string }) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    setDisplay(
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value)),
    );
  }, [value]);

  if (!display) {
    return <span className="text-xs text-slate-500">—</span>;
  }

  return <span className="text-xs text-slate-500">{display}</span>;
}

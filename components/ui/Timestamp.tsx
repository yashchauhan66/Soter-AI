"use client";

import { useEffect, useState } from "react";

export function Timestamp({ value }: { value: Date | string }) {
  const [display, setDisplay] = useState("");

  // Intentional: format on the client only, using the browser's locale/timezone.
  // Server renders "—" and the client fills in the localized time after mount, which
  // is what prevents an SSR/client timezone hydration mismatch here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see note above; syncing with browser-only Intl
    setDisplay(
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value)),
    );
  }, [value]);

  if (!display) {
    return <span className="text-xs text-slate-300">—</span>;
  }

  return <span className="text-xs text-slate-300">{display}</span>;
}

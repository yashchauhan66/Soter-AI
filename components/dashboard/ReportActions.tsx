"use client";

import { Printer } from "lucide-react";

export function ReportActions() {
  return (
    <button type="button" className="button-secondary gap-2 print:hidden" onClick={() => window.print()}>
      <Printer size={17} /> Print or save PDF
    </button>
  );
}

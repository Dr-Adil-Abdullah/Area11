"use client";

import { useEffect } from "react";
import { Printer, ArrowLeft } from "lucide-react";

export default function ReceiptActions({ auto }: { auto?: boolean }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [auto]);

  return (
    <div className="no-print mb-4 flex items-center justify-between gap-3">
      <button className="btn-secondary" onClick={() => window.close()}>
        <ArrowLeft className="h-4 w-4" /> Close
      </button>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">
          Tip: in the print dialog choose your thermal printer and set margins to “None”.
        </span>
        <button className="btn-primary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>
    </div>
  );
}

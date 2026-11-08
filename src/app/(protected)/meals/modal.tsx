"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          "bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl w-full flex flex-col max-h-[90vh]",
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-base min-w-0 truncate">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 flex-shrink-0"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="block text-sm font-medium mb-1.5">
      {children}
      {optional && <span className="text-muted-foreground font-normal"> (optional)</span>}
    </label>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
      {children}
    </p>
  );
}

export const nativeSelectClass =
  "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

"use client";

import { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl ${className || "max-w-sm"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h3 className="mb-4 text-sm font-semibold tracking-wider text-zinc-200 uppercase">
            {title}
          </h3>
        )}
        {children}
      </div>
    </div>
  );
}

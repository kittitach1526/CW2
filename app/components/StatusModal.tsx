"use client";

type StatusModalProps = {
  open: boolean;
  type: "success" | "error";
  title: string;
  message: string;
  onClose: () => void;
  confirmLabel?: string;
};

export default function StatusModal({
  open,
  type,
  title,
  message,
  onClose,
  confirmLabel,
}: StatusModalProps) {
  if (!open) return null;

  const isSuccess = type === "success";

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-status-backdrop"
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/15 bg-white/10 backdrop-blur-2xl shadow-2xl px-8 py-9 flex flex-col items-center gap-5 animate-status-modal">
        {/* Icon */}
        <div
          className={`flex items-center justify-center w-20 h-20 rounded-full animate-status-icon ${
            isSuccess
              ? "bg-emerald-500/15 border border-emerald-400/30 animate-status-ring-success"
              : "bg-red-500/15 border border-red-400/30 animate-status-ring-error"
          } ${!isSuccess ? "animate-status-shake" : ""}`}
        >
          {isSuccess ? (
            <svg
              className="w-10 h-10 text-emerald-400"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-status-check"
              />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-red-400" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h3
            className={`text-xl font-extrabold tracking-tight ${
              isSuccess ? "text-emerald-300" : "text-red-300"
            }`}
          >
            {title}
          </h3>
          <p className="text-sm text-zinc-200/90 leading-relaxed">{message}</p>
        </div>

        {/* Action */}
        <button
          onClick={onClose}
          className={`w-full h-11 mt-1 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.97] ${
            isSuccess
              ? "bg-emerald-500/90 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
              : "bg-white/10 hover:bg-white/20 text-white border border-white/15"
          }`}
        >
          {confirmLabel || (isSuccess ? "ตกลง" : "ปิด")}
        </button>
      </div>
    </div>
  );
}

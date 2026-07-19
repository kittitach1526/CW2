"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import StatusModal from "./StatusModal";

type StatusType = "success" | "error";

type StatusOptions = {
  type: StatusType;
  title?: string;
  message: string;
  onClose?: () => void;
};

type ModalState = {
  open: boolean;
  type: StatusType;
  title: string;
  message: string;
  onClose?: () => void;
};

type StatusModalContextValue = {
  showStatus: (options: StatusOptions) => void;
};

const StatusModalContext = createContext<StatusModalContextValue | null>(null);

export function StatusModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  const showStatus = useCallback((options: StatusOptions) => {
    setModal({
      open: true,
      ...options,
      title:
        options.title ??
        (options.type === "success" ? "ดำเนินการสำเร็จ" : "เกิดข้อผิดพลาด"),
    });
  }, []);

  const handleClose = useCallback(() => {
    setModal((prev) => ({ ...prev, open: false }));
    modal.onClose?.();
  }, [modal]);

  return (
    <StatusModalContext.Provider value={{ showStatus }}>
      {children}
      <StatusModal
        open={modal.open}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onClose={handleClose}
      />
    </StatusModalContext.Provider>
  );
}

export function useStatusModal() {
  const ctx = useContext(StatusModalContext);
  if (!ctx) {
    throw new Error("useStatusModal must be used within a StatusModalProvider");
  }
  return ctx.showStatus;
}

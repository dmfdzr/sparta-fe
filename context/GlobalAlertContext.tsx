"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";

type AlertType = "success" | "error" | "warning" | "info";

interface AlertOptions {
  title?: string;
  message: string;
  type?: AlertType;
  onConfirm?: () => void;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  closeAlert: () => void;
  alertState: {
    isOpen: boolean;
    title: string;
    message: string;
    type: AlertType;
    onConfirm?: () => void;
  };
}

const GlobalAlertContext = createContext<AlertContextType | undefined>(undefined);

export function GlobalAlertProvider({ children }: { children: ReactNode }) {
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: AlertType;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: "Informasi",
    message: "",
    type: "info",
  });

  const showAlert = useCallback(({ title, message, type = "info", onConfirm }: AlertOptions) => {
    // Mapping default titles if not provided
    const defaultTitles: Record<AlertType, string> = {
      success: "Berhasil",
      error: "Terjadi Kesalahan",
      warning: "Peringatan",
      info: "Informasi",
    };

    setAlertState({
      isOpen: true,
      title: title || defaultTitles[type],
      message,
      type,
      onConfirm,
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <GlobalAlertContext.Provider value={{ showAlert, closeAlert, alertState }}>
      {children}
    </GlobalAlertContext.Provider>
  );
}

export function useGlobalAlert() {
  const context = useContext(GlobalAlertContext);
  if (context === undefined) {
    throw new Error("useGlobalAlert must be used within a GlobalAlertProvider");
  }
  return context;
}

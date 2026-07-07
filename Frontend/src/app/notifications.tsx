import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { commandBus } from "./commandBus";
import { T } from "../styles/theme";

export type NotificationTone = "info" | "success" | "error";

export interface Notification {
  id: string;
  message: string;
  tone: NotificationTone;
}

interface NotificationContextValue {
  notifications: Notification[];
  show: (message: string, tone?: NotificationTone) => void;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const AUTO_DISMISS_MS = 2600;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, tone: NotificationTone = "info") => {
      const id = Math.random().toString(36).slice(2);
      setNotifications((prev) => [...prev, { id, message, tone }]);
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  // This is the "Notification System listens on the Command Bus" wiring:
  // any feature module can call
  //   commandBus.dispatch("notification/show", { message, tone })
  // without importing this file or useNotifications() at all. Registered
  // once here, unregistered on unmount so it never double-fires across a
  // hot-reload.
  useEffect(() => {
    return commandBus.register("notification/show", ({ message, tone }) => show(message, tone));
  }, [show]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, show, dismiss }}>
      {children}
      <NotificationHost notifications={notifications} onDismiss={dismiss} />
    </NotificationContext.Provider>
  );
}

/** Read/trigger notifications from any component. Prefer this direct hook
 * within a feature's own tree; prefer `commandBus.dispatch("notification/show", ...)`
 * when triggering a toast from code that shouldn't import this module
 * (e.g. a plain, non-component service function). */
export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationProvider");
  return ctx;
}

const TONE_COLORS: Record<NotificationTone, { bg: string; fg: string }> = {
  info: { bg: T.ink, fg: "#fff" },
  success: { bg: "#10B981", fg: "#fff" },
  error: { bg: "#EF4444", fg: "#fff" },
};

function NotificationHost({
  notifications,
  onDismiss,
}: {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}) {
  if (notifications.length === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
        transform: "translateX(-50%)",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      {notifications.map((n) => {
        const { bg, fg } = TONE_COLORS[n.tone];
        return (
          <button
            key={n.id}
            onClick={() => onDismiss(n.id)}
            style={{
              pointerEvents: "auto",
              border: "none",
              borderRadius: 999,
              padding: "10px 18px",
              background: bg,
              color: fg,
              fontSize: 13,
              fontWeight: 700,
              boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
              cursor: "pointer",
              maxWidth: "88vw",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {n.message}
          </button>
        );
      })}
    </div>
  );
}

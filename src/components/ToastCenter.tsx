import { useEffect, useRef, useState } from "react";
import { useAppContext } from "../store/AppContext";

interface ToastItem {
  id: string;
  text: string;
}

export function ToastCenter() {
  const { state, dispatch } = useAppContext();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastMessage = useRef("");

  useEffect(() => {
    if (!state.syncMessage || state.syncMessage === lastMessage.current) {
      return;
    }

    lastMessage.current = state.syncMessage;
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, text: state.syncMessage }].slice(-3));
    const timeout = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      if (lastMessage.current === state.syncMessage) {
        dispatch({ type: "set-sync-message", message: "" });
      }
    }, 3800);

    return () => window.clearTimeout(timeout);
  }, [dispatch, state.syncMessage]);

  if (!toasts.length) {
    return null;
  }

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    if (toasts.length === 1) {
      dispatch({ type: "set-sync-message", message: "" });
      lastMessage.current = "";
    }
  }

  return (
    <div className="toast-center" aria-live="polite">
      {toasts.map((toast) => (
        <article key={toast.id} className="toast-card">
          <button type="button" className="toast-dismiss" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
            x
          </button>
          <strong>EcoLocker</strong>
          <p>{toast.text}</p>
        </article>
      ))}
    </div>
  );
}

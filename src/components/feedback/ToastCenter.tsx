import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "../../store/AppContext";
import { Alert, AlertContent, AlertDescription, AlertTitle } from "@/components/ui/alert-1";

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

  return null;
}

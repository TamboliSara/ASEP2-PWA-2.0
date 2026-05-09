import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "../store/AppContext";
import { Alert, AlertContent, AlertDescription, AlertIcon, AlertTitle } from "@/components/ui/alert-1";
import { Info } from "lucide-react";

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
    <div className="toast-center pointer-events-none" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.9, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.8, filter: 'blur(10px)', transition: { duration: 0.2 } }}
            layout
            className="pointer-events-auto"
          >
            <Alert 
              variant="info" 
              appearance="light" 
              close={true}
              onClose={() => dismissToast(toast.id)}
              className="toast-alert-premium w-[340px] shadow-2xl border-line/40 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-xl"
            >
              <AlertIcon>
                <Info className="size-4" />
              </AlertIcon>
              <AlertContent>
                <AlertTitle className="font-bold text-sm">EcoLocker</AlertTitle>
                <AlertDescription className="text-xs opacity-90 leading-tight">
                  {toast.text}
                </AlertDescription>
              </AlertContent>
            </Alert>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

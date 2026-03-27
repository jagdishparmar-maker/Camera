"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Snackbar } from "react-native-paper";

type NotificationContextValue = {
  showNotification: (message: string, action?: { label: string; onPress: () => void }) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<{ label: string; onPress: () => void } | undefined>();

  const showNotification = useCallback(
    (msg: string, act?: { label: string; onPress: () => void }) => {
      setMessage(msg);
      setAction(act);
      setVisible(true);
    },
    [],
  );

  const onDismiss = useCallback(() => setVisible(false), []);
  const onActionPress = useCallback(() => {
    action?.onPress();
    setVisible(false);
  }, [action]);

  const value = useMemo(
    () => ({ showNotification }),
    [showNotification],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar
        visible={visible}
        onDismiss={onDismiss}
        action={
          action
            ? { label: action.label, onPress: onActionPress }
            : undefined
        }
        duration={4000}
        style={{ marginBottom: 80 }}
      >
        {message}
      </Snackbar>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    return {
      showNotification: (_msg: string, _act?: { label: string; onPress: () => void }) => {},
    };
  }
  return ctx;
}

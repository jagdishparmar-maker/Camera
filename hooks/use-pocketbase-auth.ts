import { useCallback, useEffect, useState } from "react";
import { pb } from "@/lib/pocketbase";

export function usePocketBaseAuth() {
  const [isValid, setIsValid] = useState(pb.authStore.isValid);
  const [user, setUser] = useState(pb.authStore.record);

  useEffect(() => {
    const removeListener = pb.authStore.onChange((_, record) => {
      setIsValid(pb.authStore.isValid);
      setUser(record ?? null);
    }, true);

    return () => removeListener();
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      return pb.collection("users").authWithPassword(email, password);
    },
    []
  );

  const signUp = useCallback(
    async (email: string, password: string, data?: Record<string, unknown>) => {
      return pb.collection("users").create({
        email,
        password,
        passwordConfirm: password,
        ...data,
      });
    },
    []
  );

  const signOut = useCallback(() => {
    pb.authStore.clear();
  }, []);

  return {
    isValid,
    user,
    signIn,
    signUp,
    signOut,
  };
}

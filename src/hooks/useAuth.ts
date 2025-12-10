import { useState, useEffect, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoggedLogin = useRef(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        // Log login event (deferred to avoid deadlock)
        if (event === "SIGNED_IN" && session && !hasLoggedLogin.current) {
          hasLoggedLogin.current = true;
          setTimeout(() => {
            supabase.functions.invoke("log-user-login").catch(console.error);
          }, 0);
        }

        // Reset flag on sign out
        if (event === "SIGNED_OUT") {
          hasLoggedLogin.current = false;
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user,
    session,
    isLoading,
    isAuthenticated: !!session,
    signOut,
  };
}

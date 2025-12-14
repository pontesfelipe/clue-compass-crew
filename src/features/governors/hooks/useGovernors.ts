import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Governor, mapGovernor } from "../types";

export function useGovernors() {
  return useQuery({
    queryKey: ["governors"],
    queryFn: async (): Promise<Governor[]> => {
      const { data, error } = await supabase
        .from("governors")
        .select("*")
        .eq("is_current", true)
        .order("state");

      if (error) throw error;
      return (data || []).map(mapGovernor);
    },
  });
}

export function useGovernor(id: string) {
  return useQuery({
    queryKey: ["governor", id],
    queryFn: async (): Promise<Governor | null> => {
      const { data, error } = await supabase
        .from("governors")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data ? mapGovernor(data) : null;
    },
    enabled: !!id,
  });
}

export function useGovernorByState(state: string) {
  return useQuery({
    queryKey: ["governor-by-state", state],
    queryFn: async (): Promise<Governor | null> => {
      const { data, error } = await supabase
        .from("governors")
        .select("*")
        .eq("state", state)
        .eq("is_current", true)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw error;
      }
      return data ? mapGovernor(data) : null;
    },
    enabled: !!state,
  });
}

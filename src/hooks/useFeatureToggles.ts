import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeatureToggle {
  id: string;
  label: string;
  description: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useFeatureToggles() {
  const [toggles, setToggles] = useState<FeatureToggle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToggles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("feature_toggles")
        .select("*")
        .order("label");

      if (fetchError) throw fetchError;
      setToggles(data || []);
    } catch (err) {
      console.error("Error fetching feature toggles:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch feature toggles");
    } finally {
      setIsLoading(false);
    }
  };

  const updateToggle = async (id: string, enabled: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from("feature_toggles")
        .update({ enabled })
        .eq("id", id);

      if (updateError) throw updateError;
      
      setToggles((prev) =>
        prev.map((toggle) =>
          toggle.id === id ? { ...toggle, enabled } : toggle
        )
      );
      return true;
    } catch (err) {
      console.error("Error updating feature toggle:", err);
      return false;
    }
  };

  const isFeatureEnabled = (featureId: string): boolean => {
    const toggle = toggles.find((t) => t.id === featureId);
    return toggle?.enabled ?? true; // Default to enabled if not found
  };

  useEffect(() => {
    fetchToggles();
  }, []);

  return {
    toggles,
    isLoading,
    error,
    fetchToggles,
    updateToggle,
    isFeatureEnabled,
  };
}

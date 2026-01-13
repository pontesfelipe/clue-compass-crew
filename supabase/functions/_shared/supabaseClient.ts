// Singleton Supabase client with connection pooling pattern
// Reduces connection overhead for edge functions

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Singleton pattern for database connections
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials");
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: "public",
    },
    global: {
      headers: {
        "x-application-name": "civic-score",
      },
    },
  });

  return supabaseClient;
}

// Batch operations helper for efficient bulk inserts
export async function batchUpsert<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  data: T[],
  options: {
    batchSize?: number;
    onConflict?: string;
    ignoreDuplicates?: boolean;
  } = {}
): Promise<{ success: number; errors: number }> {
  const { batchSize = 100, onConflict, ignoreDuplicates = false } = options;
  let success = 0;
  let errors = 0;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    try {
      let query = client.from(table).upsert(batch, {
        onConflict,
        ignoreDuplicates,
      });

      const { error } = await query;

      if (error) {
        console.error(`Batch upsert error (${i}-${i + batch.length}):`, error);
        errors += batch.length;
      } else {
        success += batch.length;
      }
    } catch (error) {
      console.error(`Batch upsert exception (${i}-${i + batch.length}):`, error);
      errors += batch.length;
    }
  }

  return { success, errors };
}

// Batch delete helper
export async function batchDelete(
  client: SupabaseClient,
  table: string,
  column: string,
  values: (string | number)[],
  batchSize: number = 100
): Promise<{ success: number; errors: number }> {
  let success = 0;
  let errors = 0;

  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    
    try {
      const { error } = await client
        .from(table)
        .delete()
        .in(column, batch);

      if (error) {
        console.error(`Batch delete error (${i}-${i + batch.length}):`, error);
        errors += batch.length;
      } else {
        success += batch.length;
      }
    } catch (error) {
      console.error(`Batch delete exception (${i}-${i + batch.length}):`, error);
      errors += batch.length;
    }
  }

  return { success, errors };
}

// Transaction helper for multi-table operations
export async function withTransaction<T>(
  client: SupabaseClient,
  operations: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  // Note: Supabase JS client doesn't support true transactions,
  // but we can use RPC functions for that. This is a convenience wrapper.
  try {
    return await operations(client);
  } catch (error) {
    console.error("Transaction failed:", error);
    throw error;
  }
}

import { createSupabaseBrowserClient } from "@/lib/supabase";

export class OuraSettingsUseCase {
  private supabase = createSupabaseBrowserClient();

  async connect(token: string) {
    // 1. Verify token via local API proxy (to avoid CORS/Secrets leakage)
    const res = await fetch("/api/oura/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.trim() }),
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to connect Oura");
    }

    // 2. Metadata is updated by the API route on the server, 
    // but we can also update it here to be absolutely sure the session sees it.
    const { error } = await this.supabase.auth.updateUser({
      data: { 
        oura_token: token.trim(),
        oura_connected: true,
        oura_connected_at: new Date().toISOString(),
      }
    });

    if (error) throw error;
    return true;
  }

  async sync() {
    const res = await fetch("/api/oura/sync", { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Sync failed");
    }
    return true;
  }
}

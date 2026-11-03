// Public browser configuration. The publishable key is designed for client-side use;
// database access is restricted by the user_sync_state RLS policies.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";

const SUPABASE_URL = "https://yuckdcktorvizxtlxare.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Gqmfq2NItEhEU4bG-UUocw_oIzRGTLy";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function pullSyncState() {
  const { data, error } = await supabase
    .from("user_sync_state")
    .select("data, updated_at")
    .maybeSingle();
  if (error) throw error;
  return data ? {
    ...(data.data || {}),
    updatedAt: new Date(data.updated_at).getTime(),
    rowVersion: data.updated_at
  } : null;
}

export async function pushSyncState(snapshot, expectedRowVersion = null) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("يجب تسجيل الدخول قبل المزامنة.");

  const payload = {
    data: snapshot,
    updated_at: new Date().toISOString()
  };

  if (expectedRowVersion) {
    const { data, error } = await supabase
      .from("user_sync_state")
      .update(payload)
      .eq("user_id", user.id)
      .eq("updated_at", expectedRowVersion)
      .select("updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const conflict = new Error("تم تحديث بيانات المزامنة من جهاز آخر. ستتم إعادة المحاولة.");
      conflict.code = "SYNC_CONFLICT";
      throw conflict;
    }
    return;
  }

  const { error } = await supabase
    .from("user_sync_state")
    .insert({ user_id: user.id, ...payload });
  if (error?.code === "23505") {
    const conflict = new Error("تم إنشاء سجل المزامنة من جلسة أخرى. ستتم إعادة المحاولة.");
    conflict.code = "SYNC_CONFLICT";
    throw conflict;
  }
  if (error) throw error;
}

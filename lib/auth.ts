import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      user: null,
      response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    };
  }

  return { user: data.user, response: null };
}

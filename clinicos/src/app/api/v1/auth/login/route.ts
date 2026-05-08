import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ error: "Email ou mot de passe incorrect" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    await supabase
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", data.user.id);

    await supabase.from("activity_logs").insert({
      user_id: data.user.id,
      user_name: profile?.name ?? data.user.email ?? "",
      user_role: profile?.role ?? "",
      action: "login",
      entity_type: "session",
      entity_label: "Connexion",
    });

    return NextResponse.json({
      token: data.session.access_token,
      role: profile?.role || "doctor",
      name: profile?.name || data.user.email,
      email: data.user.email,
      id: data.user.id,
      mustChangePassword: profile?.must_change_password ?? false,
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

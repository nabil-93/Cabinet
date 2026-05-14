import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function detectDevice(ua: string): string {
  if (/mobile|android|iphone|ipad|tablet/i.test(ua)) return "mobile";
  if (/tablet|ipad/i.test(ua)) return "tablet";
  return "desktop";
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const userAgent = req.headers.get("user-agent") ?? "";
    const device = detectDevice(userAgent);

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

    if (profile?.is_active === false) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Votre compte a été temporairement désactivé. Veuillez contacter l'administrateur." },
        { status: 403 }
      );
    }

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
      details: { device, userAgent: userAgent.slice(0, 200) },
    });

    return NextResponse.json({
      token: data.session.access_token,
      role: profile?.role || "doctor",
      name: profile?.name || data.user.email,
      email: data.user.email,
      id: data.user.id,
      mustChangePassword: profile?.must_change_password ?? false,
      avatarUrl: profile?.avatar_url ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

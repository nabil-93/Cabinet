import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") === "true";

    let query = supabase.from("profiles").select("*").neq("role", "patient").order("created_at", { ascending: false });
    if (activeOnly) query = query.eq("is_active", true);

    const { data: profiles, error } = await query;
    if (error) return err(error.message);

    const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const emailMap = new Map(authUsers.map(u => [u.id, u.email ?? ""]));

    const result = (profiles ?? []).map(p => ({
      id: p.id,
      name: p.name,
      email: emailMap.get(p.id) ?? "",
      role: p.role,
      phone: p.phone ?? null,
      specialty: p.specialty ?? null,
      isActive: p.is_active ?? true,
      mustChangePassword: p.must_change_password ?? false,
      lastLoginAt: p.last_login_at ?? null,
      createdAt: p.created_at,
    }));

    return ok(result);
  } catch (e: any) {
    return err(e.message ?? "Erreur serveur", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, role, phone, specialty } = body;

    if (!name || !email || !password || !role) {
      return err("Champs requis manquants");
    }

    const admin = createAdminClient();
    const supabase = await createClient();

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return err(authError?.message ?? "Erreur création utilisateur");
    }

    const newId = authData.user.id;

    // Upsert : le trigger Supabase crée déjà un profil vide, on le met à jour
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: newId,
        name,
        role,
        phone: phone ?? null,
        specialty: specialty ?? null,
        must_change_password: true,
        is_active: true,
      }, { onConflict: "id" })
      .select()
      .single();

    if (profileError) {
      await admin.auth.admin.deleteUser(newId);
      return err(profileError.message);
    }

    const { data: actor } = await supabase.auth.getUser();
    if (actor.user) {
      const { data: actorProfile } = await supabase
        .from("profiles")
        .select("name, role")
        .eq("id", actor.user.id)
        .single();

      await supabase.from("activity_logs").insert({
        user_id: actor.user.id,
        user_name: actorProfile?.name ?? "",
        user_role: actorProfile?.role ?? "",
        action: "create_user",
        entity_type: "user",
        entity_id: newId,
        entity_label: name,
      });
    }

    return ok({
      id: newId,
      name: profile.name,
      email,
      role: profile.role,
      phone: profile.phone ?? null,
      specialty: profile.specialty ?? null,
      isActive: profile.is_active,
      mustChangePassword: profile.must_change_password,
      lastLoginAt: profile.last_login_at ?? null,
      createdAt: profile.created_at,
    }, 201);
  } catch (e: any) {
    return err(e.message ?? "Erreur serveur", 500);
  }
}

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const admin = createAdminClient();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !profile) return err("Utilisateur introuvable", 404);

    const { data: authUser } = await admin.auth.admin.getUserById(id);

    return ok({
      id: profile.id,
      name: profile.name,
      email: authUser.user?.email ?? "",
      role: profile.role,
      phone: profile.phone ?? null,
      specialty: profile.specialty ?? null,
      isActive: profile.is_active ?? true,
      mustChangePassword: profile.must_change_password ?? false,
      lastLoginAt: profile.last_login_at ?? null,
      createdAt: profile.created_at,
    });
  } catch (e: any) {
    return err(e.message ?? "Erreur serveur", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const supabase = await createClient();
    const admin    = createAdminClient();

    // Reset password via admin SDK
    if (body.newPassword) {
      if (body.newPassword.length < 8) return err("Le mot de passe doit contenir au moins 8 caractères", 400);
      const { error: pwErr } = await admin.auth.admin.updateUserById(id, { password: body.newPassword });
      if (pwErr) return err(pwErr.message);
      await supabase.from("profiles").update({ must_change_password: true }).eq("id", id);
      const { data: { user: actor } } = await supabase.auth.getUser();
      if (actor) {
        const { data: ap } = await supabase.from("profiles").select("name, role").eq("id", actor.id).single();
        const { data: target } = await supabase.from("profiles").select("name").eq("id", id).single();
        await supabase.from("activity_logs").insert({
          user_id: actor.id, user_name: ap?.name ?? "", user_role: ap?.role ?? "",
          action: "reset_password", entity_type: "user", entity_id: id, entity_label: target?.name ?? "",
        });
      }
      return ok({ success: true });
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.role !== undefined) updates.role = body.role;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.specialty !== undefined) updates.specialty = body.specialty;
    if (body.isActive !== undefined) updates.is_active = body.isActive;
    if (body.mustChangePassword !== undefined) updates.must_change_password = body.mustChangePassword;

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return err(error.message);

    const { data: actor } = await supabase.auth.getUser();
    if (actor.user) {
      const { data: actorProfile } = await supabase
        .from("profiles").select("name, role").eq("id", actor.user.id).single();
      // Use specific action for activate/deactivate
      let action = "update_user";
      if (body.isActive === true)  action = "activate_user";
      if (body.isActive === false) action = "deactivate_user";
      await supabase.from("activity_logs").insert({
        user_id: actor.user.id,
        user_name: actorProfile?.name ?? "",
        user_role: actorProfile?.role ?? "",
        action,
        entity_type: "user",
        entity_id: id,
        entity_label: profile.name,
        details: updates,
      });
    }

    return ok({
      id: profile.id,
      name: profile.name,
      role: profile.role,
      phone: profile.phone ?? null,
      specialty: profile.specialty ?? null,
      isActive: profile.is_active,
      mustChangePassword: profile.must_change_password,
      lastLoginAt: profile.last_login_at ?? null,
      createdAt: profile.created_at,
    });
  } catch (e: any) {
    return err(e.message ?? "Erreur serveur", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const admin    = createAdminClient();

    // Prevent self-deletion
    const { data: { user: actor } } = await supabase.auth.getUser();
    if (!actor) return err("Non authentifié", 401);
    if (actor.id === id) return err("Vous ne pouvez pas supprimer votre propre compte", 403);

    const { data: profile } = await supabase
      .from("profiles").select("name, role").eq("id", id).single();

    // Delete from Supabase Auth (cascades to profiles if FK set, else manual)
    const { error: authErr } = await admin.auth.admin.deleteUser(id);
    if (authErr) return err(authErr.message);

    // Delete profile if not already cascaded
    await supabase.from("profiles").delete().eq("id", id);

    const { data: actorProfile } = await supabase
      .from("profiles").select("name, role").eq("id", actor.id).single();

    await supabase.from("activity_logs").insert({
      user_id: actor.id,
      user_name: actorProfile?.name ?? "",
      user_role: actorProfile?.role ?? "",
      action: "delete_user",
      entity_type: "user",
      entity_id: id,
      entity_label: profile?.name ?? "",
    });

    return ok({ success: true });
  } catch (e: any) {
    return err(e.message ?? "Erreur serveur", 500);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role, phone, specialty } = await req.json();

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, role: role || "doctor" } },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (data.user && phone) {
      await supabase.from("profiles").update({ phone, specialty }).eq("id", data.user.id);
    }

    return NextResponse.json({
      token: data.session?.access_token || "",
      role: role || "doctor",
      name,
      email,
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, err } from "@/lib/supabase/helpers";
import { normalize } from "../route";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
    .order("full_name");
  if (error) return err(error.message);
  return ok((data || []).map(normalize));
}

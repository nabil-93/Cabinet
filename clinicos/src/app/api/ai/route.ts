import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Tools ────────────────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_stats",
    description: "Obtenir les statistiques globales du cabinet : total patients, RDV aujourd'hui, revenus du mois, salle d'attente, etc.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_patients",
    description: "Obtenir la liste des patients avec leurs informations médicales (allergies, historique, etc.)",
    input_schema: {
      type: "object" as const,
      properties: {
        search: { type: "string", description: "Rechercher par nom" },
        limit: { type: "number", description: "Nombre max de résultats (défaut: 50)" },
      },
    },
  },
  {
    name: "get_appointments",
    description: "Obtenir les rendez-vous avec filtres optionnels",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Date au format YYYY-MM-DD (ex: aujourd'hui)" },
        status: { type: "string", enum: ["confirmed", "pending", "completed", "cancelled"], description: "Filtrer par statut" },
        limit: { type: "number", description: "Nombre max de résultats" },
      },
    },
  },
  {
    name: "get_waiting_room",
    description: "Obtenir l'état actuel de la salle d'attente (patients en attente, en consultation, terminés)",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_invoices",
    description: "Obtenir les factures avec filtres optionnels",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["paid", "unpaid", "partial"], description: "Filtrer par statut" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_team",
    description: "Obtenir la liste des membres de l'équipe (médecins, secrétaires, admin)",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_activity",
    description: "Obtenir l'historique des activités récentes du cabinet",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Nombre d'activités à récupérer (défaut: 20)" },
      },
    },
  },
  {
    name: "create_appointment",
    description: "Créer un nouveau rendez-vous pour un patient",
    input_schema: {
      type: "object" as const,
      required: ["patientId", "date", "time", "type"],
      properties: {
        patientId: { type: "string", description: "ID du patient" },
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
        time: { type: "string", description: "Heure au format HH:MM" },
        type: { type: "string", enum: ["Consultation", "Suivi", "Bilan", "Urgence", "Vaccination", "Contrôle", "Autre"] },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "update_appointment_status",
    description: "Modifier le statut d'un rendez-vous",
    input_schema: {
      type: "object" as const,
      required: ["appointmentId", "status"],
      properties: {
        appointmentId: { type: "string" },
        status: { type: "string", enum: ["confirmed", "pending", "completed", "cancelled"] },
      },
    },
  },
  {
    name: "add_to_waiting_room",
    description: "Ajouter un patient à la salle d'attente",
    input_schema: {
      type: "object" as const,
      required: ["patientId"],
      properties: {
        patientId: { type: "string" },
        priority: { type: "string", enum: ["normal", "urgent"], description: "Priorité (défaut: normal)" },
        visitType: { type: "string", enum: ["Consultation", "Suivi", "Bilan", "Urgence", "Vaccination", "Contrôle", "Autre"] },
      },
    },
  },
  {
    name: "search_patients",
    description: "Rechercher des patients par nom pour obtenir leur ID",
    input_schema: {
      type: "object" as const,
      required: ["query"],
      properties: {
        query: { type: "string", description: "Nom du patient à rechercher" },
      },
    },
  },
];

// ─── Tool executor ─────────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, any>): Promise<string> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  try {
    switch (name) {

      case "get_stats": {
        const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01T00:00:00Z`;
        const [
          { count: totalPatients },
          { count: todayAppts },
          { data: revenues },
          { count: waiting },
          { count: completedToday },
          { count: pendingInvoices },
        ] = await Promise.all([
          supabase.from("patients").select("*", { count: "exact", head: true }),
          supabase.from("appointments").select("*", { count: "exact", head: true }).eq("date", today).in("status", ["confirmed", "pending"]),
          supabase.from("invoices").select("paid").gte("created_at", month),
          supabase.from("waiting_room").select("*", { count: "exact", head: true }).eq("status", "waiting"),
          supabase.from("appointments").select("*", { count: "exact", head: true }).eq("date", today).eq("status", "completed"),
          supabase.from("invoices").select("*", { count: "exact", head: true }).eq("status", "unpaid"),
        ]);
        const monthlyRevenue = (revenues ?? []).reduce((s: number, i: any) => s + (i.paid || 0), 0);
        return JSON.stringify({ totalPatients, todayAppts, monthlyRevenue, waiting, completedToday, pendingInvoices, date: today });
      }

      case "get_patients": {
        let q = supabase.from("patients").select("id, full_name, phone, gender, date_of_birth, allergies, medical_history, status, last_visit").order("created_at", { ascending: false }).limit(input.limit ?? 50);
        if (input.search) q = q.ilike("full_name", `%${input.search}%`);
        const { data } = await q;
        return JSON.stringify(data ?? []);
      }

      case "search_patients": {
        const { data } = await supabase.from("patients").select("id, full_name, phone").ilike("full_name", `%${input.query}%`).limit(10);
        return JSON.stringify(data ?? []);
      }

      case "get_appointments": {
        let q = supabase.from("appointments")
          .select("id, date, time, type, status, notes, patients(full_name, phone)")
          .order("date", { ascending: false })
          .order("time", { ascending: true })
          .limit(input.limit ?? 30);
        if (input.date) q = q.eq("date", input.date);
        if (input.status) q = q.eq("status", input.status);
        const { data } = await q;
        return JSON.stringify(data ?? []);
      }

      case "get_waiting_room": {
        const { data } = await supabase
          .from("waiting_room")
          .select("id, status, priority, arrived_at, assigned_doctor_name, patients(full_name), appointments(time, type)")
          .gte("arrived_at", `${today}T00:00:00`)
          .order("arrived_at", { ascending: true });
        return JSON.stringify(data ?? []);
      }

      case "get_invoices": {
        let q = supabase.from("invoices")
          .select("id, invoice_number, date, total, paid, status, paid_at, patients(full_name)")
          .order("created_at", { ascending: false })
          .limit(input.limit ?? 30);
        if (input.status) q = q.eq("status", input.status);
        const { data } = await q;
        return JSON.stringify(data ?? []);
      }

      case "get_team": {
        const { data } = await supabase.from("profiles").select("id, name, role, specialty, is_active, last_login_at").neq("role", "patient").order("name");
        return JSON.stringify(data ?? []);
      }

      case "get_activity": {
        const { data } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(input.limit ?? 20);
        return JSON.stringify(data ?? []);
      }

      case "create_appointment": {
        const { data, error } = await supabase.from("appointments")
          .insert({
            patient_id: input.patientId,
            date: input.date,
            time: input.time,
            type: input.type,
            status: "confirmed",
            duration: 30,
            notes: input.notes ?? null,
          })
          .select("id, date, time, type, status, patients(full_name)")
          .single();
        if (error) return JSON.stringify({ error: error.message });
        // Log activity
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: p } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();
          await supabase.from("activity_logs").insert({ user_id: user.id, user_name: p?.name ?? "", user_role: p?.role ?? "", action: "create_appointment", entity_type: "appointment", entity_id: data?.id, entity_label: `${(data as any)?.patients?.full_name} – ${input.date} ${input.time}` });
        }
        return JSON.stringify({ success: true, appointment: data });
      }

      case "update_appointment_status": {
        const { error } = await supabase.from("appointments").update({ status: input.status }).eq("id", input.appointmentId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, appointmentId: input.appointmentId, newStatus: input.status });
      }

      case "add_to_waiting_room": {
        // Check if already in queue
        const { data: existing } = await supabase.from("waiting_room").select("id").eq("patient_id", input.patientId).gte("arrived_at", `${today}T00:00:00`).in("status", ["waiting", "in_progress"]).maybeSingle();
        if (existing) return JSON.stringify({ error: "Ce patient est déjà dans la salle d'attente" });
        // Create appointment if needed
        const { data: appt } = await supabase.from("appointments").insert({ patient_id: input.patientId, date: today, time: new Date().toTimeString().slice(0, 5), type: input.visitType ?? "Consultation", status: "confirmed" }).select("id").single();
        const { data, error } = await supabase.from("waiting_room").insert({ patient_id: input.patientId, appointment_id: appt?.id ?? null, priority: input.priority ?? "normal", status: "waiting", arrived_at: new Date().toISOString() }).select("id, patients(full_name)").single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, entry: data });
      }

      default:
        return JSON.stringify({ error: `Outil inconnu: ${name}` });
    }
  } catch (e: any) {
    return JSON.stringify({ error: e.message ?? "Erreur interne" });
  }
}

// ─── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es l'assistant IA intégré de ClinicOS, une plateforme de gestion de cabinet médical.
Tu as un accès COMPLET et EN TEMPS RÉEL à toutes les données du cabinet via tes outils.

RÈGLES ABSOLUES :
1. Avant de répondre à toute question sur les données (patients, RDV, factures, équipe, salle d'attente), utilise TOUJOURS tes outils pour obtenir les données fraîches.
2. Pour toute action demandée (créer un RDV, ajouter à la salle d'attente, etc.), utilise l'outil correspondant ET confirme l'action avec les détails.
3. Ne jamais inventer ou supposer des données — utilise toujours les outils.
4. Si tu as besoin d'un ID patient pour une action, utilise search_patients d'abord.
5. Réponds TOUJOURS en français, de manière claire et concise.
6. Utilise le **gras** pour les informations importantes, les listes à puces pour l'organisation.
7. Pour les actions réussies, confirme clairement ce qui a été fait.
8. Pour les erreurs, explique ce qui s'est passé et propose une solution.

CAPACITÉS :
- Lecture : patients, rendez-vous, salle d'attente, factures, équipe, activité, statistiques
- Actions : créer des rendez-vous, ajouter des patients à la salle d'attente, modifier le statut d'un RDV
- Analyse : rapports, statistiques, tendances basées sur les vraies données

Date d'aujourd'hui : ${new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;

// ─── Main route ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body as { messages: { role: "user" | "assistant"; content: string }[] };

    if (!messages?.length) return NextResponse.json({ message: "Messages invalides." }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "⚠️ Clé API Anthropic non configurée. Ajoutez ANTHROPIC_API_KEY dans vos variables d'environnement Vercel.", mode: "error" });
    }

    // Agentic loop — Claude calls tools until done
    const anthropicMessages: Anthropic.MessageParam[] = messages.map(m => ({ role: m.role, content: m.content }));

    let finalText = "";
    let iteration = 0;
    const MAX_ITERATIONS = 8;

    while (iteration < MAX_ITERATIONS) {
      iteration++;

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: anthropicMessages,
      });

      // Collect text content
      const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
      const toolBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

      if (response.stop_reason === "end_turn" || toolBlocks.length === 0) {
        finalText = textBlocks.map(b => b.text).join("\n");
        break;
      }

      // Execute all tool calls
      anthropicMessages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolBlocks.map(async (tool) => ({
          type: "tool_result" as const,
          tool_use_id: tool.id,
          content: await executeTool(tool.name, tool.input as Record<string, any>),
        }))
      );

      anthropicMessages.push({ role: "user", content: toolResults });
    }

    if (!finalText) finalText = "Je n'ai pas pu générer une réponse. Veuillez réessayer.";

    return NextResponse.json({ message: finalText, mode: "claude" });
  } catch (error: any) {
    console.error("AI route error:", error);
    return NextResponse.json({ message: "⚠️ Une erreur est survenue. Veuillez réessayer." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getToday } from "@/lib/date-utils";

// ─── OpenAI function definitions ──────────────────────────────────────────────

const FUNCTIONS = [
  {
    name: "get_stats",
    description: "Obtenir les statistiques globales du cabinet",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_patients",
    description: "Obtenir la liste des patients avec informations médicales",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Rechercher par nom" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "search_patients",
    description: "Rechercher des patients par nom pour obtenir leur ID",
    parameters: {
      type: "object",
      required: ["query"],
      properties: { query: { type: "string" } },
    },
  },
  {
    name: "get_appointments",
    description: "Obtenir les rendez-vous avec filtres",
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "Format YYYY-MM-DD" },
        status: { type: "string", enum: ["confirmed", "pending", "completed", "cancelled"] },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_waiting_room",
    description: "Obtenir l'état actuel de la salle d'attente",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_invoices",
    description: "Obtenir les factures",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["paid", "unpaid", "partial"] },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_team",
    description: "Obtenir la liste des membres de l'équipe",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_activity",
    description: "Obtenir l'historique complet des activités du cabinet avec filtres. Permet de savoir qui a fait quoi, quand, sur quel patient ou entité.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Nombre d'activités (défaut: 30)" },
        userId: { type: "string", description: "Filtrer par membre de l'équipe (ID)" },
        action: { type: "string", description: "Filtrer par type d'action (ex: create_patient, login, create_appointment, pay_invoice, etc.)" },
        entityLabel: { type: "string", description: "Rechercher dans le label de l'entité (nom du patient, numéro de facture, etc.)" },
        since: { type: "string", description: "Depuis cette date YYYY-MM-DD" },
      },
    },
  },
  {
    name: "create_appointment",
    description: "Créer un nouveau rendez-vous pour un patient",
    parameters: {
      type: "object",
      required: ["patientId", "date", "time", "type"],
      properties: {
        patientId: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM" },
        type: { type: "string", enum: ["Consultation", "Suivi", "Bilan", "Urgence", "Vaccination", "Contrôle", "Autre"] },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "update_appointment_status",
    description: "Modifier le statut d'un rendez-vous",
    parameters: {
      type: "object",
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
    parameters: {
      type: "object",
      required: ["patientId"],
      properties: {
        patientId: { type: "string" },
        priority: { type: "string", enum: ["normal", "urgent"] },
        visitType: { type: "string", enum: ["Consultation", "Suivi", "Bilan", "Urgence", "Vaccination", "Contrôle", "Autre"] },
      },
    },
  },
  {
    name: "create_patient",
    description: "Créer un nouveau patient dans le système",
    parameters: {
      type: "object",
      required: ["fullName"],
      properties: {
        fullName: { type: "string", description: "Nom complet du patient" },
        phone: { type: "string" },
        dateOfBirth: { type: "string", description: "Date de naissance YYYY-MM-DD" },
        gender: { type: "string", enum: ["male", "female"] },
        allergies: { type: "string" },
        medicalHistory: { type: "string" },
      },
    },
  },
  {
    name: "update_patient",
    description: "Modifier les informations d'un patient existant",
    parameters: {
      type: "object",
      required: ["patientId"],
      properties: {
        patientId: { type: "string" },
        fullName: { type: "string" },
        phone: { type: "string" },
        dateOfBirth: { type: "string" },
        gender: { type: "string", enum: ["male", "female"] },
        allergies: { type: "string" },
        medicalHistory: { type: "string" },
      },
    },
  },
  {
    name: "delete_appointment",
    description: "Supprimer un rendez-vous",
    parameters: {
      type: "object",
      required: ["appointmentId"],
      properties: { appointmentId: { type: "string" } },
    },
  },
  {
    name: "get_consultations",
    description: "Obtenir les rapports de consultation et l'historique médical d'un patient",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "ID du patient pour filtrer ses consultations" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_prescriptions",
    description: "Obtenir les ordonnances d'un patient ou toutes les ordonnances",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string", description: "ID du patient" },
        limit: { type: "number" },
      },
    },
  },
];

// ─── Tool executor ─────────────────────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  const supabase = await createClient();
  const today = getToday();

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
        let q = supabase.from("patients")
          .select("id, full_name, phone, gender, date_of_birth, allergies, medical_history, status, last_visit")
          .order("created_at", { ascending: false })
          .limit(args.limit ?? 50);
        if (args.search) q = q.ilike("full_name", `%${args.search}%`);
        const { data } = await q;
        return JSON.stringify(data ?? []);
      }

      case "search_patients": {
        const { data } = await supabase.from("patients")
          .select("id, full_name, phone")
          .ilike("full_name", `%${args.query}%`)
          .limit(10);
        return JSON.stringify(data ?? []);
      }

      case "get_appointments": {
        let q = supabase.from("appointments")
          .select("id, date, time, type, status, notes, patients(full_name, phone)")
          .order("date", { ascending: false })
          .limit(args.limit ?? 30);
        if (args.date) q = q.eq("date", args.date);
        if (args.status) q = q.eq("status", args.status);
        const { data } = await q;
        return JSON.stringify(data ?? []);
      }

      case "get_waiting_room": {
        const { data } = await supabase.from("waiting_room")
          .select("id, status, priority, arrived_at, assigned_doctor_name, patients(full_name), appointments(time, type)")
          .gte("arrived_at", `${today}T00:00:00`)
          .order("arrived_at", { ascending: true });
        return JSON.stringify(data ?? []);
      }

      case "get_invoices": {
        let q = supabase.from("invoices")
          .select("id, invoice_number, date, total, paid, status, paid_at, patients(full_name)")
          .order("created_at", { ascending: false })
          .limit(args.limit ?? 30);
        if (args.status) q = q.eq("status", args.status);
        const { data } = await q;
        return JSON.stringify(data ?? []);
      }

      case "get_team": {
        const { data } = await supabase.from("profiles")
          .select("id, name, role, specialty, is_active, last_login_at")
          .neq("role", "patient")
          .order("name");
        return JSON.stringify(data ?? []);
      }

      case "get_activity": {
        let q = supabase.from("activity_logs")
          .select("id, user_name, user_role, action, entity_type, entity_label, details, created_at")
          .order("created_at", { ascending: false })
          .limit(args.limit ?? 30);
        if (args.userId)      q = q.eq("user_id", args.userId);
        if (args.action)      q = q.eq("action", args.action);
        if (args.entityLabel) q = q.ilike("entity_label", `%${args.entityLabel}%`);
        if (args.since)       q = q.gte("created_at", `${args.since}T00:00:00`);
        const { data } = await q;
        return JSON.stringify(data ?? []);
      }

      case "create_appointment": {
        const { data, error } = await supabase.from("appointments")
          .insert({ patient_id: args.patientId, date: args.date, time: args.time, type: args.type, status: "confirmed", duration: 30, notes: args.notes ?? null })
          .select("id, date, time, type, status, patients(full_name)")
          .single();
        if (error) return JSON.stringify({ error: error.message });
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: p } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();
          await supabase.from("activity_logs").insert({ user_id: user.id, user_name: p?.name ?? "", user_role: p?.role ?? "", action: "create_appointment", entity_type: "appointment", entity_id: data?.id, entity_label: `${(data as any)?.patients?.full_name} – ${args.date} ${args.time}` });
        }
        return JSON.stringify({ success: true, appointment: data });
      }

      case "update_appointment_status": {
        const { error } = await supabase.from("appointments").update({ status: args.status }).eq("id", args.appointmentId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, appointmentId: args.appointmentId, newStatus: args.status });
      }

      case "add_to_waiting_room": {
        const { data: existing } = await supabase.from("waiting_room").select("id").eq("patient_id", args.patientId).gte("arrived_at", `${today}T00:00:00`).in("status", ["waiting", "in_progress"]).maybeSingle();
        if (existing) return JSON.stringify({ error: "Ce patient est déjà dans la salle d'attente" });
        const { data: appt } = await supabase.from("appointments").insert({ patient_id: args.patientId, date: today, time: new Date().toTimeString().slice(0, 5), type: args.visitType ?? "Consultation", status: "confirmed" }).select("id").single();
        const { data, error } = await supabase.from("waiting_room").insert({ patient_id: args.patientId, appointment_id: appt?.id ?? null, priority: args.priority ?? "normal", status: "waiting", arrived_at: new Date().toISOString() }).select("id, patients(full_name)").single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, entry: data });
      }

      case "create_patient": {
        const { data, error } = await supabase.from("patients")
          .insert({
            full_name: args.fullName,
            phone: args.phone ?? null,
            date_of_birth: args.dateOfBirth ?? null,
            gender: args.gender ?? null,
            allergies: args.allergies ?? null,
            medical_history: args.medicalHistory ?? null,
            status: "active",
          })
          .select("id, full_name, phone, date_of_birth, gender")
          .single();
        if (error) return JSON.stringify({ error: error.message });
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: p } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();
          await supabase.from("activity_logs").insert({ user_id: user.id, user_name: p?.name ?? "", user_role: p?.role ?? "", action: "create_patient", entity_type: "patient", entity_id: data?.id, entity_label: args.fullName });
        }
        return JSON.stringify({ success: true, patient: data });
      }

      case "update_patient": {
        const updates: Record<string, any> = {};
        if (args.fullName) updates.full_name = args.fullName;
        if (args.phone !== undefined) updates.phone = args.phone;
        if (args.dateOfBirth !== undefined) updates.date_of_birth = args.dateOfBirth;
        if (args.gender !== undefined) updates.gender = args.gender;
        if (args.allergies !== undefined) updates.allergies = args.allergies;
        if (args.medicalHistory !== undefined) updates.medical_history = args.medicalHistory;
        const { data, error } = await supabase.from("patients").update(updates).eq("id", args.patientId).select("id, full_name").single();
        if (error) return JSON.stringify({ error: error.message });
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: p } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();
          await supabase.from("activity_logs").insert({ user_id: user.id, user_name: p?.name ?? "", user_role: p?.role ?? "", action: "update_patient", entity_type: "patient", entity_id: args.patientId, entity_label: data?.full_name ?? "" });
        }
        return JSON.stringify({ success: true, patient: data });
      }

      case "delete_appointment": {
        const { data: apt } = await supabase.from("appointments").select("patients(full_name), date, time").eq("id", args.appointmentId).single();
        const { error } = await supabase.from("appointments").delete().eq("id", args.appointmentId);
        if (error) return JSON.stringify({ error: error.message });
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: p } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();
          await supabase.from("activity_logs").insert({ user_id: user.id, user_name: p?.name ?? "", user_role: p?.role ?? "", action: "delete_appointment", entity_type: "appointment", entity_id: args.appointmentId, entity_label: `${(apt as any)?.patients?.full_name ?? ""} – ${(apt as any)?.date ?? ""}` });
        }
        return JSON.stringify({ success: true });
      }

      case "get_consultations": {
        let q = supabase.from("consultations")
          .select("id, diagnosis, treatment, notes, next_visit, created_at, patients(full_name), profiles(name)")
          .order("created_at", { ascending: false })
          .limit(args.limit ?? 20);
        if (args.patientId) q = q.eq("patient_id", args.patientId);
        const { data } = await q;
        return JSON.stringify(data ?? []);
      }

      case "get_prescriptions": {
        let q = supabase.from("prescriptions")
          .select("id, diagnosis, medications, notes, created_at, patients(full_name), profiles(name)")
          .order("created_at", { ascending: false })
          .limit(args.limit ?? 20);
        if (args.patientId) q = q.eq("patient_id", args.patientId);
        const { data } = await q;
        return JSON.stringify(data ?? []);
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
Tu as un accès COMPLET et EN TEMPS RÉEL à toutes les données du cabinet via tes fonctions.

ACCÈS DONNÉES (utilise TOUJOURS les fonctions, ne jamais inventer) :
- get_stats : statistiques globales
- get_patients / search_patients : dossiers patients avec allergies et historique
- get_appointments : rendez-vous
- get_waiting_room : salle d'attente en temps réel
- get_invoices : factures et paiements
- get_team : équipe médicale
- get_activity : historique des actions
- get_consultations : rapports de consultation, diagnostics, traitements
- get_prescriptions : ordonnances et médicaments prescrits

ACTIONS (exécute quand demandé) :
- create_patient : créer un nouveau patient
- update_patient : modifier les infos d'un patient (cherche son ID avec search_patients)
- create_appointment : créer un rendez-vous (cherche d'abord l'ID patient)
- update_appointment_status : modifier le statut d'un RDV
- delete_appointment : supprimer un rendez-vous
- add_to_waiting_room : ajouter un patient à la file d'attente

RÈGLES :
1. Utilise TOUJOURS les fonctions pour obtenir des données avant de répondre.
2. Pour toute action, confirme ce qui a été fait avec les détails.
3. Si tu as besoin d'un ID patient pour une action, utilise search_patients d'abord.
4. Réponds TOUJOURS en français, de manière claire et professionnelle.
5. Utilise **gras** pour les infos importantes, listes à puces pour l'organisation.

Date d'aujourd'hui : ${new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;

// ─── Main route ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, imageBase64 } = body as {
      messages: { role: string; content: string }[];
      imageBase64?: string;
    };

    if (!messages?.length) return NextResponse.json({ message: "Messages invalides." }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith("sk-...")) {
      return NextResponse.json({ message: "⚠️ Clé API OpenAI non configurée.", mode: "error" });
    }

    // Build OpenAI messages — attach image only to the last user message
    const formattedMessages: any[] = messages.map((m, idx) => {
      const isLastUserMsg = imageBase64 && idx === messages.length - 1 && m.role === "user";
      if (isLastUserMsg) {
        return {
          role: "user",
          content: [
            { type: "text", text: m.content },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });

    const openaiMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...formattedMessages,
    ];

    let finalText = "";
    let iteration = 0;
    const MAX_ITERATIONS = 8;

    while (iteration < MAX_ITERATIONS) {
      iteration++;

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: imageBase64 ? "gpt-4o" : "gpt-4o-mini",
          messages: openaiMessages,
          functions: FUNCTIONS,
          function_call: "auto",
          max_tokens: 1500,
          temperature: 0.4,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("OpenAI error:", res.status, errText);
        if (res.status === 401) return NextResponse.json({ message: "⚠️ Clé API OpenAI invalide.", mode: "error" });
        if (res.status === 429) return NextResponse.json({ message: "⏳ Limite de requêtes atteinte. Réessayez dans quelques secondes.", mode: "error" });
        throw new Error(`OpenAI ${res.status}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;

      if (!msg) break;

      // No function call — we have the final answer
      if (!msg.function_call) {
        finalText = msg.content ?? "";
        break;
      }

      // Execute the function
      const fnName = msg.function_call.name;
      let fnArgs: Record<string, any> = {};
      try { fnArgs = JSON.parse(msg.function_call.arguments || "{}"); } catch {}
      const fnResult = await executeTool(fnName, fnArgs);

      // Add assistant message + function result to history
      openaiMessages.push({ role: "assistant", content: msg.content ?? null, function_call: msg.function_call });
      openaiMessages.push({ role: "function", name: fnName, content: fnResult });
    }

    if (!finalText) finalText = "Désolé, je n'ai pas pu compléter cette action. Veuillez réessayer ou reformuler votre demande.";

    return NextResponse.json({ message: finalText, mode: "openai" });
  } catch (error: any) {
    console.error("AI route error:", error);
    return NextResponse.json({ message: "⚠️ Une erreur est survenue. Veuillez réessayer." }, { status: 500 });
  }
}

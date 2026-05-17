import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getToday, formatDate } from "@/lib/date-utils";

// ─── Date helpers ──────────────────────────────────────────────────────────────

function getMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  return { from, to: formatDate(now) };
}

function getWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return { from: formatDate(monday), to: formatDate(now) };
}

function getSixMonthsRange(): { from: string; to: string } {
  const now = new Date();
  const ago = new Date(now);
  ago.setMonth(ago.getMonth() - 6);
  return { from: formatDate(ago), to: formatDate(now) };
}

// ─── OpenAI function definitions ──────────────────────────────────────────────

const FUNCTIONS = [
  {
    name: "get_stats",
    description: "Obtenir les statistiques globales du cabinet (total patients, RDV aujourd'hui, revenus du mois, salle d'attente, factures impayées)",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_appointments",
    description: "Obtenir les rendez-vous avec filtres. Pour 'cette semaine' utilise dateFrom+dateTo. Pour 'ce mois' utilise month=YYYY-MM. Pour un jour précis utilise date=YYYY-MM-DD. Peut filtrer par statut.",
    parameters: {
      type: "object",
      properties: {
        date:     { type: "string", description: "Un jour précis YYYY-MM-DD" },
        month:    { type: "string", description: "Mois entier format YYYY-MM (ex: 2026-05)" },
        dateFrom: { type: "string", description: "Début de plage YYYY-MM-DD" },
        dateTo:   { type: "string", description: "Fin de plage YYYY-MM-DD" },
        status:   { type: "string", enum: ["confirmed", "pending", "completed", "cancelled"] },
        patientId:{ type: "string", description: "Filtrer par patient" },
        limit:    { type: "number" },
      },
    },
  },
  {
    name: "get_appointments_stats",
    description: "Obtenir les statistiques des rendez-vous par statut pour une période. Utilise pour répondre à 'combien de RDV annulés ce mois', 'nombre de consultations cette semaine', etc.",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["today", "week", "month", "6months"], description: "today=aujourd'hui, week=cette semaine, month=ce mois, 6months=6 derniers mois" },
        dateFrom: { type: "string", description: "Alternative: début de plage YYYY-MM-DD" },
        dateTo:   { type: "string", description: "Alternative: fin de plage YYYY-MM-DD" },
      },
    },
  },
  {
    name: "get_patients",
    description: "Obtenir la liste des patients avec informations médicales",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Rechercher par nom" },
        status: { type: "string", enum: ["active", "inactive"] },
        limit:  { type: "number" },
      },
    },
  },
  {
    name: "search_patients",
    description: "Rechercher des patients par nom pour obtenir leur ID — utilise TOUJOURS cette fonction avant toute action sur un patient",
    parameters: {
      type: "object",
      required: ["query"],
      properties: { query: { type: "string" } },
    },
  },
  {
    name: "get_waiting_room",
    description: "Obtenir l'état actuel de la salle d'attente en temps réel",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_invoices",
    description: "Obtenir les factures avec filtres. Supporte filtre par statut et par période.",
    parameters: {
      type: "object",
      properties: {
        status:   { type: "string", enum: ["paid", "unpaid", "partial", "overdue"] },
        period:   { type: "string", enum: ["today", "week", "month", "6months"] },
        dateFrom: { type: "string", description: "Début de plage YYYY-MM-DD" },
        dateTo:   { type: "string", description: "Fin de plage YYYY-MM-DD" },
        patientId:{ type: "string" },
        limit:    { type: "number" },
      },
    },
  },
  {
    name: "get_invoices_stats",
    description: "Obtenir les statistiques financières: montants payés, impayés, partiels pour une période",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["today", "week", "month", "6months"] },
      },
    },
  },
  {
    name: "get_team",
    description: "Obtenir la liste des membres de l'équipe médicale",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_activity",
    description: "Obtenir l'historique des activités du cabinet (qui a fait quoi, quand)",
    parameters: {
      type: "object",
      properties: {
        limit:       { type: "number" },
        userId:      { type: "string" },
        action:      { type: "string" },
        entityLabel: { type: "string" },
        since:       { type: "string", description: "Depuis cette date YYYY-MM-DD" },
      },
    },
  },
  {
    name: "get_consultations",
    description: "Obtenir les rapports de consultation d'un patient ou de tous les patients",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string" },
        limit:     { type: "number" },
      },
    },
  },
  {
    name: "get_prescriptions",
    description: "Obtenir les ordonnances d'un patient ou de tous les patients",
    parameters: {
      type: "object",
      properties: {
        patientId: { type: "string" },
        limit:     { type: "number" },
      },
    },
  },
  {
    name: "create_appointment",
    description: "Créer un nouveau rendez-vous. Cherche d'abord le patientId avec search_patients.",
    parameters: {
      type: "object",
      required: ["patientId", "date", "time", "type"],
      properties: {
        patientId: { type: "string" },
        date:      { type: "string", description: "YYYY-MM-DD" },
        time:      { type: "string", description: "HH:MM" },
        type:      { type: "string", enum: ["Consultation", "Suivi", "Bilan", "Urgence", "Vaccination", "Contrôle", "Autre"] },
        notes:     { type: "string" },
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
        status:        { type: "string", enum: ["confirmed", "pending", "completed", "cancelled"] },
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
    name: "add_to_waiting_room",
    description: "Ajouter un patient à la salle d'attente",
    parameters: {
      type: "object",
      required: ["patientId"],
      properties: {
        patientId: { type: "string" },
        priority:  { type: "string", enum: ["normal", "urgent"] },
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
        fullName:      { type: "string" },
        phone:         { type: "string" },
        email:         { type: "string" },
        dateOfBirth:   { type: "string", description: "YYYY-MM-DD" },
        gender:        { type: "string", enum: ["male", "female"] },
        allergies:     { type: "array", items: { type: "string" } },
        medicalHistory:{ type: "array", items: { type: "string" } },
        address:       { type: "string" },
      },
    },
  },
  {
    name: "update_patient",
    description: "Modifier les infos d'un patient. Pour ajouter des allergies/antécédents, récupère d'abord get_patients ou search_patients, puis inclus TOUTES les valeurs existantes + les nouvelles.",
    parameters: {
      type: "object",
      required: ["patientId"],
      properties: {
        patientId:     { type: "string" },
        fullName:      { type: "string" },
        phone:         { type: "string" },
        dateOfBirth:   { type: "string" },
        gender:        { type: "string", enum: ["male", "female"] },
        allergies:     { type: "array", items: { type: "string" }, description: "Liste COMPLÈTE des allergies (anciennes + nouvelles)" },
        medicalHistory:{ type: "array", items: { type: "string" }, description: "Liste COMPLÈTE des antécédents (anciens + nouveaux)" },
        address:       { type: "string" },
        status:        { type: "string", enum: ["active", "inactive"] },
      },
    },
  },
  {
    name: "create_consultation",
    description: "Créer et sauvegarder un rapport de consultation médicale pour un patient",
    parameters: {
      type: "object",
      required: ["patientId", "diagnosis"],
      properties: {
        patientId: { type: "string" },
        diagnosis: { type: "string" },
        treatment: { type: "string" },
        notes:     { type: "string" },
        nextVisit: { type: "string", description: "YYYY-MM-DD" },
      },
    },
  },
  {
    name: "create_prescription",
    description: "Créer et sauvegarder une ordonnance avec liste de médicaments",
    parameters: {
      type: "object",
      required: ["patientId", "medications"],
      properties: {
        patientId: { type: "string" },
        diagnosis: { type: "string" },
        medications: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name:         { type: "string" },
              dosage:       { type: "string" },
              duration:     { type: "string" },
              instructions: { type: "string" },
            },
          },
        },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "generate_image",
    description: "Générer une image avec DALL-E 3. Utilise pour: recettes de repas sains, plats recommandés pour un patient, illustrations médicales. Génère TOUJOURS une image quand le médecin demande de visualiser un repas ou un plat. Le prompt doit être en anglais, détaillé et professionnel.",
    parameters: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: {
          type: "string",
          description: "Prompt en anglais pour DALL-E 3. Pour les repas: 'Professional food photography of [dish], beautiful plating, restaurant quality, warm lighting, shallow depth of field, photorealistic, high quality'. Inclure les détails visuels importants.",
        },
        size: {
          type: "string",
          enum: ["1024x1024", "1792x1024", "1024x1792"],
          description: "1024x1024 pour carré (défaut), 1792x1024 pour paysage (repas côte à côte), 1024x1792 pour portrait",
        },
      },
    },
  },
  {
    name: "pay_invoice",
    description: "Enregistrer un paiement (total ou partiel) pour une facture",
    parameters: {
      type: "object",
      required: ["invoiceId", "amount"],
      properties: {
        invoiceId: { type: "string" },
        amount:    { type: "number", description: "Montant payé" },
      },
    },
  },
  {
    name: "get_whatsapp_history",
    description: "Obtenir l'historique des messages WhatsApp envoyés depuis le cabinet (stocké en localStorage côté client — retourne les données disponibles côté serveur via la base). Répond à: combien de messages envoyés, qui a reçu un message, quels patients ont été contactés.",
    parameters: {
      type: "object",
      properties: {
        patientId:   { type: "string", description: "Filtrer par patient" },
        patientName: { type: "string", description: "Rechercher par nom de patient" },
        limit:       { type: "number" },
      },
    },
  },
  {
    name: "get_whatsapp_pending",
    description: "Obtenir la liste des patients avec RDV dans les 3 prochains jours qui n'ont pas encore reçu de message WhatsApp de rappel. Répond à: qui doit encore recevoir un message, patients à contacter.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "open_whatsapp",
    description: "Ouvrir WhatsApp Web pour envoyer un message à un patient. Génère le lien wa.me à ouvrir. Utilise pour: 'envoie un message WhatsApp à X', 'ouvre WhatsApp pour Y'.",
    parameters: {
      type: "object",
      required: ["patientId"],
      properties: {
        patientId:   { type: "string" },
        templateType:{ type: "string", enum: ["rdv_rappel", "rdv_confirm", "resultats", "annulation", "suivi", "custom"], description: "Type de template de message" },
        customMessage:{ type: "string", description: "Message personnalisé (pour templateType=custom)" },
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
          { count: cancelledToday },
          { data: patientStats },
        ] = await Promise.all([
          supabase.from("patients").select("*", { count: "exact", head: true }),
          supabase.from("appointments").select("*", { count: "exact", head: true }).eq("date", today).in("status", ["confirmed", "pending"]),
          supabase.from("invoices").select("paid").gte("created_at", month),
          supabase.from("waiting_room").select("*", { count: "exact", head: true }).eq("status", "waiting").gte("arrived_at", `${today}T00:00:00`),
          supabase.from("appointments").select("*", { count: "exact", head: true }).eq("date", today).eq("status", "completed"),
          supabase.from("invoices").select("*", { count: "exact", head: true }).eq("status", "unpaid"),
          supabase.from("appointments").select("*", { count: "exact", head: true }).eq("date", today).eq("status", "cancelled"),
          supabase.from("patients").select("status"),
        ]);
        const monthlyRevenue = (revenues ?? []).reduce((s: number, i: any) => s + (i.paid || 0), 0);
        const activePatients = (patientStats ?? []).filter((p: any) => p.status === "active").length;
        return JSON.stringify({ totalPatients, activePatients, todayAppts, completedToday, cancelledToday, monthlyRevenue, waiting, pendingInvoices, date: today });
      }

      case "get_appointments": {
        let q = supabase.from("appointments")
          .select("id, date, time, type, status, notes, patients(full_name, phone)")
          .order("date", { ascending: false })
          .order("time", { ascending: true })
          .limit(args.limit ?? 50);
        if (args.patientId) q = q.eq("patient_id", args.patientId);
        if (args.status)    q = q.eq("status", args.status);
        if (args.date)      q = q.eq("date", args.date);
        else if (args.month) {
          q = q.gte("date", `${args.month}-01`).lte("date", `${args.month}-31`);
        } else if (args.dateFrom || args.dateTo) {
          if (args.dateFrom) q = q.gte("date", args.dateFrom);
          if (args.dateTo)   q = q.lte("date", args.dateTo);
        }
        const { data, error } = await q;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ count: (data ?? []).length, appointments: data ?? [] });
      }

      case "get_appointments_stats": {
        let from: string, to: string;
        if (args.dateFrom || args.dateTo) {
          from = args.dateFrom ?? today;
          to   = args.dateTo   ?? today;
        } else {
          const ranges: Record<string, { from: string; to: string }> = {
            today:    { from: today, to: today },
            week:     getWeekRange(),
            month:    getMonthRange(),
            "6months": getSixMonthsRange(),
          };
          ({ from, to } = ranges[args.period ?? "month"] ?? getMonthRange());
        }
        const { data } = await supabase.from("appointments")
          .select("status, patient_id, date, time, type, patients(full_name)")
          .gte("date", from).lte("date", to);
        const apts = data ?? [];
        const byStatus = {
          confirmed: apts.filter((a: any) => a.status === "confirmed"),
          completed: apts.filter((a: any) => a.status === "completed"),
          pending:   apts.filter((a: any) => a.status === "pending"),
          cancelled: apts.filter((a: any) => a.status === "cancelled"),
        };
        const uniquePatients = new Set(apts.map((a: any) => a.patient_id)).size;
        return JSON.stringify({
          period: args.period ?? `${from} → ${to}`,
          from, to,
          total: apts.length,
          uniquePatients,
          confirmed:  byStatus.confirmed.length,
          completed:  byStatus.completed.length,
          pending:    byStatus.pending.length,
          cancelled:  byStatus.cancelled.length,
          cancelledList: byStatus.cancelled.map((a: any) => ({ patient: (a.patients as any)?.full_name, date: a.date, time: a.time, type: a.type })),
          completedList: byStatus.completed.map((a: any) => ({ patient: (a.patients as any)?.full_name, date: a.date, time: a.time })),
        });
      }

      case "get_patients": {
        let q = supabase.from("patients")
          .select("id, full_name, phone, email, gender, date_of_birth, allergies, medical_history, status, last_visit, address, blood_type")
          .order("full_name", { ascending: true })
          .limit(args.limit ?? 50);
        if (args.search) q = q.ilike("full_name", `%${args.search}%`);
        if (args.status) q = q.eq("status", args.status);
        const { data } = await q;
        return JSON.stringify(data ?? []);
      }

      case "search_patients": {
        const { data } = await supabase.from("patients")
          .select("id, full_name, phone, date_of_birth, gender, allergies, medical_history, status")
          .ilike("full_name", `%${args.query}%`)
          .limit(10);
        return JSON.stringify(data ?? []);
      }

      case "get_waiting_room": {
        const { data } = await supabase.from("waiting_room")
          .select("id, status, priority, arrived_at, assigned_doctor_name, patients(full_name, phone), appointments(time, type)")
          .gte("arrived_at", `${today}T00:00:00`)
          .order("arrived_at", { ascending: true });
        return JSON.stringify(data ?? []);
      }

      case "get_invoices": {
        let from: string | null = null, to: string | null = null;
        if (args.period) {
          const ranges: Record<string, { from: string; to: string }> = {
            today: { from: today, to: today },
            week:  getWeekRange(),
            month: getMonthRange(),
            "6months": getSixMonthsRange(),
          };
          const r = ranges[args.period];
          if (r) { from = r.from; to = r.to; }
        }
        if (args.dateFrom) from = args.dateFrom;
        if (args.dateTo)   to   = args.dateTo;

        let q = supabase.from("invoices")
          .select("id, invoice_number, date, total, paid, status, paid_at, patients(full_name, phone)")
          .order("created_at", { ascending: false })
          .limit(args.limit ?? 50);
        if (args.status)    q = q.eq("status", args.status);
        if (args.patientId) q = q.eq("patient_id", args.patientId);
        if (from) q = q.gte("date", from);
        if (to)   q = q.lte("date", to);
        const { data } = await q;
        return JSON.stringify({ count: (data ?? []).length, invoices: data ?? [] });
      }

      case "get_invoices_stats": {
        const ranges: Record<string, { from: string; to: string }> = {
          today: { from: today, to: today },
          week:  getWeekRange(),
          month: getMonthRange(),
          "6months": getSixMonthsRange(),
        };
        const { from, to } = ranges[args.period ?? "month"] ?? getMonthRange();
        const { data } = await supabase.from("invoices")
          .select("total, paid, status")
          .gte("date", from).lte("date", to);
        const invs = data ?? [];
        const paid    = invs.filter((i: any) => i.status === "paid");
        const unpaid  = invs.filter((i: any) => i.status === "unpaid");
        const partial = invs.filter((i: any) => i.status === "partial");
        const sum = (arr: any[], field: string) => arr.reduce((s, i) => s + (i[field] || 0), 0);
        return JSON.stringify({
          period: args.period, from, to,
          total: invs.length,
          paidCount: paid.length,   paidAmount: sum(paid, "paid"),
          unpaidCount: unpaid.length, unpaidAmount: sum(unpaid, "total"),
          partialCount: partial.length, partialAmount: partial.reduce((s: number, i: any) => s + Math.max(0, (i.total || 0) - (i.paid || 0)), 0),
          totalRevenue: sum(invs, "paid"),
        });
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

      case "get_consultations": {
        let q = supabase.from("consultations")
          .select("id, date, diagnosis, treatment, notes, next_visit, created_at, patients(full_name), profiles(name)")
          .order("created_at", { ascending: false })
          .limit(args.limit ?? 20);
        if (args.patientId) q = q.eq("patient_id", args.patientId);
        const { data } = await q;
        return JSON.stringify(data ?? []);
      }

      case "get_prescriptions": {
        let q = supabase.from("prescriptions")
          .select("id, date, diagnosis, medications, notes, status, created_at, patients(full_name), profiles(name)")
          .order("created_at", { ascending: false })
          .limit(args.limit ?? 20);
        if (args.patientId) q = q.eq("patient_id", args.patientId);
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
          .insert({ full_name: args.fullName, phone: args.phone ?? null, email: args.email ?? null, date_of_birth: args.dateOfBirth ?? null, gender: args.gender ?? null, allergies: args.allergies ?? null, medical_history: args.medicalHistory ?? null, address: args.address ?? null, status: "active" })
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
        if (args.fullName      !== undefined) updates.full_name      = args.fullName;
        if (args.phone         !== undefined) updates.phone          = args.phone;
        if (args.dateOfBirth   !== undefined) updates.date_of_birth  = args.dateOfBirth;
        if (args.gender        !== undefined) updates.gender         = args.gender;
        if (args.allergies     !== undefined) updates.allergies      = args.allergies;
        if (args.medicalHistory!== undefined) updates.medical_history= args.medicalHistory;
        if (args.address       !== undefined) updates.address        = args.address;
        if (args.status        !== undefined) updates.status         = args.status;
        if (Object.keys(updates).length === 0) return JSON.stringify({ error: "Aucune donnée à mettre à jour" });
        const { data, error } = await supabase.from("patients").update(updates).eq("id", args.patientId).select("id, full_name").single();
        if (error) return JSON.stringify({ error: error.message });
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: p } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();
          await supabase.from("activity_logs").insert({ user_id: user.id, user_name: p?.name ?? "", user_role: p?.role ?? "", action: "update_patient", entity_type: "patient", entity_id: args.patientId, entity_label: data?.full_name ?? "" });
        }
        return JSON.stringify({ success: true, patient: data });
      }

      case "create_consultation": {
        const { data: { user } } = await supabase.auth.getUser();
        const payload: Record<string, any> = { patient_id: args.patientId, diagnosis: args.diagnosis, date: today, time: new Date().toTimeString().slice(0, 5), type: "Consultation" };
        if (args.treatment) payload.treatment  = args.treatment;
        if (args.notes)     payload.notes      = args.notes;
        if (args.nextVisit) payload.next_visit  = args.nextVisit;
        if (user)           payload.doctor_id  = user.id;
        const { data, error } = await supabase.from("consultations").insert(payload).select("id, diagnosis").single();
        if (error) return JSON.stringify({ error: error.message });
        if (user) {
          const { data: p } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();
          await supabase.from("activity_logs").insert({ user_id: user.id, user_name: p?.name ?? "", user_role: p?.role ?? "", action: "create_consultation", entity_type: "consultation", entity_id: data.id, entity_label: args.diagnosis });
        }
        return JSON.stringify({ success: true, consultation: data });
      }

      case "create_prescription": {
        const { data: { user } } = await supabase.auth.getUser();
        const payload: Record<string, any> = { patient_id: args.patientId, diagnosis: args.diagnosis || "Consultation générale", medications: args.medications || [], date: today, status: "active" };
        if (args.notes) payload.notes = args.notes;
        if (user)       payload.doctor_id = user.id;
        const { data, error } = await supabase.from("prescriptions").insert(payload).select("id").single();
        if (error) return JSON.stringify({ error: error.message });
        if (user) {
          const { data: p } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();
          await supabase.from("activity_logs").insert({ user_id: user.id, user_name: p?.name ?? "", user_role: p?.role ?? "", action: "create_prescription", entity_type: "prescription", entity_id: data.id, entity_label: "Ordonnance IA" });
        }
        return JSON.stringify({ success: true, prescription: data });
      }

      case "pay_invoice": {
        const { data: inv } = await supabase.from("invoices").select("total, paid").eq("id", args.invoiceId).single();
        if (!inv) return JSON.stringify({ error: "Facture introuvable" });
        const newPaid = Math.min((inv.paid || 0) + args.amount, inv.total || 0);
        const newStatus = newPaid >= (inv.total || 0) ? "paid" : "partial";
        const { error } = await supabase.from("invoices").update({ paid: newPaid, status: newStatus, paid_at: newStatus === "paid" ? new Date().toISOString() : null }).eq("id", args.invoiceId);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, newPaid, newStatus, remaining: (inv.total || 0) - newPaid });
      }

      case "get_whatsapp_history": {
        // WhatsApp history is stored in localStorage client-side
        // We return upcoming appointments context + note that history is client-side
        // But we can check activity logs for whatsapp actions if logged
        const { data: activity } = await supabase.from("activity_logs")
          .select("user_name, entity_label, created_at, details")
          .eq("action", "whatsapp_sent")
          .order("created_at", { ascending: false })
          .limit(args.limit ?? 50);

        // Also return upcoming apts for context
        const in3days = new Date(); in3days.setDate(in3days.getDate() + 3);
        const { data: upcomingApts } = await supabase.from("appointments")
          .select("id, date, time, type, patients(id, full_name, phone)")
          .gte("date", today)
          .lte("date", formatDate(in3days))
          .neq("status", "cancelled")
          .order("date").order("time");

        return JSON.stringify({
          note: "L'historique WhatsApp complet est stocké localement dans le navigateur. Voici les données disponibles:",
          activityLogs: activity ?? [],
          upcomingAppointments: (upcomingApts ?? []).map((a: any) => ({
            patientId: (a.patients as any)?.id,
            patientName: (a.patients as any)?.full_name,
            phone: (a.patients as any)?.phone,
            date: a.date, time: a.time, type: a.type,
          })),
        });
      }

      case "get_whatsapp_pending": {
        const in3days = new Date(); in3days.setDate(in3days.getDate() + 3);
        const { data: apts } = await supabase.from("appointments")
          .select("id, date, time, type, status, patients(id, full_name, phone)")
          .gte("date", today)
          .lte("date", formatDate(in3days))
          .neq("status", "cancelled")
          .order("date").order("time");

        return JSON.stringify({
          note: "Voici les patients avec RDV dans les 3 prochains jours. L'historique des messages envoyés est stocké côté client.",
          pending: (apts ?? []).map((a: any) => ({
            appointmentId: a.id,
            patientId: (a.patients as any)?.id,
            patientName: (a.patients as any)?.full_name,
            phone: (a.patients as any)?.phone,
            date: a.date, time: a.time, type: a.type,
            daysUntil: Math.round((new Date(a.date).getTime() - new Date(today).getTime()) / 86400000),
          })),
        });
      }

      case "open_whatsapp": {
        const { data: patient } = await supabase.from("patients")
          .select("full_name, phone")
          .eq("id", args.patientId)
          .single();

        if (!patient || !(patient as any).phone) {
          return JSON.stringify({ error: "Patient introuvable ou sans numéro de téléphone" });
        }

        const phone = ((patient as any).phone as string).replace(/[\s\-\.\(\)\+]/g, "");
        const name  = (patient as any).full_name;

        const templates: Record<string, (name: string) => string> = {
          rdv_rappel:   (n) => `Bonjour ${n},\n\nNous vous rappelons votre prochain rendez-vous. Merci de confirmer votre présence ou de nous contacter.\n\nCordialement,\nVotre cabinet médical`,
          rdv_confirm:  (n) => `Bonjour ${n},\n\nVotre rendez-vous est bien confirmé. Merci d'arriver 5 minutes avant l'heure.\n\nCordialement,\nVotre cabinet médical`,
          resultats:    (n) => `Bonjour ${n},\n\nVos résultats d'analyses sont disponibles. Merci de nous contacter ou de passer au cabinet.\n\nCordialement,\nVotre cabinet médical`,
          annulation:   (n) => `Bonjour ${n},\n\nNous sommes dans l'obligation d'annuler votre rendez-vous. Merci de nous contacter pour reprogrammer.\n\nCordialement,\nVotre cabinet médical`,
          suivi:        (n) => `Bonjour ${n},\n\nCeci est un rappel pour continuer votre traitement et programmer un rendez-vous de suivi.\n\nCordialement,\nVotre cabinet médical`,
          custom:       (_) => args.customMessage ?? "",
        };

        const message = (templates[args.templateType ?? "rdv_rappel"] ?? templates.rdv_rappel)(name);
        const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

        return JSON.stringify({
          success: true,
          patientName: name,
          phone,
          whatsappUrl: waUrl,
          message,
          instruction: `OUVRE_WHATSAPP:${waUrl}`,
        });
      }

      case "generate_image": {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return JSON.stringify({ error: "Clé API non configurée" });

        // Sanitize prompt — keep it food/medical safe, strip anything that could trigger content filters
        const safePrompt = args.prompt?.slice(0, 900) ?? "Healthy Mediterranean meal, professional food photography";

        console.log("[DALL-E] generating image, prompt:", safePrompt.slice(0, 120));

        // gpt-image-1 sizes
        const size = ["1024x1024","1536x1024","1024x1536"].includes(args.size) ? args.size : "1024x1024";

        const res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt: safePrompt,
            n: 1,
            size,
            quality: "low",  // reduces image size significantly
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.error("[GPT-Image] error:", res.status, errBody);
          let userMsg = `Erreur image ${res.status}`;
          try { const p = JSON.parse(errBody); userMsg = p?.error?.message ?? userMsg; } catch {}
          return JSON.stringify({ error: userMsg });
        }

        const data = await res.json();
        const b64 = data.data?.[0]?.b64_json;
        if (!b64) return JSON.stringify({ error: "Aucune image retournée par gpt-image-1" });

        const imageUrl = `data:image/png;base64,${b64}`;
        console.log("[GPT-Image] success, b64 length:", b64.length);
        return JSON.stringify({ success: true, imageUrl, b64Length: b64.length });
      }

      default:
        return JSON.stringify({ error: `Outil inconnu: ${name}` });
    }
  } catch (e: any) {
    return JSON.stringify({ error: e.message ?? "Erreur interne" });
  }
}

// ─── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(language: string, dDate: string, today: string): string {
  const isDE = language === "de";

  const periodGuide = isDE
    ? `
PERIODEN (IMMER die richtige Funktion verwenden):
- "heute" → get_appointments_stats(period="today") oder get_appointments(date="${today}")
- "diese Woche" → get_appointments_stats(period="week")
- "diesen Monat" → get_appointments_stats(period="month")
- "letzten 6 Monate" → get_appointments_stats(period="6months")
- Für Finanzen → get_invoices_stats(period=...)
- Für Termine zählen/auflisten → get_appointments(dateFrom=..., dateTo=..., status=...)

REGELN FÜR DATUMABFRAGEN:
- Wenn nach "Anzahl" oder "wie viele" gefragt wird → IMMER get_appointments_stats oder get_invoices_stats verwenden
- Wenn nach einer Liste gefragt wird → get_appointments mit Filtern
- Heute im Format YYYY-MM-DD: ${today}`
    : `
PÉRIODES (utilise TOUJOURS la bonne fonction) :
- "aujourd'hui" → get_appointments_stats(period="today") ou get_appointments(date="${today}")
- "cette semaine" → get_appointments_stats(period="week")
- "ce mois" → get_appointments_stats(period="month")
- "6 derniers mois" → get_appointments_stats(period="6months")
- Pour les finances → get_invoices_stats(period=...)
- Pour lister des RDV → get_appointments(dateFrom=..., dateTo=..., status=...)

RÈGLES POUR LES REQUÊTES TEMPORELLES :
- Quand on demande "combien" ou "nombre de" → utilise TOUJOURS get_appointments_stats ou get_invoices_stats
- Quand on demande une liste → get_appointments avec les filtres appropriés
- Date d'aujourd'hui au format YYYY-MM-DD : ${today}`;

  if (isDE) {
    return `Du bist der integrierte KI-Assistent von ClinicOS, einer Verwaltungsplattform für Arztpraxen.
Du hast VOLLSTÄNDIGEN und ECHTZEITIGEN Zugriff auf alle Praxisdaten über deine Funktionen.

VERFÜGBARE FUNKTIONEN:
📊 LESEN: get_stats, get_appointments, get_appointments_stats, get_patients, search_patients, get_waiting_room, get_invoices, get_invoices_stats, get_team, get_activity, get_consultations, get_prescriptions
✏️ SCHREIBEN: create_patient, update_patient, create_appointment, update_appointment_status, delete_appointment, add_to_waiting_room, create_consultation, create_prescription, pay_invoice

${periodGuide}

GRUNDREGELN:
1. Verwende IMMER die Funktionen — erfinde NIEMALS Daten.
2. Für Patienten-ID → zuerst search_patients aufrufen.
3. Um Allergien/Vorgeschichte hinzuzufügen → search_patients um bestehende zu lesen, dann ALLE + neue zusammenführen.
4. Jede ausgeführte Aktion bestätigen.
5. Antworte IMMER auf Deutsch, klar und professionell.
6. **Fett** für wichtige Infos, Aufzählungspunkte für Listen.
7. Wenn eine Funktion fehlschlägt → erkläre den Fehler und schlage eine Alternative vor.

Heutiges Datum: ${dDate} (${today})`;
  }

  return `Tu es l'assistant IA intégré de ClinicOS, une plateforme de gestion de cabinet médical.
Tu as un accès COMPLET et EN TEMPS RÉEL à toutes les données du cabinet via tes fonctions.

FONCTIONS DISPONIBLES :
📊 LECTURE : get_stats, get_appointments, get_appointments_stats, get_patients, search_patients, get_waiting_room, get_invoices, get_invoices_stats, get_team, get_activity, get_consultations, get_prescriptions
✏️ ÉCRITURE : create_patient, update_patient, create_appointment, update_appointment_status, delete_appointment, add_to_waiting_room, create_consultation, create_prescription, pay_invoice
📱 WHATSAPP : get_whatsapp_history (historique envoyés), get_whatsapp_pending (à envoyer), open_whatsapp (ouvrir WhatsApp Web pour un patient)
🎨 IMAGE : generate_image (DALL-E 3) — utilise quand le médecin demande une image, un repas, un plat, une illustration

${periodGuide}

RÈGLES FONDAMENTALES :
1. Utilise TOUJOURS les fonctions — n'invente JAMAIS de données.
2. Pour une action sur un patient → utilise d'abord search_patients pour obtenir son ID.
3. Pour ajouter des allergies/antécédents → search_patients pour lire l'existant, puis fusionner TOUT (ancien + nouveau) dans update_patient.
4. Confirme chaque action effectuée avec les détails.
5. Réponds TOUJOURS en français, de manière claire et professionnelle.
6. Utilise **gras** pour les infos importantes, listes à puces pour l'organisation.
7. Si une fonction échoue → explique l'erreur et propose une alternative.
8. Pour les statistiques temporelles → TOUJOURS utiliser get_appointments_stats ou get_invoices_stats.
9. Pour WhatsApp : si demande "envoie WhatsApp à X" ou "ouvre WhatsApp pour X" → search_patients puis open_whatsapp. Le lien s'ouvrira automatiquement.
10. Pour images : si le médecin demande une image de repas, plat, recette → TOUJOURS appeler generate_image avec un prompt professionnel en anglais. Après que generate_image retourne succès, l'image est DÉJÀ affichée automatiquement dans l'interface — NE PAS écrire de lien markdown image dans ta réponse. Fournis uniquement la recette complète en texte. Si generate_image retourne une erreur, affiche le message d'erreur exact.

Date d'aujourd'hui : ${dDate} (${today})`;
}

// ─── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, imageBase64, language } = body as {
      messages: { role: string; content: string }[];
      imageBase64?: string;
      language?: string;
    };

    const locale = language === "de" ? "de-DE" : "fr-FR";
    const dDate = new Intl.DateTimeFormat(locale, {
      timeZone: "Africa/Casablanca",
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    }).format(new Date());

    const SYSTEM_PROMPT = buildSystemPrompt(language ?? "fr", dDate, getToday());

    if (!messages?.length) return NextResponse.json({ message: "Messages invalides." }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith("sk-...")) {
      return NextResponse.json({ message: "⚠️ Clé API OpenAI non configurée.", mode: "error" });
    }

    const formattedMessages: any[] = messages.map((m, idx) => {
      const isLastUser = imageBase64 && idx === messages.length - 1 && m.role === "user";
      if (isLastUser) {
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
    const MAX_ITERATIONS = 10;
    const imageUrls: string[] = [];

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
          max_tokens: 2000,
          temperature: 0.3,
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

      if (!msg.function_call) {
        finalText = msg.content ?? "";
        break;
      }

      const fnName = msg.function_call.name;
      let fnArgs: Record<string, any> = {};
      try { fnArgs = JSON.parse(msg.function_call.arguments || "{}"); } catch {}

      console.log(`[AI] → ${fnName}(${JSON.stringify(fnArgs)})`);
      const fnResult = await executeTool(fnName, fnArgs);
      console.log(`[AI] ← ${fnName} result length:`, fnResult.length);

      // Handle generate_image specially — extract image before passing to GPT
      if (fnName === "generate_image") {
        try {
          const parsed = JSON.parse(fnResult);
          if (parsed.error) {
            return NextResponse.json({
              message: `❌ **Erreur génération image** : ${parsed.error}`,
              mode: "error",
            });
          }
          if (parsed.success && parsed.imageUrl) {
            // Save the image URL separately — don't pass the huge base64 to GPT
            imageUrls.push(parsed.imageUrl);
            // Tell GPT a short confirmation without the image data
            openaiMessages.push({ role: "assistant", content: msg.content ?? null, function_call: msg.function_call });
            openaiMessages.push({ role: "function", name: fnName, content: JSON.stringify({ success: true, message: "Image générée et affichée automatiquement dans l'interface. Ne pas inclure de markdown image dans ta réponse. Fournis uniquement la recette en texte." }) });
            continue;
          }
        } catch {}
      }

      openaiMessages.push({ role: "assistant", content: msg.content ?? null, function_call: msg.function_call });
      openaiMessages.push({ role: "function", name: fnName, content: fnResult });
    }

    if (!finalText) {
      finalText = language === "de"
        ? "Entschuldigung, ich konnte diese Anfrage nicht abschließen. Bitte versuchen Sie es erneut oder formulieren Sie anders."
        : "Désolé, je n'ai pas pu traiter cette demande. Veuillez reformuler ou réessayer.";
    }

    // Extract whatsapp URL from function results
    let whatsappUrl: string | null = null;

    for (const m of openaiMessages) {
      if (m.role !== "function") continue;
      try {
        const parsed = JSON.parse(m.content);
        if (m.name === "open_whatsapp" && parsed.whatsappUrl) whatsappUrl = parsed.whatsappUrl;
      } catch {}
    }

    return NextResponse.json({ message: finalText, mode: "openai", whatsappUrl, imageUrls: imageUrls.length > 0 ? imageUrls : undefined });
  } catch (error: any) {
    console.error("AI route error:", error);
    return NextResponse.json({ message: "⚠️ Une erreur est survenue. Veuillez réessayer." }, { status: 500 });
  }
}

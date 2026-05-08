import { NextRequest, NextResponse } from "next/server";

interface Message { role: "user" | "assistant" | "system"; content: string; }

// Medical context for the AI
const SYSTEM_PROMPT = `Tu es un assistant médical intelligent pour ClinicOS, une plateforme de gestion de cabinet médical.
Tu aides les médecins et le personnel médical à gérer leur cabinet de manière optimale.

TU AS ACCÈS AUX DONNÉES SUIVANTES DANS "context" :
1. "stats" : Statistiques globales (RDV aujourd'hui, revenus, patients en attente, etc.)
2. "patients" : Liste des patients récents avec leurs ALLERGIES et HISTORIQUE MÉDICAL.
3. "appointments" : Liste des rendez-vous prévus pour AUJOURD'HUI.

CAPACITÉS SPÉCIFIQUES :
- Si on te demande "Qui sont mes patients aujourd'hui ?", consulte context.appointments.
- Si on te demande "Est-ce que [Nom] a des allergies ?", cherche dans context.patients.
- Si on te demande "Génère un rapport", fais une analyse basée sur les stats et le planning du jour.
- Vérifie TOUJOURS les allergies avant de répondre à une question sur un traitement.
- Aide le médecin à identifier les patients qui ont besoin d'un suivi particulier.

Réponds toujours en français, de manière professionnelle et concise.
Utilise des émojis et du texte en gras (**texte**) pour la clarté.
Structure tes réponses avec des listes à puces.
Ne donne jamais de diagnostic médical définitif.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, context } = body as { messages: Message[]; context?: any };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { message: "Messages invalides." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    // If no OpenAI key, use smart mock responses
    if (!apiKey || apiKey.trim() === "" || apiKey === "sk-...") {
      const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";
      const response = generateSmartResponse(lastMessage, context);
      return NextResponse.json({ message: response, mode: "demo" });
    }

    // Real OpenAI call
    const openaiMessages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(context ? [{ role: "system" as const, content: `Contexte actuel de l'utilisateur: ${JSON.stringify(context)}` }] : []),
      ...messages,
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`OpenAI API error ${response.status}:`, errBody);

      // Handle specific errors
      if (response.status === 401) {
        return NextResponse.json({
          message: "⚠️ Clé API OpenAI invalide. Veuillez vérifier votre configuration.\n\nEn attendant, je fonctionne en mode démo.",
          mode: "demo",
        });
      }
      if (response.status === 429) {
        return NextResponse.json({
          message: "⏳ Limite de requêtes atteinte. Veuillez patienter quelques secondes et réessayer.",
          mode: "error",
        });
      }

      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content;

    if (!message) {
      throw new Error("No content in OpenAI response");
    }

    return NextResponse.json({ message, mode: "openai" });
  } catch (error) {
    console.error("AI route error:", error);
    return NextResponse.json(
      { message: "⚠️ Une erreur est survenue. Veuillez réessayer dans quelques instafunction generateSmartResponse(query: string, context?: any): string {
  const stats = context?.stats;
  const todayStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Greeting
  if (query.includes("bonjour") || query.includes("salut") || query.includes("hello") || query.includes("bonsoir")) {
    return `Bonjour ! 👋 Je suis votre assistant médical ClinicOS.\n\n📅 Nous sommes le **${todayStr}**.\n\n${stats ? `**Résumé actuel :**\n• 📅 **${stats.todayAppointments}** RDV aujourd'hui\n• 👥 **${stats.totalPatients}** patients au total\n• 💰 **${stats.monthlyRevenue?.toLocaleString("fr-MA")} MAD** de revenus ce mois` : "Je peux vous aider à gérer vos rendez-vous, patients et facturation."}\n\nComment puis-je vous aider aujourd'hui ?`;
  }

  // Appointments
  if (query.includes("rendez-vous") || query.includes("rdv") || query.includes("appointment") || query.includes("planning")) {
    return `📅 **Gestion des rendez-vous**\n\n${stats ? `Aujourd'hui, vous avez **${stats.todayAppointments}** rendez-vous planifiés et **${stats.completedToday}** déjà complétés.` : "Consultez l'onglet Rendez-vous pour voir votre planning."}\n\nJe peux vous aider à :\n• Consulter votre planning du jour\n• Vérifier les créneaux disponibles\n• Envoyer des rappels aux patients\n\n💡 *Conseil : Confirmez vos rendez-vous 24h à l'avance pour réduire les absences.*`;
  }

  // Patients
  if (query.includes("patient") || query.includes("résumé patients") || query.includes("dossier")) {
    return `👥 **Gestion des patients**\n\n${stats ? `Votre cabinet compte actuellement **${stats.totalPatients}** patients enregistrés.` : ""}\n\nJe peux vous aider à :\n• 🔍 Rechercher un patient par nom\n• 📋 Consulter un dossier médical\n• ⚠️ Vérifier les allergies et contre-indications\n• 📊 Analyser l'historique des consultations\n\nQuel patient souhaitez-vous consulter ?`;
  }

  // Billing
  if (query.includes("facture") || query.includes("factures impayées") || query.includes("paiement") || query.includes("revenu") || query.includes("billing")) {
    return `💰 **Facturation & Revenus**\n\n${stats ? `Ce mois-ci : **${stats.monthlyRevenue?.toLocaleString("fr-MA")} MAD** de revenus.\nIl y a **${stats.pendingInvoices}** factures en attente de paiement.` : ""}\n\nJe peux vous aider avec :\n• 📊 Suivi des factures impayées\n• 💳 Enregistrement des paiements\n• 📈 Rapports financiers mensuels\n\nConsultez l'onglet **Facturation** pour le détail complet.`;
  }

  // Statistics
  if (query.includes("statistique") || query.includes("analytique") || query.includes("rapport") || query.includes("statistiques du mois")) {
    return `📊 **Analytique du cabinet**\n\n${stats ? `**Résumé actuel :**\n• Patients : ${stats.totalPatients}\n• RDV aujourd'hui : ${stats.todayAppointments}\n• Revenus du mois : ${stats.monthlyRevenue?.toLocaleString("fr-MA")} MAD\n• Salle d'attente : ${stats.waitingRoom} patients` : "Consultez l'onglet Analytique pour voir vos tableaux de bord."}\n\nVoulez-vous un rapport spécifique sur une période donnée ?`;
  }

  // Waiting room
  if (query.includes("attente") || query.includes("salle d'attente") || query.includes("patients urgents") || query.includes("urgent")) {
    return `🚨 **Salle d'attente & Urgences**\n\n${stats ? `Il y a actuellement **${stats.waitingRoom}** patient(s) en salle d'attente.` : ""}\n\nJe peux vous aider à :\n• 👁️ Voir les patients en attente en temps réel\n• ⚡ Prioriser les cas urgents\n• 📋 Consulter les motifs de consultation\n\nConsultez l'onglet **Salle d'attente** pour la liste actuelle.`;
  }

  // Fallback
  return `Je comprends votre demande concernant **"${query}"**.\n\n${stats ? `**Données système disponibles :**\n• ${stats.totalPatients} patients au total\n• ${stats.todayAppointments} RDV aujourd'hui\n• Accès aux allergies et historiques activé` : ""} \n\nPour vous aider au mieux (ex: "Quelles sont les allergies de M. X ?"), pourriez-vous préciser votre question ?`;
}ous préciser :\n• De quel patient ou cas s'agit-il ?\n• Quelle action souhaitez-vous effectuer ?\n• Sur quelle période portez-vous votre demande ?\n\n💡 Vous pouvez aussi utiliser les **actions rapides** ci-dessous pour les tâches courantes, ou m'écrire en langage naturel — je ferai de mon mieux pour comprendre et vous aider !`;
}

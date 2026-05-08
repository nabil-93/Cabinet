import { NextRequest, NextResponse } from "next/server";

interface Message { role: "user" | "assistant" | "system"; content: string; }

// Medical context for the AI
const SYSTEM_PROMPT = `Tu es un assistant médical intelligent pour ClinicOS, une plateforme de gestion de cabinet médical.
Tu aides les médecins et le personnel médical à:
- Consulter et analyser les informations sur les patients
- Gérer les rendez-vous et le planning
- Résumer les historiques médicaux
- Générer des notes médicales
- Analyser les statistiques du cabinet
- Répondre aux questions médicales générales

Réponds toujours en français, de manière professionnelle, concise et précise.
Utilise des émojis pour rendre les réponses plus lisibles.
Ne donne jamais de diagnostic médical définitif — tu es un assistant, pas un médecin.
Pour les questions hors de ton domaine, oriente vers un professionnel de santé.`;

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;

    // If no OpenAI key, use smart mock responses
    if (!apiKey) {
      const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || "";
      const response = generateSmartResponse(lastMessage, context);
      return NextResponse.json({ message: response });
    }

    // Real OpenAI call
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...(context ? [{ role: "system", content: `Contexte actuel: ${JSON.stringify(context)}` }] : []),
          ...messages,
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices[0]?.message?.content || "Je ne peux pas répondre pour le moment.";
    return NextResponse.json({ message });
  } catch (error) {
    console.error("AI route error:", error);
    return NextResponse.json({ message: "Une erreur est survenue. Réessayez." }, { status: 500 });
  }
}

function generateSmartResponse(query: string, context?: any): string {
  const stats = context?.stats;
  const todayStr = new Date().toLocaleDateString("fr-MA");

  if (query.includes("bonjour") || query.includes("salut") || query.includes("hello")) {
    return `Bonjour ! 👋 Je suis votre assistant médical ClinicOS.\n\nAujourd'hui (${todayStr}), voici votre résumé rapide:\n${stats ? `• 📅 **${stats.todayAppointments}** rendez-vous planifiés\n• 👥 **${stats.totalPatients}** patients au total\n• 💰 **${stats.monthlyRevenue?.toLocaleString("fr-MA")} MAD** de revenus ce mois` : "• Connectez-vous pour voir vos statistiques"}\n\nComment puis-je vous aider ?`;
  }

  if (query.includes("rendez-vous") || query.includes("rdv") || query.includes("appointment")) {
    return `📅 **Gestion des rendez-vous**\n\n${stats ? `Aujourd'hui vous avez **${stats.todayAppointments}** rendez-vous planifiés et **${stats.completedToday}** déjà complétés.\n\n**Salle d'attente:** ${stats.waitingRoom} patient(s) en attente` : "Consultez l'onglet Rendez-vous pour voir votre planning"}\n\n💡 *Conseil: Confirmez vos rendez-vous à l'avance pour réduire les absences.*`;
  }

  if (query.includes("patient")) {
    return `👥 **Gestion des patients**\n\n${stats ? `Votre cabinet compte **${stats.totalPatients}** patients enregistrés.` : ""}\n\nJe peux vous aider à:\n• 🔍 Rechercher un patient\n• 📋 Résumer un dossier médical\n• ⚠️ Identifier les allergies et contre-indications\n• 📊 Analyser l'historique médical\n\nQuel patient souhaitez-vous consulter ?`;
  }

  if (query.includes("facture") || query.includes("paiement") || query.includes("revenu")) {
    return `💰 **Facturation & Revenus**\n\n${stats ? `Ce mois: **${stats.monthlyRevenue?.toLocaleString("fr-MA")} MAD** de revenus\nFactures en attente: **${stats.pendingInvoices}**` : ""}\n\n📊 **Conseils:**\n• Envoyez des rappels automatiques pour les factures impayées\n• Générez des rapports mensuels pour le suivi comptable\n• Exportez en PDF pour vos archives\n\nVoulez-vous que je génère un rapport financier ?`;
  }

  if (query.includes("ordonnance") || query.includes("prescription") || query.includes("médicament")) {
    return `💊 **Module Ordonnances**\n\nJe peux vous aider à:\n• 📝 Créer une nouvelle ordonnance\n• 🔍 Vérifier les interactions médicamenteuses\n• 📤 Exporter en PDF avec signature digitale\n• 📋 Résumer les traitements en cours d'un patient\n\n⚠️ *Rappel: Vérifiez toujours les allergies du patient avant de prescrire.*\n\nPour quel patient souhaitez-vous créer une ordonnance ?`;
  }

  if (query.includes("statistique") || query.includes("analytique") || query.includes("rapport")) {
    return `📊 **Analytique du cabinet**\n\n${stats ? `**Résumé actuel:**\n• Patients: ${stats.totalPatients}\n• RDV aujourd'hui: ${stats.todayAppointments}\n• Revenus du mois: ${stats.monthlyRevenue?.toLocaleString("fr-MA")} MAD\n• Salle d'attente: ${stats.waitingRoom} patients` : ""}\n\n📈 **Indicateurs disponibles:**\n• Taux d'occupation: ~87%\n• Satisfaction patient: 4.8/5\n• Nouveaux patients/mois: 20\n\nVoulez-vous un rapport détaillé ?`;
  }

  if (query.includes("aide") || query.includes("help") || query.includes("que peux") || query.includes("comment")) {
    return `🤖 **Mes capacités:**\n\n**Gestion quotidienne:**\n• 📅 Planning et rendez-vous\n• 👥 Dossiers patients\n• 💊 Ordonnances et prescriptions\n• 💰 Facturation et paiements\n\n**Analyse et rapports:**\n• 📊 Statistiques du cabinet\n• 📈 Tendances et performance\n• 🔍 Recherche intelligente\n\n**Assistance médicale:**\n• 📋 Résumés de dossiers\n• ⚠️ Alertes allergies\n• 💡 Rappels et notifications\n\nQue voulez-vous faire ?`;
  }

  // Generic intelligent response
  return `Je comprends votre demande concernant "${query}".\n\n${stats ? `**Contexte actuel de votre cabinet:**\n• ${stats.totalPatients} patients · ${stats.todayAppointments} RDV aujourd'hui\n• ${stats.monthlyRevenue?.toLocaleString("fr-MA")} MAD revenus ce mois\n\n` : ""}Pour vous aider au mieux, pourriez-vous préciser:\n• De quel patient s'agit-il ?\n• Quel type d'action souhaitez-vous effectuer ?\n\n💡 *Utilisez les actions rapides ci-dessous pour les tâches courantes.*`;
}

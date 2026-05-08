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
Structure tes réponses avec des sauts de ligne et des puces (•) pour la lisibilité.
Ne donne jamais de diagnostic médical définitif — tu es un assistant, pas un médecin.
Pour les questions hors de ton domaine, oriente vers un professionnel de santé.
Quand tu utilises du texte en gras, utilise **texte** pour le formater.`;

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
      { message: "⚠️ Une erreur est survenue. Veuillez réessayer dans quelques instants." },
      { status: 500 }
    );
  }
}

function generateSmartResponse(query: string, context?: any): string {
  const todayStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Greeting
  if (query.includes("bonjour") || query.includes("salut") || query.includes("hello") || query.includes("bonsoir")) {
    return `Bonjour ! 👋 Je suis votre assistant médical ClinicOS.\n\n📅 Nous sommes le **${todayStr}**.\n\nJe peux vous aider avec :\n• La gestion de vos rendez-vous\n• Les dossiers patients\n• Les ordonnances et prescriptions\n• La facturation et les revenus\n• Les statistiques de votre cabinet\n\nComment puis-je vous aider aujourd'hui ?`;
  }

  // Appointments
  if (query.includes("rendez-vous") || query.includes("rdv") || query.includes("appointment") || query.includes("planning")) {
    return `📅 **Gestion des rendez-vous**\n\nVoici ce que je peux faire pour vous :\n• Consulter votre planning du jour\n• Vérifier les créneaux disponibles\n• Confirmer ou annuler des rendez-vous\n• Envoyer des rappels aux patients\n\n💡 *Conseil : Confirmez vos rendez-vous 24h à l'avance pour réduire les absences.*\n\nRendez-vous dans l'onglet **Rendez-vous** pour voir votre planning complet.`;
  }

  // Patients
  if (query.includes("patient") || query.includes("résumé patients") || query.includes("dossier")) {
    return `👥 **Gestion des patients**\n\nJe peux vous aider à :\n• 🔍 Rechercher un patient par nom\n• 📋 Consulter un dossier médical\n• ⚠️ Vérifier les allergies et contre-indications\n• 📊 Analyser l'historique des consultations\n• 📝 Ajouter des notes médicales\n\nPour accéder aux dossiers, utilisez l'onglet **Patients** dans la navigation.\n\nQuel patient souhaitez-vous consulter ?`;
  }

  // Billing
  if (query.includes("facture") || query.includes("factures impayées") || query.includes("paiement") || query.includes("revenu") || query.includes("billing")) {
    return `💰 **Facturation & Revenus**\n\nJe peux vous aider avec :\n• 📊 Suivi des factures impayées\n• 💳 Enregistrement des paiements\n• 📄 Génération de reçus PDF\n• 📈 Rapports financiers mensuels\n• 🔔 Rappels automatiques aux patients\n\n💡 *Conseil : Exportez vos rapports mensuels pour faciliter la comptabilité.*\n\nConsultez l'onglet **Facturation** pour le détail complet.`;
  }

  // Prescriptions
  if (query.includes("ordonnance") || query.includes("prescription") || query.includes("médicament") || query.includes("aide ordonnance")) {
    return `💊 **Module Ordonnances**\n\nJe peux vous aider à :\n• 📝 Créer une nouvelle ordonnance\n• 🔍 Vérifier les interactions médicamenteuses\n• 📤 Exporter en PDF avec signature\n• 📋 Consulter les traitements en cours\n• ♻️ Renouveler une ordonnance existante\n\n⚠️ *Rappel important : Vérifiez toujours les allergies du patient avant de prescrire.*\n\nPour quel patient souhaitez-vous créer une ordonnance ?`;
  }

  // Statistics
  if (query.includes("statistique") || query.includes("analytique") || query.includes("rapport") || query.includes("statistiques du mois")) {
    return `📊 **Analytique du cabinet**\n\nIndicateurs disponibles :\n• 📈 Taux d'occupation par semaine\n• 👥 Évolution du nombre de patients\n• 💰 Revenus mensuels et annuels\n• 🕐 Durées moyennes des consultations\n• ⭐ Satisfaction et fidélisation patients\n\nConsultez l'onglet **Analytique** pour voir tous vos tableaux de bord en temps réel.\n\nVoulez-vous un rapport spécifique sur une période donnée ?`;
  }

  // Waiting room
  if (query.includes("attente") || query.includes("salle d'attente") || query.includes("patients urgents") || query.includes("urgent")) {
    return `🚨 **Salle d'attente & Urgences**\n\nJe peux vous aider à :\n• 👁️ Voir les patients en attente en temps réel\n• ⚡ Prioriser les cas urgents\n• 📋 Consulter les motifs de consultation\n• 🔔 Notifier le médecin disponible\n\n💡 *Conseil : La salle d'attente se met à jour en temps réel.*\n\nConsultez l'onglet **Salle d'attente** pour la liste actuelle.`;
  }

  // Help / capabilities
  if (query.includes("aide") || query.includes("help") || query.includes("que peux") || query.includes("comment") || query.includes("capacité")) {
    return `🤖 **Mes capacités**\n\n**Gestion quotidienne :**\n• 📅 Planning et rendez-vous\n• 👥 Dossiers patients\n• 💊 Ordonnances et prescriptions\n• 💰 Facturation et paiements\n• 🚨 Salle d'attente\n\n**Analyse et rapports :**\n• 📊 Statistiques du cabinet\n• 📈 Tendances et performance\n• 📄 Génération de rapports PDF\n\n**Assistance médicale :**\n• 📋 Résumés de dossiers\n• ⚠️ Alertes allergies et interactions\n• 💡 Rappels et notifications intelligentes\n\nPosez-moi n'importe quelle question — je suis là pour vous aider !`;
  }

  // Generic fallback — still helpful
  return `Je comprends votre question sur **"${query}"**.\n\nPour mieux vous aider, pourriez-vous préciser :\n• De quel patient ou cas s'agit-il ?\n• Quelle action souhaitez-vous effectuer ?\n• Sur quelle période portez-vous votre demande ?\n\n💡 Vous pouvez aussi utiliser les **actions rapides** ci-dessous pour les tâches courantes, ou m'écrire en langage naturel — je ferai de mon mieux pour comprendre et vous aider !`;
}

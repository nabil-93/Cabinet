import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { values, patientName, summary, reportDate, customPrompt } = await req.json();
    if (!values?.length) return NextResponse.json({ error: "Valeurs requises" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith("sk-...")) {
      return NextResponse.json({ error: "Clé OpenAI non configurée" }, { status: 500 });
    }

    const criticalVals = values.filter((v: any) => v.status === "danger");
    const warnVals     = values.filter((v: any) => v.status === "warn");
    const okVals       = values.filter((v: any) => v.status === "ok");
    const fmt = (vals: any[]) =>
      vals.map(v => `- ${v.label}: ${v.value} ${v.unit} [norme: ${v.refMin ?? "?"} – ${v.refMax ?? "?"} ${v.unit}]`).join("\n");
    const score = Math.round((okVals.length / values.length) * 100);

    // If a custom prompt is provided (single value analysis), use it directly
    const prompt = customPrompt ? customPrompt : `Tu es un médecin clinicien senior expert en biologie médicale. Génère un rapport médical complet et professionnel basé sur ces résultats d'analyses biologiques.

**Patient:** ${patientName ?? "Patient"}
**Date du rapport:** ${reportDate ?? "Non précisée"}
**Score global:** ${score}% des valeurs normales (${okVals.length} normales, ${warnVals.length} attention, ${criticalVals.length} critiques)
${summary ? `**Interprétation du laboratoire:** ${summary}` : ""}

**VALEURS CRITIQUES (${criticalVals.length}):**
${fmt(criticalVals) || "Aucune"}

**VALEURS À SURVEILLER (${warnVals.length}):**
${fmt(warnVals) || "Aucune"}

**VALEURS NORMALES (${okVals.length}):**
${fmt(okVals) || "Aucune"}

---

Génère un rapport médical structuré et complet avec les sections suivantes:

**RÉSUMÉ EXÉCUTIF**
État de santé général du patient en 2-3 phrases claires. Niveau d'urgence global.

**ANALYSE DES FINDINGS CRITIQUES**
Pour chaque valeur critique ou anormale: signification clinique, causes probables, risques immédiats.

**HYPOTHÈSES DIAGNOSTIQUES**
Les diagnostics les plus probables au vu de ce tableau biologique complet.

**PLAN THÉRAPEUTIQUE RECOMMANDÉ**
Traitements et interventions à envisager par ordre de priorité.

**EXAMENS COMPLÉMENTAIRES**
Quels examens supplémentaires sont nécessaires, dans quel délai et pourquoi.

**CONSEILS AU PATIENT**
Instructions claires et concrètes pour le patient: régime alimentaire, activité physique, médicaments à prendre, signes d'alarme à surveiller, quand consulter en urgence.

**PLAN DE SUIVI**
Quand revoir le patient, quels contrôles biologiques refaire et à quelle fréquence.

**NIVEAU D'URGENCE**
Indique clairement: Urgence immédiate (< 24h) / Semi-urgent (< 48h) / Consultation programmée (< 2 semaines) / Surveillance simple. Justifie ta décision.

Réponse professionnelle, structurée, en français. Sois précis et cliniquement utile.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2500,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Erreur OpenAI: ${res.status} — ${errText}` }, { status: 500 });
    }

    const data = await res.json();
    const report = data.choices?.[0]?.message?.content ?? "Rapport non disponible.";
    return NextResponse.json({ report });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}

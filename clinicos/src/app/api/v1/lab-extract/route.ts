import { NextRequest, NextResponse } from "next/server";

function buildPrompt(lang: string) {
  const isDE = lang === "de";
  const labelLang = isDE
    ? "auf Deutsch, kurz (z.B. \"Hämoglobin\", \"CRP\", \"Leukozyten\", \"Erythrozyten\")"
    : "en français, court (ex: \"Hémoglobine\", \"CRP\", \"Globules blancs\")";
  const categoryLang = isDE
    ? "(z.B. \"Blutbild\", \"Nierenwerte\", \"Leberwerte\", \"Lipidprofil\", \"Entzündungsmarker\" usw.)"
    : "(ex: \"NFS\", \"Bilan rénal\", \"Bilan hépatique\", \"Bilan lipidique\", etc.)";
  const summaryLang = isDE
    ? "kurze Zusammenfassung auf Deutsch"
    : "résumé court en français";
  const instruction = isDE
    ? "Antworte NUR mit einem gültigen JSON-Objekt, kein Text davor oder danach."
    : "Ne retourne que le JSON, sans texte avant ou après.";

  return `Tu es un assistant médical expert en biologie médicale.
Analyse cette image de rapport d'analyses biologiques et extrais TOUTES les valeurs numériques présentes.

Pour chaque valeur, retourne un objet JSON avec:
- "label": nom de l'examen ${labelLang}
- "value": valeur numérique (string, ex: "15.2")
- "unit": unité (ex: "g/dL", "mg/L", "/mm³")
- "refMin": valeur minimale normale (number ou null si non disponible)
- "refMax": valeur maximale normale (number ou null si non disponible)
- "status": "ok" si normal, "warn" si légèrement anormal, "danger" si très anormal ou marqué H/L/critique
- "category": catégorie ${categoryLang}
- "summary": ${summaryLang}

Retourne UNIQUEMENT un objet JSON valide avec cette structure exacte:
{
  "values": [...],
  "summary": "${isDE ? "kurze Zusammenfassung auf Deutsch" : "résumé court en une phrase"}",
  "reportDate": "YYYY-MM-DD ou null",
  "labName": "nom du laboratoire ou null"
}

${instruction}`;
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, lang = "fr" } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: "imageBase64 requis" }, { status: 400 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith("sk-...")) {
      return NextResponse.json({ error: "Clé OpenAI non configurée" }, { status: 500 });
    }

    const prompt = buildPrompt(lang);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" } },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI error:", res.status, errText);
      return NextResponse.json({ error: `Erreur OpenAI: ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const jsonStr = jsonMatch[1]?.trim() ?? content.trim();
    const parsed = JSON.parse(jsonStr);
    return NextResponse.json(parsed);
  } catch (e: any) {
    console.error("lab-extract error:", e);
    return NextResponse.json({ error: e.message ?? "Erreur d'extraction" }, { status: 500 });
  }
}

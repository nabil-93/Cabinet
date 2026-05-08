import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: "Aucun fichier audio fourni." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith("sk-...")) {
      return NextResponse.json({ error: "Clé API OpenAI non configurée." }, { status: 500 });
    }

    const body = new FormData();
    body.append("file", audioFile);
    body.append("model", "whisper-1");
    body.append("language", "fr");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Whisper error:", res.status, errText);
      return NextResponse.json({ error: `Erreur Whisper: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ transcript: data.text ?? "" });
  } catch (error: any) {
    console.error("Transcribe route error:", error);
    return NextResponse.json({ error: "Erreur lors de la transcription." }, { status: 500 });
  }
}

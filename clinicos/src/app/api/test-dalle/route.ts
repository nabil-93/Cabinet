import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY manquante" });

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: "A simple red apple on a white plate, professional food photography",
        n: 1,
        size: "1024x1024",
        quality: "standard",
      }),
    });

    const body = await res.json();
    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      response: body,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}

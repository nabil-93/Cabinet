import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY manquante" });

  try {
    // 1. List all available models
    const modelsRes = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const modelsData = await modelsRes.json();
    const modelIds: string[] = (modelsData.data ?? []).map((m: any) => m.id).sort();
    const imageModels = modelIds.filter(id => id.includes("dall") || id.includes("image"));

    // 2. Try dall-e-3
    const res3 = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "dall-e-3", prompt: "red apple", n: 1, size: "1024x1024" }),
    });
    const body3 = await res3.json();

    // 3. Try dall-e-2
    const res2 = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "dall-e-2", prompt: "red apple", n: 1, size: "256x256" }),
    });
    const body2 = await res2.json();

    return NextResponse.json({
      keyPrefix: apiKey.slice(0, 12) + "...",
      imageModelsAvailable: imageModels,
      allModelsCount: modelIds.length,
      dalle3: { status: res3.status, ok: res3.ok, error: body3?.error?.message ?? null, hasUrl: !!body3?.data?.[0]?.url },
      dalle2: { status: res2.status, ok: res2.ok, error: body2?.error?.message ?? null, hasUrl: !!body2?.data?.[0]?.url },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}

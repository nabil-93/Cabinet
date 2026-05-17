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

    // 2. Try gpt-image-1
    const resImg = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-image-1", prompt: "a simple red apple on white plate", n: 1, size: "1024x1024" }),
    });
    const bodyImg = await resImg.json();
    const hasB64 = !!bodyImg?.data?.[0]?.b64_json;
    const hasUrl = !!bodyImg?.data?.[0]?.url;

    return NextResponse.json({
      keyPrefix: apiKey.slice(0, 12) + "...",
      imageModelsAvailable: imageModels,
      allModelsCount: modelIds.length,
      gptImage1: {
        status: resImg.status,
        ok: resImg.ok,
        error: bodyImg?.error?.message ?? null,
        hasB64,
        hasUrl,
        b64Preview: hasB64 ? bodyImg.data[0].b64_json.slice(0, 30) + "..." : null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}

import { NextRequest, NextResponse } from "next/server";

// Module-level cache: imageId → base64 string (lives for the lifetime of the server instance)
export const imageCache = new Map<string, { b64: string; ts: number }>();

// Clean up entries older than 10 minutes
function cleanup() {
  const limit = Date.now() - 10 * 60 * 1000;
  for (const [id, entry] of imageCache) {
    if (entry.ts < limit) imageCache.delete(id);
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new NextResponse("Missing id", { status: 400 });

  const entry = imageCache.get(id);
  if (!entry) return new NextResponse("Image not found or expired", { status: 404 });

  cleanup();

  // Decode base64 and serve as image
  const binary = Buffer.from(entry.b64, "base64");
  return new NextResponse(binary, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=600",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_PROMPTS } from "@/lib/prompts";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 300;

const allowedTypes = ["vector-illustration", "black-white", "line-drawing"];

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    const vectorType = String(form.get("vectorType") || "");
    if (!(image instanceof File)) return NextResponse.json({ error: "Please upload an image." }, { status: 400 });
    if (!["image/png", "image/jpeg", "image/webp"].includes(image.type)) return NextResponse.json({ error: "Only PNG, JPG, and WEBP images are supported." }, { status: 400 });
    if (image.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Image must be 10 MB or smaller." }, { status: 400 });
    if (!allowedTypes.includes(vectorType)) return NextResponse.json({ error: "Invalid vector type." }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Gemini API is not configured in Vercel Environment Variables yet." }, { status: 503 });

    const bytes = Buffer.from(await image.arrayBuffer());
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let prompt = DEFAULT_PROMPTS[vectorType];
    let supabase: ReturnType<typeof getSupabaseAdmin> | null = null;
    try {
      supabase = getSupabaseAdmin();
      const { data } = await supabase.from("prompts").select("prompt_content").eq("vector_type", vectorType).eq("is_active", true).maybeSingle();
      if (data?.prompt_content) prompt = data.prompt_content;
    } catch { /* Use safe built-in defaults until Supabase is configured. */ }

    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.1-flash-image",
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: image.type, data: bytes.toString("base64") } }, { text: prompt }] }],
      config: { responseModalities: ["IMAGE", "TEXT"] }
    });

    const parts = result.candidates?.[0]?.content?.parts || [];
    const generated = parts.find(part => part.inlineData?.data);
    if (!generated?.inlineData?.data) return NextResponse.json({ error: "Gemini did not return an image. Please retry with another image." }, { status: 502 });
    const mime = generated.inlineData.mimeType || "image/png";
    const outputBuffer = Buffer.from(generated.inlineData.data, "base64");
    const conversionId = crypto.randomUUID();
    let imageUrl = `data:${mime};base64,${outputBuffer.toString("base64")}`;

    if (supabase) {
      const path = `outputs/${conversionId}.png`;
      const { error: uploadError } = await supabase.storage.from("vectorify-storage").upload(path, outputBuffer, { contentType: mime, upsert: false });
      if (!uploadError) {
        const { data: signed } = await supabase.storage.from("vectorify-storage").createSignedUrl(path, 60 * 60);
        if (signed?.signedUrl) imageUrl = signed.signedUrl;
        await supabase.from("conversions").insert({ id: conversionId, vector_type: vectorType, output_image_path: path, status: "completed", retry_count: 0, model_name: process.env.GEMINI_MODEL || "gemini-3.1-flash-image" });
      }
    }
    return NextResponse.json({ imageUrl, conversionId });
  } catch (error) {
    console.error("Vectorify conversion error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected conversion error." }, { status: 500 });
  }
}
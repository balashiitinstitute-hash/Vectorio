import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_PROMPTS } from "@/lib/prompts";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedTypes = ["vector-illustration", "black-white", "line-drawing"];

const serviceNames: Record<string, string> = {
  "vector-illustration": "Vector Illustration",
  "black-white": "Black & White",
  "line-drawing": "Line Drawing"
};

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    const vectorType = String(form.get("vectorType") || "");
    if (!(image instanceof File)) return NextResponse.json({ error: "Please upload an image." }, { status: 400 });
    if (!["image/png", "image/jpeg", "image/webp"].includes(image.type)) return NextResponse.json({ error: "Only PNG, JPG, and WEBP images are supported." }, { status: 400 });
    if (image.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Image must be 10 MB or smaller." }, { status: 400 });
    if (!allowedTypes.includes(vectorType)) return NextResponse.json({ error: "Please select a valid service." }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "GEMINI_API_KEY is missing from Vercel Environment Variables. Add a Gemini API key with free-tier access." }, { status: 503 });

    let serviceGuidance = DEFAULT_PROMPTS[vectorType];
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase.from("prompts").select("prompt_content").eq("vector_type", vectorType).eq("is_active", true).maybeSingle();
      if (data?.prompt_content) serviceGuidance = data.prompt_content;
    } catch { /* Fall back to built-in service guidance. */ }

    const bytes = Buffer.from(await image.arrayBuffer());
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash-lite",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: image.type, data: bytes.toString("base64") } },
          { text: `Analyze the uploaded image carefully, then write ONE complete, ready-to-copy image-editing prompt for the user.

Selected service: ${serviceNames[vectorType]}.
Service guidance: ${serviceGuidance}

The user's intended base instruction is: "Convert this exact uploaded image into ${serviceNames[vectorType].toLowerCase()}."

Your prompt must:
- Identify the actual subject, objects, pose, composition, framing, background, colors, and distinctive details visible in THIS image. Do not guess unclear details.
- Explicitly instruct the image model to preserve the exact subject, number of objects, composition, proportions, pose, camera/view angle, and all meaningful details.
- Apply only the selected visual style. Do not invent, remove, replace, rearrange, or add elements.
- Include specific rendering directions appropriate to the selected service.
- Be clear, professional, detailed, and directly usable with the original image attached.
- Return only the final prompt. Do not add analysis, headings, explanations, markdown fences, or mention that you are an AI.` }
        ]
      }],
      config: { responseModalities: ["TEXT"], temperature: 0.4 }
    });

    const prompt = result.text?.trim();
    if (!prompt) return NextResponse.json({ error: "The vision model did not return a prompt. Please try again." }, { status: 502 });
    return NextResponse.json({ prompt });
  } catch (error) {
    console.error("Prompt generation error:", error);
    const message = error instanceof Error ? error.message : "Unexpected prompt generation error.";
    const status = /429|quota|rate limit/i.test(message) ? 429 : 500;
    return NextResponse.json({ error: status === 429 ? "Gemini free-tier quota is temporarily exhausted. Please retry later." : message }, { status });
  }
}
